"""
All FFmpeg / ffprobe access lives here. Argument lists only, no shell.
"""
import os
import json
import logging
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, List, Tuple, Dict, Any

from core.config import settings

logger = logging.getLogger("cineforge.media")


class MediaProcessingError(RuntimeError):
    """ffmpeg/ffprobe failed or the media is invalid."""


class ShotTooShortError(MediaProcessingError):
    """A clip is shorter than its shot and policy forbids padding."""


class DurationMismatchError(MediaProcessingError):
    """Video and audio lengths differ by more than the tolerance."""


@dataclass(frozen=True)
class MediaInfo:
    duration: float
    has_video: bool
    has_audio: bool
    width: Optional[int]
    height: Optional[int]
    fps: Optional[float]


def _find_binary(name: str) -> str:
    """Find binary in PATH, WinGet, or imageio-ffmpeg directories."""
    found = shutil.which(name)
    if found:
        return found
    
    # Check known winget installation directory
    local_app_data = os.environ.get("LOCALAPPDATA", "")
    if local_app_data:
        winget_bin = os.path.join(
            local_app_data,
            "Microsoft", "WinGet", "Packages",
            "Gyan.FFmpeg.Essentials_Microsoft.Winget.Source_8wekyb3d8bbwe",
            "ffmpeg-9.0.1-essentials_build", "bin",
            f"{name}.exe"
        )
        if os.path.exists(winget_bin):
            return winget_bin

    # Check imageio_ffmpeg for ffmpeg
    if name == "ffmpeg":
        try:
            import imageio_ffmpeg
            exe = imageio_ffmpeg.get_ffmpeg_exe()
            if os.path.exists(exe):
                return exe
        except Exception:
            pass

    return name


FFMPEG_BIN = _find_binary("ffmpeg")
FFPROBE_BIN = _find_binary("ffprobe")


def _run(args: list[str], timeout: Optional[int] = None) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(
            args,
            check=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout or settings.FFMPEG_TIMEOUT_SEC,
        )
    except subprocess.CalledProcessError as exc:
        err_msg = exc.stderr[-2000:] if exc.stderr else str(exc)
        raise MediaProcessingError(f"{args[0]} failed: {err_msg}") from exc
    except subprocess.TimeoutExpired as exc:
        raise MediaProcessingError(f"{args[0]} timed out") from exc


def _ff(*extra: str) -> list[str]:
    return [FFMPEG_BIN, "-y", "-hide_banner", "-loglevel", "error", *extra]


def probe(path: Path | str) -> MediaInfo:
    path_str = str(path)
    if not os.path.exists(path_str):
        raise MediaProcessingError(f"File not found for probing: {path_str}")

    out = _run([
        FFPROBE_BIN, "-v", "error", "-print_format", "json",
        "-show_format", "-show_streams", path_str
    ], timeout=60)
    stdout_text = out.stdout if (out and out.stdout) else "{}"
    try:
        data = json.loads(stdout_text)
    except Exception as e:
        logger.warning(f"Failed to parse ffprobe json output: {e}")
        data = {}
    streams = data.get("streams", [])
    video = next((s for s in streams if s.get("codec_type") == "video"), None)
    audio = next((s for s in streams if s.get("codec_type") == "audio"), None)
    
    fps = None
    if video and video.get("avg_frame_rate", "0/0") != "0/0":
        try:
            num, den = video["avg_frame_rate"].split("/")
            fps = float(num) / float(den) if float(den) != 0 else None
        except Exception:
            fps = None
            
    raw_dur = data.get("format", {}).get("duration", 0)
    if (not raw_dur or float(raw_dur) == 0) and video:
        raw_dur = video.get("duration", 0)
    if (not raw_dur or float(raw_dur) == 0) and audio:
        raw_dur = audio.get("duration", 0)

    return MediaInfo(
        duration=float(raw_dur or 0),
        has_video=video is not None,
        has_audio=audio is not None,
        width=int(video["width"]) if video and video.get("width") else None,
        height=int(video["height"]) if video and video.get("height") else None,
        fps=fps,
    )


def compute_shot_duration(script_duration: float, audio_duration: Optional[float]) -> float:
    """One source of truth for how long a shot lasts."""
    if not audio_duration or audio_duration <= 0:
        return float(script_duration)
    needed = audio_duration + settings.SHOT_PRE_DELAY_SEC + settings.SHOT_POST_TAIL_SEC
    return round(max(float(script_duration), needed), 3)


def format_ass_time(seconds: float) -> str:
    """Format seconds into ASS timestamp format: H:MM:SS.cs"""
    total_cs = int(round(max(0.0, seconds) * 100))
    cs = total_cs % 100
    total_s = total_cs // 100
    s = total_s % 60
    total_m = total_s // 60
    m = total_m % 60
    h = total_m // 60
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def _escape_ass_text(text: str) -> str:
    """Escape ASS override braces, backslashes, and line breaks."""
    return (
        (text or "")
        .replace("\\", r"\\")
        .replace("{", r"\{")
        .replace("}", r"\}")
        .replace("\r\n", " ")
        .replace("\n", " ")
        .replace("\r", " ")
    )


