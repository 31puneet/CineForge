"""
Editor Agent / Video Assembly Node for CineForge.
Follows CineForge Fix Spec section 4.
"""
import os
import json
import shutil
import asyncio
import logging
from uuid import uuid4
from pathlib import Path
from typing import Dict, Any, List, Optional
from langchain_core.runnables import RunnableConfig

from core.config import settings
from core.media_processor import (
    probe,
    compute_shot_duration,
    normalize_clip,
    normalize_master_loudness,
    concat,
    build_audio_track,
    mux,
    mux_shot,
    verify_film,
    create_shot_subtitles_ass,
    generate_title_card,
    generate_credits_card,
    MediaProcessingError,
    DurationMismatchError,
    ShotTooShortError
)
from core.media_validator import MediaValidator
from schemas.state import FilmGraphState

logger = logging.getLogger("cineforge.editor")
_assembly_locks: Dict[str, asyncio.Lock] = {}

def _get_assembly_lock(project_id: str) -> asyncio.Lock:
    lock = _assembly_locks.get(project_id)
    if lock is None:
        lock = asyncio.Lock()
        _assembly_locks[project_id] = lock
    return lock


async def assemble_video(state: FilmGraphState, config: RunnableConfig) -> FilmGraphState:
    """
    Assembles normalized individual shots into the final master film.
    """
    emitter = config.get("configurable", {}).get("emitter")
    project_id = state.get("project_id", "default_project")

    async with _get_assembly_lock(project_id):
        return await _assemble_video_locked(state, config, emitter, project_id)


