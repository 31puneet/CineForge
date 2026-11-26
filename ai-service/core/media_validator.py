import re
import json
import subprocess
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Optional, Any

from core.config import settings
from core.media_processor import FFMPEG_BIN, probe

@dataclass
class ValidationResult:
    passed: bool
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    metrics: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)


def detect_black_bars(video_path: Path | str, sample_seconds: float = 5.0) -> bool:
    """
    Checks if a video has persistent black bars (letterboxing/pillarboxing) using cropdetect.
    Returns True if black bars are detected.
    """
    v_path = str(Path(video_path).resolve())
    info = probe(v_path)
    seek_pos = "0" if info.duration < 1.5 else "00:00:01"
    cmd = [
        FFMPEG_BIN, "-hide_banner", "-ss", seek_pos, "-t", f"{sample_seconds:.1f}",
        "-i", v_path,
        "-vf", "cropdetect=24:16:0",
        "-f", "null", "-"
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if proc.returncode != 0:
        raise RuntimeError(f"cropdetect failed for {v_path}: {proc.stderr[-500:]}")
    matches = re.findall(r"crop=(\d+):(\d+):(\d+):(\d+)", proc.stderr)
    if matches:
        crops = [(int(w), int(h)) for w, h, _, _ in matches[-10:]]
        if crops:
            avg_w = sum(w for w, _ in crops) / len(crops)
            avg_h = sum(h for _, h in crops) / len(crops)
            ref_w = info.width or settings.TARGET_WIDTH
            ref_h = info.height or settings.TARGET_HEIGHT
            if avg_w < (ref_w * 0.92) or avg_h < (ref_h * 0.92):
                return True
    return False


def detect_freezes(video_path: Path | str, min_duration: float = 1.0, ignore_start: float = 0.0, ignore_end: float = 0.0) -> list[dict]:
    """
    Detects frozen video sections longer than min_duration using ffmpeg freezedetect.
    Sections completely inside [0, ignore_start] or [total_dur - ignore_end, total_dur] are ignored
    (e.g., intentional title cards or credits cards).
    """
    v_path = str(Path(video_path).resolve())
    info = probe(v_path)
    total_dur = info.duration

    cmd = [
        FFMPEG_BIN, "-hide_banner",
        "-i", v_path,
        "-vf", f"freezedetect=n=-60dB:d={min_duration:.2f}",
        "-f", "null", "-"
    ]
    freezes = []
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    if proc.returncode != 0:
        raise RuntimeError(f"freezedetect failed for {v_path}: {proc.stderr[-500:]}")
    start_matches = [float(x) for x in re.findall(r"freeze_start:\s*([-\d.]+)", proc.stderr)]
    end_matches = [float(x) for x in re.findall(r"freeze_end:\s*([-\d.]+)", proc.stderr)]
    dur_matches = [float(x) for x in re.findall(r"freeze_duration:\s*([-\d.]+)", proc.stderr)]

    for i, s in enumerate(start_matches):
        if i < len(end_matches):
            end = end_matches[i]
            d = dur_matches[i] if i < len(dur_matches) else (end - s)
        else:
            end = total_dur
            d = total_dur - s

        if d < min_duration:
            continue

        if ignore_start > 0 and end <= (ignore_start + 0.1):
            continue
        if ignore_end > 0 and s >= (total_dur - ignore_end - 0.1):
            continue

        freezes.append({"start": round(s, 2), "duration": round(d, 2), "end": round(end, 2)})
    return freezes


def extract_downscaled_frames(video_path: Path | str, fps: int = 1, width: int = 64, height: int = 36) -> list[bytes]:
    """
    Extracts 64x36 grayscale raw frames at specified fps for similarity and loop analysis.
    """
    v_path = str(Path(video_path).resolve())
    frame_size = width * height
    cmd = [
        FFMPEG_BIN, "-hide_banner", "-loglevel", "error",
        "-i", v_path,
        "-vf", f"fps={fps},scale={width}:{height},format=gray",
        "-f", "rawvideo",
        "-pix_fmt", "gray",
        "-"
    ]
    proc = subprocess.run(cmd, capture_output=True, timeout=30)
    if proc.returncode != 0:
        raise RuntimeError(f"frame extraction failed for {v_path}: {proc.stderr.decode('utf-8', errors='replace')[-500:]}")
    raw = proc.stdout
    return [raw[i : i + frame_size] for i in range(0, len(raw), frame_size) if len(raw[i : i + frame_size]) == frame_size]


def compute_frame_difference(f1: bytes, f2: bytes) -> float:
    """Computes mean absolute difference between two grayscale raw frames."""
    if len(f1) != len(f2) or not f1:
        return 999.0
    total_diff = sum(abs(b1 - b2) for b1, b2 in zip(f1, f2))
    return total_diff / len(f1)


def detect_shot_loops(video_path: Path | str, min_offset: int = 2, max_offset: int = 9, diff_threshold: float = 3.0, min_consecutive: int = 2) -> list[dict]:
    """
    Computes frame self-similarity within each shot at offsets of 2-9s.
    Requires at least `min_consecutive` consecutive matching frames at the same offset
    to avoid rejecting low-motion shots on a single matching frame pair.
    """
    frames = extract_downscaled_frames(video_path, fps=1, width=64, height=36)
    loops = []
    if len(frames) < min_offset + min_consecutive:
        return loops

    for offset in range(min_offset, min(max_offset + 1, len(frames))):
        streak = 0
        for i in range(len(frames) - offset):
            diff = compute_frame_difference(frames[i], frames[i + offset])
            if diff < diff_threshold:
                streak += 1
                if streak >= min_consecutive:
                    loops.append({
                        "time_a": i,
                        "time_b": i + offset,
                        "offset_sec": offset,
                        "mean_diff": round(diff, 2)
                    })
                    break
            else:
                streak = 0
    return loops


def detect_duplicate_shots(shot_paths: list[Path | str], diff_threshold: float = 3.0) -> list[dict]:
    """
    Checks if any two distinct shots are near-identical copies or frozen stills of each other.
    """
    duplicates = []
    shot_entries: list[tuple[Path, list[bytes]]] = []
    for p in shot_paths:
        frames = extract_downscaled_frames(p, fps=1, width=64, height=36)
        if frames:
            shot_entries.append((Path(p), frames))

    for i in range(len(shot_entries)):
        for j in range(i + 1, len(shot_entries)):
            p1, frames1 = shot_entries[i]
            p2, frames2 = shot_entries[j]
            compare_len = min(len(frames1), len(frames2))
            if compare_len >= 2:
                diffs = [compute_frame_difference(frames1[idx], frames2[idx]) for idx in range(compare_len)]
                avg_diff = sum(diffs) / len(diffs)
                if avg_diff < diff_threshold:
                    duplicates.append({
                        "shot_a": f"{p1.name}#{i+1}",
                        "shot_b": f"{p2.name}#{j+1}",
                        "avg_diff": round(avg_diff, 2)
                    })
    return duplicates


class MediaValidator:
    """
    Comprehensive quality gate validator conforming to Section 6 of the FilmStudio specification.
    """
    def __init__(self, target_width: int = 1280, target_height: int = 720, target_fps: int = 24, duration_tolerance: float = 0.2):
        self.target_width = target_width
        self.target_height = target_height
        self.target_fps = target_fps
        self.duration_tolerance = duration_tolerance

    def validate_clip(self, clip_path: Path | str, expected_duration: Optional[float] = None) -> ValidationResult:
        """Validates an individual shot clip before assembly."""
        errors = []
        warnings = []
        metrics = {}

        info = probe(clip_path)
        metrics["duration"] = info.duration
        metrics["width"] = info.width
        metrics["height"] = info.height
        metrics["fps"] = info.fps
        metrics["has_video"] = info.has_video
        metrics["has_audio"] = info.has_audio

        if not info.has_video:
            errors.append(f"Clip {Path(clip_path).name} has no video stream")

        if info.width != self.target_width or info.height != self.target_height:
            errors.append(
                f"Resolution mismatch: expected {self.target_width}x{self.target_height}, got {info.width}x{info.height}"
            )

        if info.fps is not None and abs(info.fps - self.target_fps) > 0.1:
            errors.append(f"FPS mismatch: expected {self.target_fps}, got {info.fps}")

        if expected_duration is not None:
            diff = abs(info.duration - expected_duration)
            if diff > self.duration_tolerance:
                errors.append(
                    f"Duration mismatch: expected {expected_duration:.2f}s, got {info.duration:.2f}s (diff {diff:.2f}s > {self.duration_tolerance}s)"
                )

        # Check self loops within the shot
        loops = detect_shot_loops(clip_path, min_offset=2, max_offset=9, diff_threshold=3.0)
        if loops:
            errors.append(f"Detected looping frames within shot: {len(loops)} looping points found (e.g. offset {loops[0]['offset_sec']}s diff {loops[0]['mean_diff']})")
            metrics["loops"] = loops

        # Check black bars
        if detect_black_bars(clip_path):
            errors.append("Detected persistent black bars (letterboxing/pillarboxing)")

        # Check freezes
        freezes = detect_freezes(clip_path, min_duration=1.0)
        if freezes:
            errors.append(f"Detected frozen section(s) in shot: {freezes}")
            metrics["freezes"] = freezes

        return ValidationResult(passed=len(errors) == 0, errors=errors, warnings=warnings, metrics=metrics)

    def validate_film(
        self,
        master_path: Path | str,
        expected_duration: Optional[float] = None,
        shot_paths: Optional[list[Path | str]] = None,
        title_card_duration: float = 3.5,
        credits_card_duration: float = 3.0,
        output_report_path: Optional[Path | str] = None
    ) -> ValidationResult:
        """
        Validates the final exported film against all Section 6 criteria:
        - duration vs expected (+/- 0.2s)
        - resolution 1280x720, fps 24, audio present
        - no black bars
        - no freezes > 1.0s outside title/end cards
        - no duplicate shots across the timeline
        """
        errors = []
        warnings = []
        metrics = {}

        info = probe(master_path)
        metrics["duration"] = info.duration
        metrics["width"] = info.width
        metrics["height"] = info.height
        metrics["fps"] = info.fps
        metrics["has_video"] = info.has_video
        metrics["has_audio"] = info.has_audio

        if not info.has_video:
            errors.append("Master film has no video stream")

        if not info.has_audio:
            errors.append("Master film has no audio stream")

        if info.width != self.target_width or info.height != self.target_height:
            errors.append(f"Resolution mismatch: expected {self.target_width}x{self.target_height}, got {info.width}x{info.height}")

        if info.fps is not None and abs(info.fps - self.target_fps) > 0.1:
            errors.append(f"FPS mismatch: expected {self.target_fps}, got {info.fps}")

        if expected_duration is not None:
            diff = abs(info.duration - expected_duration)
            if diff > self.duration_tolerance:
                errors.append(
                    f"Duration mismatch: expected {expected_duration:.2f}s, got {info.duration:.2f}s (diff {diff:.2f}s > {self.duration_tolerance}s)"
                )

        # Freeze check outside title and credits cards
        try:
            freezes = detect_freezes(
                master_path,
                min_duration=1.0,
                ignore_start=title_card_duration,
                ignore_end=credits_card_duration
            )
            if freezes:
                errors.append(f"Detected unpermitted freeze(s) outside title/end cards: {freezes}")
                metrics["freezes"] = freezes
        except Exception as e:
            errors.append(f"Freeze detection failed: {e}")

        # Black bar detection
        try:
            if detect_black_bars(master_path):
                errors.append("Detected black bars in final film")
        except Exception as e:
            errors.append(f"Black bar detection failed: {e}")

        # Within-shot loop detection & Duplicate shots check
        if shot_paths:
            shot_loops = []
            for sp in shot_paths:
                try:
                    loops = detect_shot_loops(sp, min_offset=2, max_offset=9, diff_threshold=3.0)
                    if loops:
                        shot_loops.append({"shot": Path(sp).name, "loops": loops})
                except Exception as e:
                    errors.append(f"Loop detection failed for {Path(sp).name}: {e}")
            if shot_loops:
                errors.append(f"Detected within-shot looping: {shot_loops}")
                metrics["shot_loops"] = shot_loops

            if len(shot_paths) > 1:
                try:
                    duplicates = detect_duplicate_shots(shot_paths, diff_threshold=3.0)
                    if duplicates:
                        errors.append(f"Detected near-identical / duplicate shots: {duplicates}")
                        metrics["duplicate_shots"] = duplicates
                except Exception as e:
                    errors.append(f"Duplicate shot detection failed: {e}")

        passed = len(errors) == 0
        report = ValidationResult(passed=passed, errors=errors, warnings=warnings, metrics=metrics)

        if output_report_path:
            out_p = Path(output_report_path)
            out_p.parent.mkdir(parents=True, exist_ok=True)
            with open(out_p, "w", encoding="utf-8") as f:
                json.dump(report.to_dict(), f, indent=2)

        return report