def estimate_word_timings(
    dialogue: str,
    total_audio_duration: float,
    start_offset: float = 0.5
) -> list[dict]:
    """
    Generate word-level timing estimates for animated subtitles
    when explicit phoneme/word-level alignment is not provided.
    """
    words = dialogue.strip().split()
    if not words:
        return []

    weights = []
    for w in words:
        wt = max(1, len(w))
        if w.endswith((".", "!", "?")):
            wt += 3
        elif w.endswith((",", ";", ":", "-")):
            wt += 2
        weights.append(wt)

    total_weight = sum(weights)
    speech_duration = max(0.5, total_audio_duration - 0.2)

    current_time = start_offset
    timings = []
    for w, wt in zip(words, weights):
        word_dur = (wt / total_weight) * speech_duration
        timings.append({
            "word": w,
            "start": round(current_time, 2),
            "end": round(current_time + word_dur, 2),
            "duration_cs": max(5, int(round(word_dur * 100)))
        })
        current_time += word_dur
    return timings


def create_shot_subtitles_ass(
    dialogue: str,
    speaker: Optional[str],
    duration: float,
    out_path: Path | str,
    word_timings: Optional[List[Dict[str, Any]]] = None,
    audio_duration: Optional[float] = None
) -> Path:
    """
    Generates an Advanced SubStation Alpha (.ass) subtitle file for a shot.
    - Child-friendly high-contrast styling with rounded aesthetic.
    - Yellow/gold speaker badge {\\c&H00D7FF&} and bold white text {\\c&HFFFFFF&}.
    - Smooth animated karaoke highlight fill {\\kf<cs>} synced with voice timing.
    """
    out_p = Path(out_path)
    out_p.parent.mkdir(parents=True, exist_ok=True)

    clean_dialogue = (dialogue or "").strip()
    if not clean_dialogue:
        out_p.write_text(
            f"[Script Info]\nScriptType: v4.00+\nPlayResX: {settings.VIDEO_WIDTH}\nPlayResY: {settings.VIDEO_HEIGHT}\n[Events]\n",
            encoding="utf-8"
        )
        return out_p

    speaker_tag = f"{_escape_ass_text(speaker.strip().upper())}: " if speaker and speaker.strip() else ""

    pre_delay = settings.SHOT_PRE_DELAY_SEC
    effective_audio_dur = audio_duration or (duration - pre_delay - settings.SHOT_POST_TAIL_SEC)
    if effective_audio_dur <= 0:
        effective_audio_dur = max(1.0, duration - pre_delay)

    start_sec = pre_delay
    end_sec = min(duration - 0.1, start_sec + effective_audio_dur + 0.3)
    if end_sec <= start_sec:
        end_sec = duration

    if not word_timings:
        word_timings = estimate_word_timings(clean_dialogue, effective_audio_dur, start_offset=start_sec)

    karaoke_parts = []
    for wt in word_timings:
        word = _escape_ass_text(wt.get("word", ""))
        cs = wt.get("duration_cs", 30)
        karaoke_parts.append(f"{{\\kf{cs}}}{word} ")
    animated_text = "".join(karaoke_parts).strip()

    speaker_styled = f"{{\\c&H00D7FF&}}{speaker_tag}" if speaker_tag else ""
    event_text = f"{speaker_styled}{{\\c&HFFFFFF&}}{animated_text}"

    ass_content = f"""[Script Info]
Title: CineForge Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.601
PlayResX: {settings.VIDEO_WIDTH}
PlayResY: {settings.VIDEO_HEIGHT}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,28,&H00FFFFFF,&H0000FFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,1.5,2,50,50,44,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,{format_ass_time(start_sec)},{format_ass_time(end_sec)},Default,,0,0,0,,{event_text}
"""
    out_p.write_text(ass_content, encoding="utf-8")
    return out_p


