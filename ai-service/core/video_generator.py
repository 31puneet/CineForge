import os
import time
import logging
from typing import Optional

from core.config import settings

logger = logging.getLogger("cineforge.video")

class QuotaExceededError(RuntimeError):
    """Raised when Hugging Face ZeroGPU or upstream provider quota is exhausted."""


_quota_exhausted_until = 0.0

def record_quota_exhaustion(seconds: float = 3600.0):
    global _quota_exhausted_until
    _quota_exhausted_until = time.time() + seconds

def is_quota_exhausted() -> bool:
    return time.time() < _quota_exhausted_until

def generate_ai_video_clip(
    image_path: str,
    prompt: str,
    hf_token: Optional[str] = None,
    duration: Optional[float] = None,
    steps: int = 4
) -> Optional[str]:
    """
    Generates a fluid AI video clip from a character/scene image using
    Wan 2.2 14B Image-to-Video with Lightning LoRA on Hugging Face ZeroGPU.
    Raises QuotaExceededError if ZeroGPU quota is exhausted.
    """
    if is_quota_exhausted():
        remaining = int(_quota_exhausted_until - time.time())
        raise QuotaExceededError(f"ZeroGPU quota cooldown active ({remaining}s remaining).")

    if not os.path.exists(image_path):
        logger.warning(f"Image not found at {image_path}")
        return None

    clip_duration = float(duration if duration is not None else settings.PROVIDER_CLIP_DURATION_SEC)

    from gradio_client import Client, handle_file
    token = hf_token or os.getenv("HUGGINGFACE_API_KEY", "")
    
    try:
        client = Client("zerogpu-aoti/wan2-2-fp8da-aoti-faster", token=token if token else None)
    except Exception:
        client = Client("zerogpu-aoti/wan2-2-fp8da-aoti-faster")

    motion_prompt = (
        f"{prompt}, lively character movement, cinematic animation, fluid dynamic motion, expressive anime style"
    )
    negative_prompt = (
        "色调艳丽, 过曝, 静态, 细节模糊不清, 字幕, 风格, 作品, 画作, 画面, 静止, 整体发灰, "
        "最差质量, 低质量, JPEG压缩残留, 丑陋的, 残缺的, 多余的手指, 画得不好的手部, 画得不好的脸部, "
        "畸形的, 毁容的, 形态畸形的肢体, 手指融合, 静止不动的画面, 杂乱的背景, 三条腿, 背景人很多, 倒着走, static, blurry"
    )
    
    logger.info(f"Submitting AI video generation for: {motion_prompt[:80]}...")
    result = None
    try:
        result = client.predict(
            input_image=handle_file(image_path),
            prompt=motion_prompt,
            steps=steps,
            negative_prompt=negative_prompt,
            duration_seconds=clip_duration,
            guidance_scale=1.0,
            guidance_scale_2=1.0,
            seed=42,
            randomize_seed=True,
            api_name="/generate_video"
        )
    except Exception as err:
        err_str = str(err).lower()
        if "quota" in err_str or "403" in str(err) or "forbidden" in err_str:
            record_quota_exhaustion(3600.0)
            logger.warning(f"ZeroGPU Quota Exceeded: {err}")
            raise QuotaExceededError(str(err)) from err
        raise err

    if result and isinstance(result, (tuple, list)) and len(result) > 0:
        video_path = result[0]
        if video_path and os.path.exists(video_path):
            logger.info(f"AI video generated successfully at {video_path}")
            return video_path

    logger.warning(f"Unexpected result from Wan 2.2: {result}")
    return None
