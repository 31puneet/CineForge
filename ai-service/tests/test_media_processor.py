"""
Unit tests for CineForge media processor and video pipeline.
Tests Section 6 of CineForge Fix Spec.
"""
from pathlib import Path
import pytest

from core.config import settings
from core.media_processor import (
    probe,
    normalize_clip,
    build_normalize_cmd,
    mux_shot,
    concat,
    build_audio_track,
    mux,
    compute_shot_duration,
    format_ass_time,
    estimate_word_timings,
    verify_film,
    create_shot_subtitles_ass,
    generate_title_card,
    generate_credits_card,
    MediaProcessingError,
    ShotTooShortError,
    DurationMismatchError,
    FFPROBE_BIN,
    _ff,
    _run
)
import math
from agents.graph import validate_and_split_dialogue, PROVIDER_CLIP_SECONDS
from core.media_validator import (
    MediaValidator,
    detect_freezes,
    detect_shot_loops,
    detect_duplicate_shots
)
from core.providers import VoiceStudioAudioAdapter
from core.video_generator import QuotaExceededError


@pytest.fixture
def make_test_video():
    """Helper to generate a lightweight lavfi video clip."""
    def _create(dst: Path, duration: float = 4.0, fps: int = 16, width: int = 640, height: int = 360):
        cmd = _ff(
            "-f", "lavfi",
            "-i", f"testsrc=duration={duration}:size={width}x{height}:rate={fps}",
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            str(dst)
        )
        _run(cmd)
        return dst
    return _create


@pytest.fixture
def make_test_audio():
    """Helper to generate a lightweight sine audio clip."""
    def _create(dst: Path, duration: float = 5.0, freq: int = 440):
        cmd = _ff(
            "-f", "lavfi",
            "-i", f"sine=frequency={freq}:duration={duration}",
            "-c:a", "libmp3lame",
            str(dst)
        )
        _run(cmd)
        return dst
    return _create


def test_probe(tmp_path, make_test_video):
    clip = tmp_path / "probe_test.mp4"
    make_test_video(clip, duration=4.0, fps=16, width=640, height=360)
    
    info = probe(clip)
    assert info.has_video is True
    assert info.has_audio is False
    assert info.width == 640
    assert info.height == 360
    assert abs(info.duration - 4.0) < 0.2
    assert info.fps == 16.0


def test_normalize_clip(tmp_path, make_test_video):
    src = tmp_path / "norm_src.mp4"
    dst = tmp_path / "norm_dst.mp4"
    make_test_video(src, duration=5.0, fps=16, width=640, height=360)

    result = normalize_clip(src, dst, duration=4.0)
    assert dst.exists()
    assert result.get("padding_applied") is None

    info = probe(dst)
    assert info.has_video is True
    assert info.has_audio is False
    assert info.width == settings.VIDEO_WIDTH
    assert info.height == settings.VIDEO_HEIGHT
    assert abs(info.duration - 4.0) <= settings.DURATION_TOLERANCE_SEC

    # Check constant frame rate
    out = _run([
        FFPROBE_BIN, "-v", "error", "-select_streams", "v",
        "-show_entries", "stream=r_frame_rate,avg_frame_rate",
        "-of", "default=noprint_wrappers=1:nokey=1", str(dst)
    ])
    lines = out.stdout.strip().splitlines()
    assert lines[0] == f"{settings.VIDEO_FPS}/1"
    assert lines[1] == f"{settings.VIDEO_FPS}/1"


def test_short_clip_policies(tmp_path, make_test_video):
    src = tmp_path / "short_src.mp4"
    make_test_video(src, duration=4.0)
    target_dur = 12.0

    # 1. When clip is shorter than requested duration: raises ShotTooShortError (no looping or padding)
    fail_dst = tmp_path / "fail_dst.mp4"
    with pytest.raises(ShotTooShortError):
        normalize_clip(src, fail_dst, duration=target_dur)

    # 2. When duration is None or omitted: uses clip's real duration from ffprobe
    real_dst = tmp_path / "real_dst.mp4"
    res_real = normalize_clip(src, real_dst)
    assert res_real["padding_applied"] is None
    info_real = probe(real_dst)
    assert abs(info_real.duration - 4.0) <= settings.DURATION_TOLERANCE_SEC
    assert info_real.width == settings.VIDEO_WIDTH
    assert info_real.height == settings.VIDEO_HEIGHT