def generate_title_card(
    title: str,
    subtitle: Optional[str] = None,
    duration: Optional[float] = None,
    dst_path: Optional[Path | str] = None
) -> Path:
    """
    Renders an animated opening title card video (HyperFrames style).
    - 24 fps CFR, 1280x720, YUV420p, no audio.
    - Deep cinematic slate background with 0.5s fade-in and 0.5s fade-out.
    - Golden studio banner & playful, high-contrast title typography.
    """
    dur = float(duration or settings.TITLE_CARD_DURATION_SEC)
    dst_p = Path(dst_path) if dst_path else Path("title_card.mp4")
    dst_p.parent.mkdir(parents=True, exist_ok=True)

    w, h, fps = settings.VIDEO_WIDTH, settings.VIDEO_HEIGHT, settings.VIDEO_FPS
    ass_path = dst_p.with_suffix(".ass")

    clean_title = _escape_ass_text((title or "CineForge Original").upper().strip())
    clean_sub = _escape_ass_text((subtitle or "A CineForge Original Production").strip())

    ass_content = f"""[Script Info]
Title: CineForge Title Card
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: {w}
PlayResY: {h}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Banner,Arial,20,&H004ED1FF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,4,0,1,2,1,5,20,20,180,1
Style: Title,Arial,42,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,1,0,1,3,2,5,30,30,0,1
Style: Subtitle,Arial,22,&H0099EEFF,&H000000FF,&H00000000,&H80000000,0,1,0,0,100,100,1,0,1,2,1,5,30,30,-120,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.30,{format_ass_time(dur - 0.3)},Banner,,0,0,160,,C I N E F O R G E   P R E S E N T S
Dialogue: 0,0:00:00.50,{format_ass_time(dur - 0.3)},Title,,0,0,0,,{{\\c&H004ED1FF}}{clean_title}
Dialogue: 0,0:00:00.70,{format_ass_time(dur - 0.3)},Subtitle,,0,0,-120,,{clean_sub}
"""
    ass_path.write_text(ass_content, encoding="utf-8")
    escaped_ass = ass_path.resolve().as_posix().replace(":", "\\\\:")

    fade_out_start = max(0.5, dur - 0.5)
    vf = f"ass={escaped_ass},fade=t=in:st=0:d=0.5,fade=t=out:st={fade_out_start:.2f}:d=0.5"

    cmd = _ff(
        "-f", "lavfi",
        "-i", f"color=c=0x0a1128:s={w}x{h}:d={dur:.3f}:r={fps}",
        "-vf", vf,
        "-t", f"{dur:.3f}",
        "-an",
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", str(settings.VIDEO_CRF),
        "-pix_fmt", "yuv420p",
        "-fps_mode", "cfr",
        str(dst_p)
    )
    _run(cmd)

    if ass_path.exists():
        try:
            ass_path.unlink()
        except Exception:
            pass

    return dst_p


def generate_credits_card(
    title: str,
    characters: Optional[List[str]] = None,
    duration: Optional[float] = None,
    dst_path: Optional[Path | str] = None
) -> Path:
    """
    Renders an animated closing credits card video (HyperFrames style).
    - 24 fps CFR, 1280x720, YUV420p, no audio.
    - Deep cinematic slate background with 0.5s fade-in and 0.5s fade-out.
    - "THE END", starring cast, and CineForge Studio credit.
    """
    dur = float(duration or settings.CREDITS_CARD_DURATION_SEC)
    dst_p = Path(dst_path) if dst_path else Path("credits_card.mp4")
    dst_p.parent.mkdir(parents=True, exist_ok=True)

    w, h, fps = settings.VIDEO_WIDTH, settings.VIDEO_HEIGHT, settings.VIDEO_FPS
    ass_path = dst_p.with_suffix(".ass")

    starring_line = ""
    if characters:
        valid_chars = [_escape_ass_text(c.strip()) for c in characters if c and c.strip()]
        if valid_chars:
            if len(valid_chars) == 1:
                starring_line = f"Starring {valid_chars[0]}"
            elif len(valid_chars) == 2:
                starring_line = f"Starring {valid_chars[0]} & {valid_chars[1]}"
            else:
                starring_line = f"Starring {', '.join(valid_chars[:-1])} & {valid_chars[-1]}"
    if not starring_line:
        starring_line = "A CineForge Story"

    ass_content = f"""[Script Info]
Title: CineForge Credits Card
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: {w}
PlayResY: {h}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: TheEnd,Arial,38,&H004ED1FF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,3,0,1,3,2,5,20,20,100,1
Style: Cast,Arial,22,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,1,0,1,2,1,5,30,30,0,1
Style: Studio,Arial,18,&H00B0B0B0,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,2,0,1,2,1,5,30,30,-100,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.30,{format_ass_time(dur - 0.3)},TheEnd,,0,0,100,,T H E   E N D
Dialogue: 0,0:00:00.50,{format_ass_time(dur - 0.3)},Cast,,0,0,0,,{starring_line}
Dialogue: 0,0:00:00.70,{format_ass_time(dur - 0.3)},Studio,,0,0,-100,,Created with CineForge Studio
"""
    ass_path.write_text(ass_content, encoding="utf-8")
    escaped_ass = ass_path.resolve().as_posix().replace(":", "\\\\:")

    fade_out_start = max(0.5, dur - 0.5)
    vf = f"ass={escaped_ass},fade=t=in:st=0:d=0.5,fade=t=out:st={fade_out_start:.2f}:d=0.5"

    cmd = _ff(
        "-f", "lavfi",
        "-i", f"color=c=0x070b19:s={w}x{h}:d={dur:.3f}:r={fps}",
        "-vf", vf,
        "-t", f"{dur:.3f}",
        "-an",
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", str(settings.VIDEO_CRF),
        "-pix_fmt", "yuv420p",
        "-fps_mode", "cfr",
        str(dst_p)
    )
    _run(cmd)

    if ass_path.exists():
        try:
            ass_path.unlink()
        except Exception:
            pass

    return dst_p


