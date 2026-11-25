import os
from pathlib import Path
from dotenv import load_dotenv

# Ensure .env is loaded reliably from ai-service/.env
env_path = Path(__file__).resolve().parent.parent / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path, override=True)
else:
    load_dotenv(override=True)

# Mirror GEMINI_API_KEY to GOOGLE_API_KEY for langchain-google-genai
gemini_key = os.environ.get("GEMINI_API_KEY", "")
if gemini_key:
    os.environ["GOOGLE_API_KEY"] = gemini_key

try:
    from pydantic_settings import BaseSettings
except ImportError:
    from pydantic import BaseModel
    class BaseSettings(BaseModel):
        def __init__(self, **values):
            init_vals = {}
            fields = getattr(self, "model_fields", None) or getattr(self, "__fields__", {})
            for field_name in fields:
                if field_name in os.environ:
                    init_vals[field_name] = os.environ[field_name]
            init_vals.update(values)
            super().__init__(**init_vals)

class Settings(BaseSettings):
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"

    HUGGINGFACE_API_KEY: str = ""
    POLLINATIONS_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    IMAGE_PROVIDER: str = "auto"
    ELEVENLABS_API_KEY: str = ""
    AUDIO_PROVIDER: str = "edgetts"
    VOICESTUDIO_API_URL: str = "http://localhost:8001"
    ENABLE_VOICESTUDIO: bool = False

    # HyperFrames Configuration
    ENABLE_SUBTITLES: bool = True
    ENABLE_TITLE_CARD: bool = False
    ENABLE_CREDITS_CARD: bool = False
    TITLE_CARD_DURATION_SEC: float = 3.5
    CREDITS_CARD_DURATION_SEC: float = 3.0

    # Provider Clip & Video Pipeline Specs
    PROVIDER_CLIP_SECONDS: float = 5.0
    PROVIDER_CLIP_DURATION_SEC: float = 5.0
    PROVIDER_CLIP_LENGTH_SEC: float = 5.0
    ALLOWED_CLIP_SECONDS: list[float] = [4.0, 5.0, 6.0, 8.0]
    MAX_SLOWMO_FACTOR: float = 1.25
    MAX_WORDS_PER_SECOND: float = 2.5

    TARGET_FPS: int = 24
    TARGET_WIDTH: int = 1280
    TARGET_HEIGHT: int = 720

    VIDEO_FPS: int = 24
    VIDEO_WIDTH: int = 1280
    VIDEO_HEIGHT: int = 720
    VIDEO_CRF: int = 18

    # Audio Pipeline Specs (Broadcast EBU R128 / 48kHz)
    AUDIO_SAMPLE_RATE: int = 48000
    AUDIO_BITRATE: str = "192k"
    TARGET_LUFS: float = -16.0
    TARGET_TRUE_PEAK: float = -1.5

    # Timing & Tolerances
    SHOT_PRE_DELAY_SEC: float = 0.5
    SHOT_POST_TAIL_SEC: float = 1.5
    DURATION_TOLERANCE_SEC: float = 0.2

    # Robustness Policies
    SHOT_SHORT_POLICY: str = "fail"
    ALLOW_STATIC_FALLBACK: bool = False
    FFMPEG_TIMEOUT_SEC: int = 600

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