def test_mixed_input_rates_concat(tmp_path, make_test_video):
    clip16 = tmp_path / "c16.mp4"
    clip30 = tmp_path / "c30.mp4"
    make_test_video(clip16, duration=2.0, fps=16)
    make_test_video(clip30, duration=2.0, fps=30)

    norm1 = tmp_path / "norm1.mp4"
    norm2 = tmp_path / "norm2.mp4"
    normalize_clip(clip16, norm1, duration=2.0)
    normalize_clip(clip30, norm2, duration=2.0)

    concat_out = tmp_path / "concat_mixed.mp4"
    list_file = tmp_path / "list.txt"
    concat([norm1, norm2], concat_out, list_file)

    info = probe(concat_out)
    assert abs(info.duration - 4.0) <= settings.DURATION_TOLERANCE_SEC

    # Check PTS frame intervals: every gap must be ~1/VIDEO_FPS (0.0417s)
    ts_cmd = [
        FFPROBE_BIN, "-v", "error", "-select_streams", "v",
        "-show_entries", "frame=pts_time", "-of", "csv=p=0", str(concat_out)
    ]
    ts_out = _run(ts_cmd)
    pts = [float(x.strip().rstrip(",")) for x in ts_out.stdout.strip().splitlines() if x.strip().rstrip(",")]
    gaps = [round(b - a, 4) for a, b in zip(pts, pts[1:])]
    expected_gap = round(1.0 / settings.VIDEO_FPS, 4)

    assert min(gaps) >= expected_gap - 0.005
    assert max(gaps) <= expected_gap + 0.005


def test_build_audio_track(tmp_path, make_test_audio):
    audio1 = tmp_path / "voice1.mp3"
    make_test_audio(audio1, duration=3.0)

    # Shot 1: audio exists (needs 6s total duration)
    # Shot 2: None audio (needs 4s total duration)
    shots = [
        (audio1, 6.0),
        (None, 4.0)
    ]
    total_expected = 10.0
    out_wav = tmp_path / "master_audio.wav"

    build_audio_track(shots, out_wav)
    assert out_wav.exists()

    info = probe(out_wav)
    assert info.has_audio is True
    assert abs(info.duration - total_expected) <= settings.DURATION_TOLERANCE_SEC


def test_mux_duration_mismatch(tmp_path, make_test_video, make_test_audio):
    v = tmp_path / "short_v.mp4"
    a = tmp_path / "long_a.mp3"
    make_test_video(v, duration=4.0)
    make_test_audio(a, duration=10.0)

    dst = tmp_path / "mismatch.mp4"
    with pytest.raises(DurationMismatchError):
        mux(v, a, dst)


def test_corrupt_or_empty_clip(tmp_path):
    empty = tmp_path / "empty.mp4"
    empty.write_text("not a real video file", encoding="utf-8")

    dst = tmp_path / "out.mp4"
    with pytest.raises(MediaProcessingError):
        normalize_clip(empty, dst, duration=4.0)


def test_compute_shot_duration():
    # Case 1: Script 10s with 12s audio -> 12 + 0.5 + 1.5 = 14.0s
    dur1 = compute_shot_duration(10.0, 12.0)
    assert dur1 == 14.0

    # Case 2: Script 10s with 3s audio -> 3 + 0.5 + 1.5 = 5.0s -> max(10, 5) = 10.0s
    dur2 = compute_shot_duration(10.0, 3.0)
    assert dur2 == 10.0

    # Case 3: Script 10s with None audio -> 10.0s
    dur3 = compute_shot_duration(10.0, None)
    assert dur3 == 10.0