def build_normalize_cmd(
    src: Path | str,
    dst: Path | str,
    *,
    target_width: int = 1280,
    target_height: int = 720,
    target_fps: int = 24,
    target_duration: Optional[float] = None,
    actual_duration: Optional[float] = None,
    use_blurred_bg: bool = False,
    subtitle_file: Optional[Path | str] = None,
    include_audio: bool = False,
    audio_sample_rate: int = 48000
) -> list[str]:
    """
    Builds the FFmpeg command argument array for normalizing a clip.
    Strictly uses argument arrays (no shell string concatenation) per Agent.md.
    Normalizes to target resolution (1280x720), 24fps CFR, YUV420p.
    If actual_duration is shorter than target_duration by <= 1.5s, applies setpts slow-mo (max 1.25x).
    If use_blurred_bg is True (e.g. for portrait/non-16:9), fills canvas with blurred background.
    """
    w, h, fps = target_width, target_height, target_fps
    src_str = str(Path(src).resolve())
    dst_str = str(Path(dst).resolve())

    # PTS adjustment for slow-mo if slightly short
    setpts_expr = "PTS-STARTPTS"
    eff_duration = target_duration
    if target_duration is not None and actual_duration is not None and actual_duration > 0:
        short_by = target_duration - actual_duration
        if 0.0 < short_by <= 1.5:
            slow_factor = min(settings.MAX_SLOWMO_FACTOR, target_duration / actual_duration)
            setpts_expr = f"{slow_factor:.4f}*(PTS-STARTPTS)"
            eff_duration = min(target_duration, actual_duration * slow_factor)

    if use_blurred_bg:
        # Blurred background fill for non-16:9 / portrait clips
        filter_complex = (
            f"[0:v]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},boxblur=20:5[bg];"
            f"[0:v]scale={w}:{h}:force_original_aspect_ratio=decrease[fg];"
            f"[bg][fg]overlay=(W-w)/2:(H-h)/2,setpts={setpts_expr},fps={fps},setsar=1"
        )
        if subtitle_file and os.path.exists(str(subtitle_file)):
            sub_path = Path(subtitle_file).resolve().as_posix().replace(":", "\\\\:")
            filter_complex += f",ass={sub_path}"
        filter_complex += "[v]"

        cmd = [
            FFMPEG_BIN, "-y", "-hide_banner", "-loglevel", "error",
            "-i", src_str,
            "-filter_complex", filter_complex,
            "-map", "[v]"
        ]
        if include_audio:
            cmd += ["-map", "0:a?"]
    else:
        vf_filters = [
            f"scale={w}:{h}:force_original_aspect_ratio=increase",
            f"crop={w}:{h}",
            f"setpts={setpts_expr}",
            f"fps={fps}",
            "setsar=1"
        ]
        if subtitle_file and os.path.exists(str(subtitle_file)):
            sub_path = Path(subtitle_file).resolve().as_posix().replace(":", "\\\\:")
            vf_filters.append(f"ass={sub_path}")

        cmd = [
            FFMPEG_BIN, "-y", "-hide_banner", "-loglevel", "error",
            "-i", src_str,
            "-vf", ",".join(vf_filters)
        ]

    if eff_duration is not None:
        cmd += ["-t", f"{eff_duration:.3f}"]

    if include_audio:
        cmd += [
            "-c:a", "aac",
            "-ar", str(audio_sample_rate),
            "-ac", "2",
            "-af", "asetpts=PTS-STARTPTS"
        ]
    else:
        cmd += ["-an"]

    cmd += [
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", str(settings.VIDEO_CRF),
        "-pix_fmt", "yuv420p",
        "-fps_mode", "cfr",
        "-movflags", "+faststart",
        dst_str
    ]
    return cmd