async def _assemble_video_locked(state: FilmGraphState, config: RunnableConfig, emitter: Any, project_id: str) -> FilmGraphState:

    if emitter:
        await emitter.push("status", content="Starting Stage 5: Editor Agent Assembly & Media Normalization...")
        await emitter.push("plan_update", current="Editor Assembly")

    shots = state.get("script_data", {}).get("shots", [])
    video_shots = {vs.get("shot_id"): vs for vs in state.get("video_shots", [])}
    voiceovers = {vo.get("shot_id"): vo for vo in state.get("voiceovers", [])}

    renders_dir = Path(os.path.abspath(os.path.join(
        os.path.dirname(__file__), "..", "..", "frontend", "public", "renders", project_id
    )))
    renders_dir.mkdir(parents=True, exist_ok=True)

    scratch_dir = renders_dir / f"scratch_{uuid4().hex[:8]}"
    scratch_dir.mkdir(parents=True, exist_ok=True)

    try:
        # 1. Validate inputs: every script shot must have an approved clip
        missing_shots = []
        valid_clips: Dict[str, Path] = {}
        
        for idx, shot in enumerate(shots):
            shot_id = shot.get("id") or shot.get("shot_id") or f"shot_{idx+1}"
            v_record = video_shots.get(shot_id)
            clip_path = None

            # Look for processed mp4 first, falling back to raw mp4 or recorded url
            candidate_local = renders_dir / f"{shot_id}.mp4"
            if not candidate_local.exists():
                candidate_local = renders_dir / f"{shot_id}_raw.mp4"

            if candidate_local.exists():
                clip_path = candidate_local
            elif v_record and v_record.get("video_url"):
                # URL might be relative
                url = v_record["video_url"]
                if url.startswith("/renders/"):
                    rel = url.split(f"/renders/{project_id}/")[-1]
                    local_cand = renders_dir / rel
                    if local_cand.exists():
                        clip_path = local_cand

            if not clip_path or not clip_path.exists():
                missing_shots.append(shot_id)
            else:
                try:
                    p_info = await asyncio.to_thread(probe, clip_path)
                    if not p_info.has_video:
                        missing_shots.append(f"{shot_id} (no video stream)")
                    else:
                        valid_clips[shot_id] = clip_path
                except Exception as e:
                    missing_shots.append(f"{shot_id} (corrupt: {e})")

        if missing_shots:
            err_msg = f"Assembly refused: missing or invalid clips for shots: {', '.join(missing_shots)}"
            logger.error(err_msg)
            if emitter:
                await emitter.push("error", message=err_msg)
            state["current_stage"] = "editor_failed"
            return state

        # 2. Use each clip's real duration from ffprobe (no looping, no padding)
        shot_durations: Dict[str, float] = {}
        for idx, shot in enumerate(shots):
            shot_id = shot.get("id") or shot.get("shot_id") or f"shot_{idx+1}"
            src_clip = valid_clips[shot_id]
            clip_info = await asyncio.to_thread(probe, src_clip)
            if not clip_info.has_video or clip_info.duration <= 0.1:
                raise MediaProcessingError(f"Shot {shot_id} has invalid or static video clip ({src_clip})")
            real_dur = round(clip_info.duration, 3)
            shot_durations[shot_id] = real_dur

        if emitter:
            total_calc = sum(shot_durations.values())
            await emitter.push("status", content=f"Using real ffprobe clip durations: {total_calc:.2f}s across {len(shots)} shots")

        # 3. Normalize each clip to constant 24 fps, 1280x720, YUV420p, no audio (scale+crop)
        normalized_clips: List[Path] = []
        padding_manifest: Dict[str, Any] = {}

        # HyperFrames Feature 1: Opening Movie Title Card
        meta = state.get("metadata", {}) or {}
        script_data = state.get("script_data", {}) or {}
        characters = [c.get("name") for c in state.get("characters", []) if c.get("name")]

        raw_title = (meta.get("title") or meta.get("prompt") or "").strip()
        if raw_title and raw_title.lower() not in ["default_project", "test"]:
            project_title = raw_title
        elif characters:
            project_title = " & ".join(characters[:2])
        else:
            project_title = "CineForge Original"

        # Dynamically determine genre-appropriate subtitle
        raw_subtitle = (meta.get("subtitle") or "").strip()
        if raw_subtitle:
            project_subtitle = raw_subtitle
        else:
            context_text = f"{project_title} {script_data.get('global_narrative', '')} {' '.join(characters)}".lower()
            if any(k in context_text for k in ["kid", "child", "appu", "chintu", "doraemon", "disney", "pixar", "baby", "cartoon", "jungle"]):
                project_subtitle = "A Magical Animated Adventure"
            elif any(k in context_text for k in ["cyberpunk", "tokyo", "neo-tokyo", "malakor", "sci-fi", "quantum", "solaris", "ai", "grid", "future"]):
                project_subtitle = "A Sci-Fi Animated Story"
            elif any(k in context_text for k in ["anime", "manga", "action", "battle", "warrior", "hero"]):
                project_subtitle = "An Action Anime Film"
            else:
                project_subtitle = "A CineForge Original Production"

        intro_pad = settings.TITLE_CARD_DURATION_SEC if settings.ENABLE_TITLE_CARD else 0.0
        outro_pad = settings.CREDITS_CARD_DURATION_SEC if settings.ENABLE_CREDITS_CARD else 0.0

        if settings.ENABLE_TITLE_CARD:
            if emitter:
                await emitter.push("status", content="Generating HyperFrames Opening Movie Title Card...")
            title_card_path = scratch_dir / "00_title_card.mp4"
            await asyncio.to_thread(
                generate_title_card,
                title=project_title,
                subtitle=project_subtitle,
                duration=intro_pad,
                dst_path=title_card_path
            )
            normalized_clips.append(title_card_path)

        for idx, shot in enumerate(shots):
            shot_id = shot.get("id") or shot.get("shot_id") or f"shot_{idx+1}"
            src_clip = valid_clips[shot_id]
            dst_clip = scratch_dir / f"shot_{idx+1}_norm.mp4"
            target_dur = shot_durations[shot_id]

            if emitter:
                await emitter.push("status", content=f"Normalizing Shot {idx+1}/{len(shots)} ({shot_id}) to {target_dur:.2f}s @ 24fps (scale+crop)...")

            # HyperFrames Feature 2: Animated Styled Subtitles with VoiceStudio word timing
            sub_file: Optional[Path] = None
            if settings.ENABLE_SUBTITLES:
                shot_dialogue = shot.get("dialogue") or ""
                shot_speaker = shot.get("speaker") or ""
                vo = voiceovers.get(shot_id)
                if not shot_dialogue and vo:
                    shot_dialogue = vo.get("dialogue") or ""
                if not shot_speaker and vo:
                    shot_speaker = vo.get("speaker") or ""

                if shot_dialogue and shot_dialogue.strip():
                    sub_file = scratch_dir / f"sub_{shot_id}.ass"
                    vo_dur = float(vo.get("duration_seconds") or 0.0) if vo else 0.0
                    create_shot_subtitles_ass(
                        dialogue=shot_dialogue,
                        speaker=shot_speaker,
                        duration=target_dur,
                        out_path=sub_file,
                        audio_duration=vo_dur or None
                    )

            try:
                norm_result = await asyncio.to_thread(
                    normalize_clip,
                    src=src_clip,
                    dst=dst_clip,
                    duration=target_dur,
                    subtitle_file=sub_file
                )
            except ShotTooShortError as sse:
                err_msg = f"Assembly failed: {sse}"
                logger.error(err_msg)
                if emitter:
                    await emitter.push("error", message=err_msg)
                state["current_stage"] = "editor_failed"
                return state

            normalized_clips.append(dst_clip)
            padding_manifest[shot_id] = None

            # Update video_shots state
            if shot_id in video_shots:
                video_shots[shot_id]["padding_applied"] = None
                video_shots[shot_id]["duration_sec"] = target_dur

        # HyperFrames Feature 3: Closing End Credits Card
        if settings.ENABLE_CREDITS_CARD:
            if emitter:
                await emitter.push("status", content="Generating HyperFrames Closing End Credits Card...")
            credits_card_path = scratch_dir / "99_credits_card.mp4"
            characters = [c.get("name") for c in state.get("characters", []) if c.get("name")]
            await asyncio.to_thread(
                generate_credits_card,
                title=project_title,
                characters=characters,
                duration=outro_pad,
                dst_path=credits_card_path
            )
            normalized_clips.append(credits_card_path)

        # 4. Per-shot audio sync: mux each shot's video + audio first (audio padded with apad, never extend video)
        if emitter:
            await emitter.push("status", content="Muxing per-shot video + audio synchronized segments...")
        muxed_clips: List[Path] = []

        clip_counter = 0
        if settings.ENABLE_TITLE_CARD:
            tc_muxed = scratch_dir / "00_title_card_muxed.mp4"
            await asyncio.to_thread(mux_shot, normalized_clips[clip_counter], None, tc_muxed, duration=intro_pad)
            muxed_clips.append(tc_muxed)
            clip_counter += 1

        for idx, shot in enumerate(shots):
            shot_id = shot.get("id") or shot.get("shot_id") or f"shot_{idx+1}"
            target_dur = shot_durations[shot_id]
            norm_vid = normalized_clips[clip_counter]
            clip_counter += 1

            vo_audio_path = renders_dir / f"audio_{shot_id}.mp3"
            if vo_audio_path.exists():
                vo_info = await asyncio.to_thread(probe, vo_audio_path)
                needed_dur = vo_info.duration + settings.SHOT_PRE_DELAY_SEC
                if needed_dur > target_dur + settings.DURATION_TOLERANCE_SEC:
                    raise DurationMismatchError(
                        f"Voiceover for {shot_id} ({vo_info.duration:.2f}s + {settings.SHOT_PRE_DELAY_SEC:.2f}s pre-delay = {needed_dur:.2f}s) exceeds shot duration {target_dur:.2f}s"
                    )
            shot_muxed = scratch_dir / f"shot_{idx+1}_muxed.mp4"
            await asyncio.to_thread(
                mux_shot,
                norm_vid,
                vo_audio_path if vo_audio_path.exists() else None,
                shot_muxed,
                duration=target_dur
            )
            muxed_clips.append(shot_muxed)

        if settings.ENABLE_CREDITS_CARD:
            cc_muxed = scratch_dir / "99_credits_card_muxed.mp4"
            await asyncio.to_thread(mux_shot, normalized_clips[clip_counter], None, cc_muxed, duration=outro_pad)
            muxed_clips.append(cc_muxed)
            clip_counter += 1

        # 5. Concatenate all pre-muxed shots and normalize loudness (-16 LUFS) in staging before publishing
        if emitter:
            await emitter.push("status", content="Concatenating synchronized audio/video shots and normalizing loudness...")
        raw_concat_path = scratch_dir / "master_concat.mp4"
        staging_master_path = scratch_dir / "master_loudnorm.mp4"
        master_film_path = renders_dir / "master.mp4"
        legacy_film_path = renders_dir / "final_film.mp4"
        list_file = scratch_dir / "concat_list.txt"
        await asyncio.to_thread(concat, muxed_clips, raw_concat_path, list_file)
        await asyncio.to_thread(normalize_master_loudness, raw_concat_path, staging_master_path)

        # 6. Quality Gate: Run MediaValidator & verify_film on staging before publishing
        if emitter:
            await emitter.push("status", content="Running rigorous MediaValidator quality gate on master film...")

        raw_shot_paths = [valid_clips[shot.get("id") or shot.get("shot_id") or f"shot_{i+1}"] for i, shot in enumerate(shots)]
        expected_film_duration = sum(shot_durations.values()) + intro_pad + outro_pad

        validator = MediaValidator(
            target_width=settings.TARGET_WIDTH,
            target_height=settings.TARGET_HEIGHT,
            target_fps=settings.TARGET_FPS,
            duration_tolerance=settings.DURATION_TOLERANCE_SEC
        )
        validator_report_path = renders_dir / "validator_report.json"
        val_result = await asyncio.to_thread(
            validator.validate_film,
            staging_master_path,
            expected_duration=expected_film_duration,
            shot_paths=raw_shot_paths,
            title_card_duration=intro_pad,
            credits_card_duration=outro_pad,
            output_report_path=validator_report_path
        )

        qc_results = await asyncio.to_thread(verify_film, staging_master_path)
        qc_results["media_validator"] = val_result.to_dict()

        if not val_result.passed or not qc_results["passed"]:
            combined_errors = val_result.errors + [e for e in qc_results.get("errors", []) if e not in val_result.errors]
            logger.error("MediaValidator quality gate failed: %s", combined_errors)
            if emitter:
                await emitter.push("error", message=f"Quality Gate Failed: {'; '.join(combined_errors)}")
            state["current_stage"] = "editor_qc_failed"
            state["manifest"] = qc_results
            return state

        # Publish atomically only after both quality gates pass
        tmp_master = renders_dir / f".master_{uuid4().hex[:8]}.mp4"
        tmp_legacy = renders_dir / f".final_film_{uuid4().hex[:8]}.mp4"
        shutil.copyfile(staging_master_path, tmp_master)
        shutil.copyfile(staging_master_path, tmp_legacy)
        os.replace(tmp_master, master_film_path)
        os.replace(tmp_legacy, legacy_film_path)

        # 8. Write manifest.json
        manifest_data = {
            "project_id": project_id,
            "master_film": f"/renders/{project_id}/master.mp4",
            "total_duration": qc_results["checks"]["duration"]["video_duration"],
            "fps": settings.VIDEO_FPS,
            "resolution": f"{settings.VIDEO_WIDTH}x{settings.VIDEO_HEIGHT}",
            "integrated_lufs": qc_results["checks"]["loudness"]["integrated_lufs"],
            "true_peak": qc_results["checks"]["loudness"]["true_peak"],
            "features": {
                "title_card": settings.ENABLE_TITLE_CARD,
                "credits_card": settings.ENABLE_CREDITS_CARD,
                "subtitles": settings.ENABLE_SUBTITLES,
                "voicestudio": settings.ENABLE_VOICESTUDIO
            },
            "shots": [
                {
                    "shot_id": shot.get("id") or shot.get("shot_id") or f"shot_{i+1}",
                    "duration_sec": shot_durations[shot.get("id") or shot.get("shot_id") or f"shot_{i+1}"],
                    "padding_applied": padding_manifest.get(shot.get("id") or shot.get("shot_id") or f"shot_{i+1}"),
                    "static_fallback": video_shots.get(shot.get("id") or shot.get("shot_id") or f"shot_{i+1}", {}).get("static_fallback", False)
                }
                for i, shot in enumerate(shots)
            ],
            "qc_verification": qc_results
        }
        manifest_path = renders_dir / "manifest.json"
        manifest_path.write_text(json.dumps(manifest_data, indent=2), encoding="utf-8")

        state["manifest"] = manifest_data
        state["final_film_url"] = f"/renders/{project_id}/master.mp4"
        state["current_stage"] = "completed"
        if "approval_states" in state:
            state["approval_states"]["editor_approved"] = True

        update_state_fn = config.get("configurable", {}).get("update_state")
        if update_state_fn:
            import asyncio
            if asyncio.iscoroutinefunction(update_state_fn):
                await update_state_fn(state)
            else:
                update_state_fn(state)

        if emitter:
            await emitter.push("status", content="Master film passed all QC checks and is ready for playback!")
            await emitter.push(
                "message",
                content=f"🎬 Master Film Assembled & Verified Successfully! Total duration: {manifest_data['total_duration']:.2f}s, Loudness: {manifest_data['integrated_lufs']} LUFS, Frame rate: 24 fps CFR.",
                link={"label": "Watch Master Film", "target": "video_tab"}
            )
            await emitter.push("done")

        return state

    finally:
        # 9. Clean up scratch directory
        if scratch_dir.exists():
            try:
                shutil.rmtree(scratch_dir)
            except Exception as e:
                logger.warning("Failed to clean up scratch dir %s: %s", scratch_dir, e)
