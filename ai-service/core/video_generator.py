import os
import time
import logging
import random
from typing import Optional, List, Dict

from core.config import settings

logger = logging.getLogger("cineforge.video")

class QuotaExceededError(RuntimeError):
    """Raised when all Hugging Face ZeroGPU spaces or upstream providers are exhausted or busy."""


# Candidate ZeroGPU spaces for Wan 2.2 / Lightning Image-to-Video
CANDIDATE_VIDEO_SPACES: List[str] = [
    "johnnysnowblind/wan2-2-fp8da-aoti-preview-2c-finishing",
    "JCisHERE/wan2-2-i2v-v3",
    "dream2589632147/Dream-wan2-2-fp8da-aoti-preview-2",
    "r3gm/wan2-2-fp8da-aoti-preview2",
    "cbensimon/wan2-2-fp8da-aoti-preview2",
]

# Track per-space cooldowns so an exhausted space doesn't block other spaces
_space_cooldowns: Dict[str, float] = {}
_token_quota_exhausted: bool = False  # Set to False when fresh HF token is provided

def record_space_cooldown(space_id: str, seconds: float = 120.0) -> None:
    _space_cooldowns[space_id] = time.time() + seconds
    logger.info(f"Recorded cooldown for video space '{space_id}' ({seconds:.0f}s).")

def is_space_available(space_id: str) -> bool:
    return time.time() >= _space_cooldowns.get(space_id, 0.0)

def record_quota_exhaustion(seconds: float = 120.0):
    for space in CANDIDATE_VIDEO_SPACES:
        _space_cooldowns[space] = time.time() + seconds

def is_quota_exhausted() -> bool:
    return all(not is_space_available(s) for s in CANDIDATE_VIDEO_SPACES)


def _extract_video_path(result) -> Optional[str]:
    """Recursively extracts a valid local video file path from Gradio result."""
    if not result:
        return None
    if isinstance(result, str) and (result.endswith(".mp4") or result.endswith(".webm") or os.path.exists(result)):
        return result
    if isinstance(result, dict):
        if "video" in result and isinstance(result["video"], str):
            return result["video"]
        for v in result.values():
            p = _extract_video_path(v)
            if p:
                return p
    if isinstance(result, (tuple, list)):
        for item in result:
            p = _extract_video_path(item)
            if p:
                return p
    return None