def normalize_clip(
    src: Path | str,
    dst: Path | str,
    *,
    duration: Optional[float] = None,
    on_short: Optional[str] = None,
    subtitle_file: Optional[Path | str] = None,
    use_blurred_bg: bool = False
) -> dict:
    """
    Re-encode to constant 24 fps CFR, 1280x720, YUV420p, no audio.
    Uses each clip's real duration from ffprobe if duration is None or if not specified.
    Normalizes with scale+crop (or blurred background for portrait clips) instead of pad.
    Looping and padding are completely removed. If short by <= 1.5s, applies setpts slow-mo (max 1.25x).
    Raises ShotTooShortError if clip is shorter than requested duration by more than 1.5s.
    Burns subtitle_file if provided (HyperFrames animated subtitles).
    Returns {'duration': target_duration, 'padding_applied': None}.
    """
    src_path = Path(src)
    dst_path = Path(dst)

    info = probe(src_path)
    if not info.has_video:
        raise MediaProcessingError(f"{src_path} has no video stream")

    if info.duration <= 0.0:
        raise MediaProcessingError(f"{src_path} has zero or invalid duration ({info.duration}s)")

    target_duration = float(duration) if duration is not None else float(info.duration)
    short_by = target_duration - info.duration
    min_required_src = target_duration / settings.MAX_SLOWMO_FACTOR

    # If shorter than slow-mo limit allows, raise error
    if short_by > 1.5 or info.duration < (min_required_src - 0.01):
        raise ShotTooShortError(
            f"clip is {info.duration:.2f}s but shot needs {target_duration:.2f}s (min {min_required_src:.2f}s at {settings.MAX_SLOWMO_FACTOR}x slow-mo). Looping and padding are disabled."
        )

    # Detect if aspect ratio is portrait (< 1.0) or non-widescreen (< 1.6)
    aspect = (info.width / info.height) if (info.width and info.height) else 1.777
    blur_bg = use_blurred_bg or (aspect < 1.5)

    dst_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = build_normalize_cmd(
        src_path,
        dst_path,
        target_width=settings.VIDEO_WIDTH,
        target_height=settings.VIDEO_HEIGHT,
        target_fps=settings.VIDEO_FPS,
        target_duration=target_duration,
        actual_duration=info.duration,
        use_blurred_bg=blur_bg,
        subtitle_file=subtitle_file,
        include_audio=False
    )
    _run(cmd)

    out_info = probe(dst_path)
    return {"duration": round(out_info.duration, 3), "padding_applied": None}


def mux_shot(
    video_path: Path | str,
    audio_path: Optional[Path | str],
    dst_path: Path | str,
    duration: Optional[float] = None
) -> None:
    """
    Muxes a shot's normalized video with its shot voiceover audio.
    Audio is padded with apad to match the video duration exactly (never extending video).
    If no audio, silence is generated matching the video duration.
    """
    v_path = Path(video_path).resolve()
    dst = Path(dst_path).resolve()
    dst.parent.mkdir(parents=True, exist_ok=True)
    v_info = probe(v_path)
    vid_dur = duration if duration is not None else v_info.duration
    sr = settings.AUDIO_SAMPLE_RATE

    if audio_path and os.path.exists(str(audio_path)):
        a_path = Path(audio_path).resolve()
        ms = int(settings.SHOT_PRE_DELAY_SEC * 1000)
        af = (
            f"aresample={sr},aformat=channel_layouts=stereo,"
            f"adelay={ms}|{ms},apad,atrim=0:{vid_dur:.3f},"
            f"asetpts=PTS-STARTPTS"
        )
        cmd = _ff(
            "-i", str(v_path),
            "-i", str(a_path),
            "-map", "0:v:0",
            "-map", "1:a:0",
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", settings.AUDIO_BITRATE,
            "-ar", str(sr),
            "-ac", "2",
            "-af", af,
            "-t", f"{vid_dur:.3f}",
            "-movflags", "+faststart",
            str(dst)
        )
    else:
        cmd = _ff(
            "-i", str(v_path),
            "-f", "lavfi", "-t", f"{vid_dur:.3f}", "-i", f"anullsrc=r={sr}:cl=stereo",
            "-map", "0:v:0",
            "-map", "1:a:0",
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", settings.AUDIO_BITRATE,
            "-ar", str(sr),
            "-ac", "2",
            "-t", f"{vid_dur:.3f}",
            "-movflags", "+faststart",
            str(dst)
        )
    _run(cmd)


def concat(clips: list[Path | str], dst: Path | str, list_file: Path | str) -> None:
    """Join clips that were all produced by normalize_clip (identical params)."""
    list_path = Path(list_file)
    dst_path = Path(dst)
    dst_path.parent.mkdir(parents=True, exist_ok=True)
    list_path.parent.mkdir(parents=True, exist_ok=True)

    escaped_quote = "'\\''"
    lines = []
    for c in clips:
        resolved_str = str(Path(c).resolve()).replace("'", escaped_quote)
        lines.append(f"file '{resolved_str}'")
    list_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    
    _run(_ff("-f", "concat", "-safe", "0", "-i", str(list_path), "-c", "copy", str(dst_path)))