def test_quota_error_handling():
    # QuotaExceededError is explicitly raised and distinguishable from general RuntimeError
    err = QuotaExceededError("You have exceeded your ZeroGPU quota (120s requested vs. 27s left).")
    assert isinstance(err, RuntimeError)
    assert "ZeroGPU quota" in str(err)


def test_format_ass_time():
    assert format_ass_time(0.0) == "0:00:00.00"
    assert format_ass_time(1.25) == "0:00:01.25"
    assert format_ass_time(65.5) == "0:01:05.50"
    assert format_ass_time(3600.0) == "1:00:00.00"


def test_estimate_word_timings():
    text = "Hello Appu! Let's explore the jungle."
    timings = estimate_word_timings(text, total_audio_duration=4.0, start_offset=0.5)
    assert len(timings) == 6
    assert timings[0]["word"] == "Hello"
    assert timings[0]["start"] == 0.5
    assert timings[-1]["word"] == "jungle."
    assert all(t["duration_cs"] > 0 for t in timings)


def test_create_shot_subtitles_ass(tmp_path):
    sub_file = tmp_path / "shot1.ass"
    res_path = create_shot_subtitles_ass(
        dialogue="Look at that tall mango tree!",
        speaker="Appu",
        duration=6.0,
        out_path=sub_file
    )
    assert res_path.exists()
    content = sub_file.read_text(encoding="utf-8")
    assert "[Script Info]" in content
    assert "APPU:" in content
    assert r"{\c&H00D7FF&}" in content  # Golden yellow speaker color
    assert r"\kf" in content             # Karaoke timing tag


def test_generate_title_card(tmp_path):
    card_path = tmp_path / "title_card.mp4"
    res = generate_title_card(
        title="Appu & Chintu Adventure",
        subtitle="A Tale of Two Best Friends",
        duration=3.5,
        dst_path=card_path
    )
    assert res.exists()
    info = probe(card_path)
    assert info.has_video is True
    assert info.has_audio is False
    assert info.width == settings.VIDEO_WIDTH
    assert info.height == settings.VIDEO_HEIGHT
    assert abs(info.duration - 3.5) <= settings.DURATION_TOLERANCE_SEC


def test_generate_credits_card(tmp_path):
    credits_path = tmp_path / "credits_card.mp4"
    res = generate_credits_card(
        title="Appu & Chintu Adventure",
        characters=["Appu the Baby Elephant", "Chintu the Tiger Cub"],
        duration=3.0,
        dst_path=credits_path
    )
    assert res.exists()
    info = probe(credits_path)
    assert info.has_video is True
    assert info.has_audio is False
    assert abs(info.duration - 3.0) <= settings.DURATION_TOLERANCE_SEC


def test_normalize_clip_with_subtitles(tmp_path, make_test_video):
    src = tmp_path / "src_sub.mp4"
    dst = tmp_path / "dst_sub.mp4"
    sub = tmp_path / "test.ass"
    make_test_video(src, duration=5.0)

    create_shot_subtitles_ass(
        dialogue="We found the golden banana!",
        speaker="Chintu",
        duration=5.0,
        out_path=sub
    )

    normalize_clip(src, dst, duration=5.0, subtitle_file=sub)
    assert dst.exists()
    info = probe(dst)
    assert info.has_video is True
    assert abs(info.duration - 5.0) <= settings.DURATION_TOLERANCE_SEC


def test_build_audio_track_with_intro_outro_padding(tmp_path, make_test_audio):
    a1 = tmp_path / "a1.mp3"
    make_test_audio(a1, duration=3.0)

    shots = [(a1, 5.0)]
    out_audio = tmp_path / "padded_audio.wav"
    # 3.5s intro pad + 5.0s shot + 3.0s outro pad = 11.5s total
    build_audio_track(shots, out_audio, intro_pad_sec=3.5, outro_pad_sec=3.0)

    assert out_audio.exists()
    info = probe(out_audio)
    assert abs(info.duration - 11.5) <= settings.DURATION_TOLERANCE_SEC