def generate_ai_video_clip(
    image_path: str,
    prompt: str,
    hf_token: Optional[str] = None,
    duration: Optional[float] = None,
    steps: int = 4
) -> Optional[str]:
    """
    Generates a fluid, highly animated AI video clip from a keyframe image using
    Wan 2.2 Image-to-Video across a resilient pool of ZeroGPU spaces with automatic failover.
    Ensures continuous motion without freezing or static holds.
    """
    global _token_quota_exhausted

    if not os.path.exists(image_path):
        logger.warning(f"Image not found at {image_path}")
        return None

    # Filter spaces that are not on cooldown
    available_spaces = [s for s in CANDIDATE_VIDEO_SPACES if is_space_available(s)]
    if not available_spaces:
        # Check minimum remaining cooldown
        remaining = int(min((_space_cooldowns.get(s, 0.0) - time.time()) for s in CANDIDATE_VIDEO_SPACES))
        remaining = max(1, remaining)
        raise QuotaExceededError(f"All ZeroGPU video spaces are on cooldown ({remaining}s remaining).")

    clip_duration = float(duration if duration is not None else settings.PROVIDER_CLIP_DURATION_SEC)
    raw_token = hf_token or os.getenv("HUGGINGFACE_API_KEY", "") or getattr(settings, "HUGGINGFACE_API_KEY", "")

    from gradio_client import Client, handle_file

    motion_prompt = (
        f"{prompt}, continuous lively character movement, expressive talking and fluid gestures, "
        f"vibrant cinematic anime animation, active interaction, smooth 60fps motion, dynamic camera"
    )
    negative_prompt = (
        "色调艳丽, 过曝, 静态, 细节模糊不清, 字幕, 风格, 作品, 画作, 画面, 静止, 整体发灰, "
        "最差质量, 低质量, JPEG压缩残留, 丑陋的, 残缺的, 多余的手指, 画得不好的手部, 画得不好的脸部, "
        "畸形的, 毁容的, 形态畸形的肢体, 手指融合, 静止不动的画面, 杂乱的背景, 三条腿, 背景人很多, 倒着走, "
        "static, blurry, freeze frame, still image, motionless, paused, repeating frames, looping"
    )

    seed_val = random.randint(1000, 999999)
    last_error = None

    for space_id in available_spaces:
        token_attempts = [raw_token, None] if (raw_token and not _token_quota_exhausted) else [None]

        for token_val in token_attempts:
            auth_label = "with token" if token_val else "anonymous"
            logger.info(f"Attempting video generation via space '{space_id}' [{auth_label}] (duration={clip_duration:.1f}s)...")
            try:
                try:
                    client = Client(space_id, token=token_val)
                except Exception:
                    client = Client(space_id)

                # Introspect endpoint parameter names so we pass the exact signature needed
                ep = next((e for e in client.endpoints.values() if e.api_name == "/generate_video"), None)
                param_names = [p.get("parameter_name") for p in getattr(ep, "parameters_info", [])] if ep else []

                kwargs = {}
                if not param_names or "input_image" in param_names:
                    kwargs["input_image"] = handle_file(image_path)
                if "first_image" in param_names:
                    kwargs["first_image"] = handle_file(image_path)
                if "last_image" in param_names:
                    kwargs["last_image"] = None
                if not param_names or "prompt" in param_names:
                    kwargs["prompt"] = motion_prompt
                if not param_names or "steps" in param_names:
                    kwargs["steps"] = steps
                if not param_names or "negative_prompt" in param_names:
                    kwargs["negative_prompt"] = negative_prompt
                if not param_names or "duration_seconds" in param_names:
                    kwargs["duration_seconds"] = clip_duration
                if not param_names or "guidance_scale" in param_names:
                    kwargs["guidance_scale"] = 1.0
                if not param_names or "guidance_scale_2" in param_names:
                    kwargs["guidance_scale_2"] = 1.0
                if not param_names or "seed" in param_names:
                    kwargs["seed"] = seed_val
                if not param_names or "randomize_seed" in param_names:
                    kwargs["randomize_seed"] = True

                kwargs["api_name"] = "/generate_video"
                result = client.predict(**kwargs)

                video_path = _extract_video_path(result)
                if video_path and os.path.exists(video_path) and os.path.getsize(video_path) > 10000:
                    logger.info(f"AI video generated successfully via '{space_id}' at {video_path}")
                    return video_path
                else:
                    logger.warning(f"Video file from '{space_id}' empty or invalid: {video_path}")

            except Exception as err:
                err_str = str(err).lower()
                last_error = err

                if "exceeded your free zerogpu quota" in err_str or "quota" in err_str:
                    if token_val:
                        _token_quota_exhausted = True
                        logger.warning(f"User HF token exhausted quota on '{space_id}'. Retrying space immediately as anonymous...")
                        continue  # Try next iteration with token_val=None

                is_quota_or_busy = any(w in err_str for w in [
                    "quota", "403", "forbidden", "busy", "queue", "gpu", "overloaded",
                    "rate limit", "exceeded", "timeout", "timed out", "504", "502"
                ]) and not any(w in err_str for w in ["argument", "parameter", "keyword"])
                if is_quota_or_busy:
                    record_space_cooldown(space_id, 120.0)
                    logger.warning(f"Space '{space_id}' unavailable/quota exceeded ({err}). Trying next candidate space...")
                else:
                    logger.warning(f"Generation error on '{space_id}': {err}. Trying next candidate space...")
                break  # Move to next space

    err_details = f": {last_error}" if last_error else ""
    raise QuotaExceededError(f"All candidate ZeroGPU spaces failed or exhausted{err_details}")