def build_audio_track(
    shots: list[Tuple[Optional[Path | str], float]],
    dst: Path | str,
    intro_pad_sec: float = 0.0,
    outro_pad_sec: float = 0.0
) -> None:
    """
    shots = [(audio_path_or_None, shot_duration)]. Each shot is delayed by the
    pre-delay, padded with silence to exactly its duration, then everything is
    joined, loudness-normalised and exported as 44.1 kHz stereo.
    intro_pad_sec and outro_pad_sec prepend/append silence for title and credits cards.
    """
    dst_path = Path(dst)
    dst_path.parent.mkdir(parents=True, exist_ok=True)

    all_segments: list[Tuple[Optional[Path | str], float, bool]] = []
    if intro_pad_sec > 0.001:
        all_segments.append((None, intro_pad_sec, False))
    for audio, dur in shots:
        all_segments.append((audio, dur, True))
    if outro_pad_sec > 0.001:
        all_segments.append((None, outro_pad_sec, False))

    sr = settings.AUDIO_SAMPLE_RATE
    args: list[str] = _ff()
    filters: list[str] = []
    labels: list[str] = []

    for i, (audio, dur, apply_pre_delay) in enumerate(all_segments):
        if audio is None or not os.path.exists(str(audio)):
            args += ["-f", "lavfi", "-t", f"{dur:.3f}", "-i", f"anullsrc=r={sr}:cl=stereo"]
            filters.append(f"[{i}:a]atrim=0:{dur:.3f}[a{i}]")
        else:
            args += ["-i", str(Path(audio).resolve())]
            ms = int(settings.SHOT_PRE_DELAY_SEC * 1000) if apply_pre_delay else 0
            filters.append(
                f"[{i}:a]aresample={sr},aformat=channel_layouts=stereo,"
                f"adelay={ms}|{ms},apad=whole_dur={dur:.3f},atrim=0:{dur:.3f},"
                f"asetpts=N/SR/TB[a{i}]"
            )
        labels.append(f"[a{i}]")

    raw_concat_path = dst_path.with_name(f"{dst_path.stem}_raw_concat{dst_path.suffix}")

    filters.append(
        "".join(labels) + f"concat=n={len(all_segments)}:v=0:a=1,aresample={sr}[out]"
    )

    cmd = args + [
        "-filter_complex", ";".join(filters),
        "-map", "[out]",
        "-ar", str(sr),
        "-ac", "2",
        str(raw_concat_path)
    ]
    _run(cmd)

    # Two-pass loudnorm guarantees accurate -16 LUFS even on sparse dialogue + intro/outro silence
    try:
        import re
        pass1_cmd = [
            FFMPEG_BIN, "-hide_banner", "-i", str(raw_concat_path),
            "-af", f"loudnorm=I={settings.TARGET_LUFS}:TP={settings.TARGET_TRUE_PEAK}:LRA=11:print_format=json",
            "-f", "null", "-"
        ]
        p1 = subprocess.run(pass1_cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=settings.FFMPEG_TIMEOUT_SEC)
        json_match = re.search(r"\{[\s\S]*?\"input_i\"[\s\S]*?\}", p1.stderr)
        if json_match:
            stats = json.loads(json_match.group(0))
            input_i = str(stats.get("input_i", "-inf")).strip()
            if input_i != "-inf" and float(input_i) > -65.0:
                af2 = (
                    f"loudnorm=I={settings.TARGET_LUFS}:TP={settings.TARGET_TRUE_PEAK}:LRA=11:"
                    f"measured_I={stats['input_i']}:measured_TP={stats['input_tp']}:"
                    f"measured_LRA={stats['input_lra']}:measured_thresh={stats['input_thresh']}:"
                    f"offset={stats['target_offset']}:linear=true,aresample={sr}"
                )
                _run(_ff("-i", str(raw_concat_path), "-af", af2, "-ar", str(sr), "-ac", "2", str(dst_path)))
                return
        # Fallback if track is completely silent or measurement unavailable
        shutil.move(str(raw_concat_path), str(dst_path))
    finally:
        if raw_concat_path.exists():
            try:
                raw_concat_path.unlink()
            except Exception:
                pass


def normalize_master_loudness(src: Path | str, dst: Path | str) -> None:
    """Two-pass EBU R128 loudness normalization (-16 LUFS) on a muxed video while copying video."""
    import re
    src_path = Path(src).resolve()
    dst_path = Path(dst).resolve()
    dst_path.parent.mkdir(parents=True, exist_ok=True)
    sr = settings.AUDIO_SAMPLE_RATE

    pass1_cmd = [
        FFMPEG_BIN, "-hide_banner", "-i", str(src_path),
        "-vn", "-af", f"loudnorm=I={settings.TARGET_LUFS}:TP={settings.TARGET_TRUE_PEAK}:LRA=11:print_format=json",
        "-f", "null", "-"
    ]
    p1 = subprocess.run(pass1_cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=settings.FFMPEG_TIMEOUT_SEC)
    json_match = re.search(r"\{[\s\S]*?\"input_i\"[\s\S]*?\}", p1.stderr)
    if json_match:
        stats = json.loads(json_match.group(0))
        input_i = str(stats.get("input_i", "-inf")).strip()
        if input_i != "-inf" and float(input_i) > -65.0:
            af2 = (
                f"loudnorm=I={settings.TARGET_LUFS}:TP={settings.TARGET_TRUE_PEAK}:LRA=11:"
                f"measured_I={stats['input_i']}:measured_TP={stats['input_tp']}:"
                f"measured_LRA={stats['input_lra']}:measured_thresh={stats['input_thresh']}:"
                f"offset={stats['target_offset']}:linear=true,aresample={sr}"
            )
            _run(_ff(
                "-i", str(src_path),
                "-c:v", "copy",
                "-af", af2,
                "-c:a", "aac",
                "-b:a", settings.AUDIO_BITRATE,
                "-ar", str(sr),
                "-ac", "2",
                "-movflags", "+faststart",
                str(dst_path)
            ))
            return
    shutil.copyfile(src_path, dst_path)