def test_voicestudio_adapter():
    adapter = VoiceStudioAudioAdapter()
    match_appu = adapter.match_character_voice("Appu", description="A happy baby elephant")
    assert "baby elephant" in match_appu["voice_prompt"].lower() or "appu" in match_appu["label"].lower()

    match_chintu = adapter.match_character_voice("Chintu", description="playful tiger cub")
    assert "tiger" in match_chintu["voice_prompt"].lower() or "chintu" in match_chintu["label"].lower()



# ==========================================
# New Tests for Spec Tasks 1, 3, 4, 6
# ==========================================

def test_shot_count_math_and_dialogue_splitting():
    # 1. Shot count math: ceil(duration / PROVIDER_CLIP_SECONDS)
    target_duration = 60.0
    expected_shots = math.ceil(target_duration / PROVIDER_CLIP_SECONDS)
    assert expected_shots == math.ceil(60.0 / settings.PROVIDER_CLIP_SECONDS)

    # 2. Dialogue splitting check: max ~2.5 words per second reserving pre/post margin
    shots = [
        {"shot_id": "shot_1", "duration_seconds": 6.0, "dialogue": "One two three four five six seven eight nine ten eleven twelve thirteen fourteen", "speaker": "Alex"},
        {"shot_id": "shot_2", "duration_seconds": 6.0, "dialogue": "", "speaker": "Alex"}
    ]
    split_shots = validate_and_split_dialogue(shots, max_wps=2.5)
    # (6.0 - 2.0) * 2.5 = 10 words max in shot_1
    words_s1 = split_shots[0]["dialogue"].split()
    assert len(words_s1) <= 10
    words_s2 = split_shots[1]["dialogue"].split()
    assert len(words_s2) > 0

    # 3. Speaker change or final-shot overflow must raise ValueError instead of dropping dialogue
    cross_speaker = [
        {"shot_id": "shot_1", "duration_seconds": 4.0, "dialogue": " ".join([f"w{i}" for i in range(15)]), "speaker": "Alex"},
        {"shot_id": "shot_2", "duration_seconds": 4.0, "dialogue": "", "speaker": "Bob"}
    ]
    with pytest.raises(ValueError):
        validate_and_split_dialogue(cross_speaker, max_wps=2.5)

    last_shot_overflow = [
        {"shot_id": "shot_1", "duration_seconds": 4.0, "dialogue": " ".join([f"w{i}" for i in range(15)]), "speaker": "Alex"}
    ]
    with pytest.raises(ValueError):
        validate_and_split_dialogue(last_shot_overflow, max_wps=2.5)


def test_build_normalize_cmd():
    cmd = build_normalize_cmd(
        src="input.mp4",
        dst="output.mp4",
        target_width=1280,
        target_height=720,
        target_fps=24,
        target_duration=8.0,
        actual_duration=7.0,  # 1.0s short -> applies <= 1.25x slow-mo
        use_blurred_bg=False,
        include_audio=False
    )
    assert isinstance(cmd, list)
    # Check resolution, fps, aspect ratio and arguments
    cmd_str = " ".join(cmd)
    assert "scale=1280:720" in cmd_str
    assert "crop=1280:720" in cmd_str
    assert "fps=24" in cmd_str
    assert "setpts=" in cmd_str
    assert "-an" in cmd

    # Test blurred background command for portrait
    blur_cmd = build_normalize_cmd(
        src="input.mp4",
        dst="output.mp4",
        use_blurred_bg=True
    )
    blur_str = " ".join(blur_cmd)
    assert "boxblur=" in blur_str
    assert "overlay=" in blur_str


def test_media_validator_compliant_clip(tmp_path, make_test_video):
    # Create compliant clip: 1280x720, 24fps, 4.0s
    test_clip = tmp_path / "compliant.mp4"
    make_test_video(test_clip, duration=4.0, fps=24, width=1280, height=720)

    validator = MediaValidator(target_width=1280, target_height=720, target_fps=24, duration_tolerance=0.2)
    res = validator.validate_clip(test_clip, expected_duration=4.0)
    assert res.passed is True
    assert len(res.errors) == 0


def test_media_validator_detects_freeze(tmp_path):
    # Create video with a 2-second frozen frame
    frozen_clip = tmp_path / "frozen.mp4"
    cmd = _ff(
        "-f", "lavfi",
        "-i", "color=c=black:s=1280x720:d=2.5:r=24",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        str(frozen_clip)
    )
    _run(cmd)

    freezes = detect_freezes(frozen_clip, min_duration=1.0)
    assert len(freezes) > 0


def test_media_validator_detects_loops(tmp_path):
    # Create a 6s clip made of two identical 3s loops
    part1 = tmp_path / "part1.mp4"
    cmd1 = _ff(
        "-f", "lavfi",
        "-i", "testsrc=duration=3:size=64x36:rate=1",
        "-c:v", "libx264",
        str(part1)
    )
    _run(cmd1)

    # Concat part1 with itself to create exact loop at 3s offset
    looped = tmp_path / "looped.mp4"
    list_f = tmp_path / "concat.txt"
    list_f.write_text(f"file '{part1.resolve()}'\nfile '{part1.resolve()}'\n")
    _run(_ff("-f", "concat", "-safe", "0", "-i", str(list_f), "-c", "copy", str(looped)))

    loops = detect_shot_loops(looped, min_offset=2, max_offset=4, diff_threshold=3.0)
    assert len(loops) > 0


def test_ass_text_escaping(tmp_path):
    sub_file = tmp_path / "escaped.ass"
    create_shot_subtitles_ass(
        dialogue=r"Look {at}\nthis",
        speaker="A{lex}",
        duration=5.0,
        out_path=sub_file
    )
    content = sub_file.read_text(encoding="utf-8")
    assert r"\{at\}" in content
    assert r"A\{LEX\}:" in content


def test_slowmo_limit_raises_shot_too_short(tmp_path, make_test_video):
    src = tmp_path / "clip4.mp4"
    dst = tmp_path / "out.mp4"
    make_test_video(src, duration=4.0)
    # 4.0s * 1.25 = 5.0s max; requesting 5.5s exceeds MAX_SLOWMO_FACTOR even though diff is 1.5s
    with pytest.raises(ShotTooShortError):
        normalize_clip(src, dst, duration=5.5)


def test_mux_shot_and_verify_film_freeze_failure(tmp_path, make_test_audio):
    frozen_vid = tmp_path / "frozen_master.mp4"
    _run(_ff(
        "-f", "lavfi",
        "-i", "color=c=black:s=1280x720:d=3.0:r=24",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-fps_mode", "cfr",
        str(frozen_vid)
    ))
    aud = tmp_path / "aud.mp3"
    make_test_audio(aud, duration=2.0)
    muxed = tmp_path / "muxed_master.mp4"
    mux_shot(frozen_vid, aud, muxed, duration=3.0)
    assert muxed.exists()

    qc = verify_film(muxed)
    assert qc["checks"]["freezes"]["passed"] is False
    assert qc["passed"] is False


def test_duplicate_shots_and_validate_film(tmp_path, make_test_video, make_test_audio):
    shot_a = tmp_path / "shot_a.mp4"
    make_test_video(shot_a, duration=3.0, fps=24, width=1280, height=720)
    # Passing identical shot path twice must be detected as duplicate, not collapsed by path key
    dups = detect_duplicate_shots([shot_a, shot_a], diff_threshold=3.0)
    assert len(dups) == 1

    aud = tmp_path / "aud.mp3"
    make_test_audio(aud, duration=2.0)
    master = tmp_path / "master.mp4"
    mux_shot(shot_a, aud, master, duration=3.0)

    validator = MediaValidator(target_width=1280, target_height=720, target_fps=24, duration_tolerance=0.2)
    res = validator.validate_film(master, expected_duration=3.0, shot_paths=[shot_a], title_card_duration=0.0, credits_card_duration=0.0)
    assert res.passed is True