def mux(video: Path | str, audio: Path | str, dst: Path | str) -> None:
    """Combine video and audio. Refuses to hide a length mismatch."""
    v_path = Path(video)
    a_path = Path(audio)
    dst_path = Path(dst)
    dst_path.parent.mkdir(parents=True, exist_ok=True)

    v, a = probe(v_path), probe(a_path)
    if abs(v.duration - a.duration) > settings.DURATION_TOLERANCE_SEC:
        raise DurationMismatchError(
            f"video {v.duration:.2f}s vs audio {a.duration:.2f}s (diff {abs(v.duration - a.duration):.2f}s > {settings.DURATION_TOLERANCE_SEC}s)"
        )

    _run(_ff(
        "-i", str(v_path),
        "-i", str(a_path),
        "-map", "0:v:0",
        "-map", "1:a:0",
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", settings.AUDIO_BITRATE,
        "-ar", str(settings.AUDIO_SAMPLE_RATE),
        "-ac", "2",
        "-movflags", "+faststart",
        str(dst_path)
    ))


def verify_film(master_path: Path | str) -> dict:
    """
    Runs the Section 7 verification checks on a rendered master.mp4 film:
    1. Video and audio durations match within DURATION_TOLERANCE_SEC
    2. Constant frame rate (avg and r_frame_rate == VIDEO_FPS/1)
    3. Timestamps: min and max frame gaps around 1/VIDEO_FPS (0.0417s)
    4. Loudness: integrated around TARGET_LUFS (-16 LUFS, accept -17.5 to -14.5), true peak <= -1 dBTP
    5. Audio format: 44100 Hz, 2 channels
    6. Freeze check: freezes longer than 1.5s
    """
    m_path = str(Path(master_path).resolve())
    results: Dict[str, Any] = {
        "passed": True,
        "checks": {},
        "errors": []
    }

    # 1. Probe streams and durations
    probe_out = _run([
        FFPROBE_BIN, "-v", "error", "-print_format", "json",
        "-show_format", "-show_streams", m_path
    ])
    probe_data = json.loads(probe_out.stdout)
    streams = probe_data.get("streams", [])
    video_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
    audio_stream = next((s for s in streams if s.get("codec_type") == "audio"), None)

    if not video_stream or not audio_stream:
        results["passed"] = False
        results["errors"].append("Missing video or audio stream in master.mp4")
        return results

    v_dur = float(video_stream.get("duration", probe_data["format"].get("duration", 0)))
    a_dur = float(audio_stream.get("duration", probe_data["format"].get("duration", 0)))
    dur_diff = abs(v_dur - a_dur)
    dur_pass = dur_diff <= settings.DURATION_TOLERANCE_SEC
    results["checks"]["duration"] = {
        "passed": dur_pass,
        "video_duration": v_dur,
        "audio_duration": a_dur,
        "difference": round(dur_diff, 4),
        "tolerance": settings.DURATION_TOLERANCE_SEC
    }
    if not dur_pass:
        results["passed"] = False
        results["errors"].append(f"Duration mismatch: video {v_dur:.2f}s vs audio {a_dur:.2f}s (diff {dur_diff:.4f}s)")

    # 2. Frame rate: r_frame_rate and avg_frame_rate
    r_fps = video_stream.get("r_frame_rate", "")
    avg_fps = video_stream.get("avg_frame_rate", "")
    expected_fps_str = f"{settings.VIDEO_FPS}/1"
    fps_pass = (r_fps == expected_fps_str and avg_fps == expected_fps_str)
    results["checks"]["frame_rate"] = {
        "passed": fps_pass,
        "r_frame_rate": r_fps,
        "avg_frame_rate": avg_fps,
        "expected": expected_fps_str
    }
    if not fps_pass:
        results["passed"] = False
        results["errors"].append(f"Frame rate mismatch: r={r_fps}, avg={avg_fps}, expected={expected_fps_str}")

    # 3. Timestamps: pts_time intervals
    ts_cmd = [
        FFPROBE_BIN, "-v", "error", "-select_streams", "v",
        "-show_entries", "frame=pts_time", "-of", "csv=p=0", m_path
    ]
    ts_out = _run(ts_cmd)
    pts_lines = []
    for line in ts_out.stdout.strip().splitlines():
        cleaned = line.strip().rstrip(",")
        if cleaned:
            try:
                pts_lines.append(float(cleaned))
            except ValueError:
                pass
    if len(pts_lines) > 1:
        gaps = [round(b - a, 4) for a, b in zip(pts_lines, pts_lines[1:])]
        min_gap = min(gaps)
        max_gap = max(gaps)
        expected_gap = round(1.0 / settings.VIDEO_FPS, 4)
        # Check within 0.005s tolerance
        ts_pass = (abs(min_gap - expected_gap) <= 0.005 and abs(max_gap - expected_gap) <= 0.005)
        results["checks"]["timestamps"] = {
            "passed": ts_pass,
            "min_gap": min_gap,
            "max_gap": max_gap,
            "expected_gap": expected_gap
        }
        if not ts_pass:
            results["passed"] = False
            results["errors"].append(f"Timestamp irregularity: min gap={min_gap}s, max gap={max_gap}s, expected={expected_gap}s")
    else:
        results["checks"]["timestamps"] = {"passed": False, "error": "Not enough frames to check timestamps"}
        results["passed"] = False

    # 4. Loudness: ebur128=peak=true
    ebur_cmd = [
        FFMPEG_BIN, "-hide_banner", "-i", m_path,
        "-af", "ebur128=peak=true", "-f", "null", "-"
    ]
    ebur_proc = subprocess.run(ebur_cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=60)
    ebur_output = ebur_proc.stderr
    import re
    i_match = re.search(r"Integrated loudness:\s+I:\s+([-\d\.]+)\s+LUFS", ebur_output)
    tp_match = re.search(r"True peak:\s+Peak:\s+([-\d\.]+)\s+dBFS", ebur_output)

    integrated_lufs = float(i_match.group(1)) if i_match else None
    true_peak = float(tp_match.group(1)) if tp_match else None

    # Target: -17.5 to -14.5 LUFS, true peak <= -1.0 dBTP
    lufs_pass = integrated_lufs is not None and (-17.5 <= integrated_lufs <= -14.5)
    tp_pass = true_peak is not None and (true_peak <= -1.0)
    loudness_pass = lufs_pass and tp_pass
    results["checks"]["loudness"] = {
        "passed": loudness_pass,
        "integrated_lufs": integrated_lufs,
        "true_peak": true_peak,
        "target_lufs_range": [-17.5, -14.5],
        "target_tp_max": -1.0
    }
    if not loudness_pass:
        results["passed"] = False
        results["errors"].append(f"Loudness check failed: I={integrated_lufs} LUFS, TP={true_peak} dBTP")

    # 5. Audio format: 44100 Hz, 2 channels
    sample_rate = int(audio_stream.get("sample_rate", 0))
    channels = int(audio_stream.get("channels", 0))
    audio_pass = (sample_rate == settings.AUDIO_SAMPLE_RATE and channels == 2)
    results["checks"]["audio_format"] = {
        "passed": audio_pass,
        "sample_rate": sample_rate,
        "channels": channels,
        "expected_sample_rate": settings.AUDIO_SAMPLE_RATE,
        "expected_channels": 2
    }
    if not audio_pass:
        results["passed"] = False
        results["errors"].append(f"Audio format check failed: {sample_rate}Hz, {channels}ch (expected {settings.AUDIO_SAMPLE_RATE}Hz, 2ch)")

    # 6. Freeze check: freezedetect=n=-60dB:d=1.5
    freeze_cmd = [
        FFMPEG_BIN, "-hide_banner", "-i", m_path,
        "-vf", "freezedetect=n=-60dB:d=1.5", "-an", "-f", "null", "-"
    ]
    freeze_proc = subprocess.run(freeze_cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=60)
    if freeze_proc.returncode != 0:
        results["passed"] = False
        results["errors"].append(f"Freeze detection command failed: {freeze_proc.stderr[-300:]}")
        results["checks"]["freezes"] = {"passed": False, "error": freeze_proc.stderr[-300:]}
    else:
        freezes = re.findall(r"freeze_start:\s+([-\d\.]+)", freeze_proc.stderr)
        freeze_pass = len(freezes) == 0
        results["checks"]["freezes"] = {
            "passed": freeze_pass,
            "freeze_count": len(freezes),
            "freeze_starts": freezes
        }
        if not freeze_pass:
            results["passed"] = False
            results["errors"].append(f"Freeze check failed: detected {len(freezes)} frozen segment(s) > 1.5s")

    return results
