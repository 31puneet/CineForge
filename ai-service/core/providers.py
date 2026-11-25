from abc import ABC, abstractmethod
from typing import Any, Optional
import json
import re
from langchain_google_genai import ChatGoogleGenerativeAI
from core.config import settings

def extract_text_content(content: Any) -> str:
    """Extract plain text from LLM response or stream chunk content, which may be str or list of dicts."""
    if isinstance(content, str):
        return content
    elif isinstance(content, list):
        text_parts = []
        for part in content:
            if isinstance(part, str):
                text_parts.append(part)
            elif isinstance(part, dict) and "text" in part:
                text_parts.append(str(part["text"]))
            elif hasattr(part, "text"):
                text_parts.append(str(part.text))
            else:
                text_parts.append(str(part))
        return "".join(text_parts)
    return str(content) if content is not None else ""


class BaseLLMProvider(ABC):
    """Abstract base class for LLM interactions to prevent hardcoding providers."""
    
    @abstractmethod
    def generate_text(self, prompt: str, **kwargs) -> str:
        pass
        
    @abstractmethod
    def get_structured_output(self, prompt: str, schema: Any, **kwargs) -> Any:
        pass


import asyncio
import time
from pydantic import ValidationError

DEFAULT_GEMINI_FALLBACKS = [
    "gemini-3.8-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
]


class GeminiAdapter(BaseLLMProvider):
    def __init__(self, model_name: Optional[str] = None):
        preferred = model_name or getattr(settings, "GEMINI_MODEL", "gemini-3.8-flash")
        self.candidate_models = [preferred] + [m for m in DEFAULT_GEMINI_FALLBACKS if m != preferred]
        self.active_model = preferred

    def _create_llm(self, model: str):
        return ChatGoogleGenerativeAI(
            model=model,
            google_api_key=settings.GEMINI_API_KEY,
            temperature=0.7,
            max_retries=2,
            timeout=90
        )

    @property
    def llm(self):
        return self._create_llm(self.active_model)

    def _should_fallback(self, err: Exception) -> bool:
        err_msg = str(err).lower()
        return any(term in err_msg for term in [
            "503", "504", "deadline", "deadline_exceeded", "unavailable", "high demand", "429", "resource_exhausted",
            "quota", "timed out", "timeout", "500", "internal", "overloaded"
        ])

    def _sanitize_messages(self, messages_or_prompt: Any) -> Any:
        if isinstance(messages_or_prompt, list) and len(messages_or_prompt) > 0:
            from langchain_core.messages import AIMessage, HumanMessage
            clean = list(messages_or_prompt)
            if isinstance(clean[-1], AIMessage):
                clean.append(HumanMessage(content="Please proceed with the next step based on the instructions above."))
            return clean
        return messages_or_prompt

    async def astream(self, messages_or_prompt: Any, **kwargs):
        """Stream response chunks with automatic fallback across candidate models if one experiences high demand (503/504)."""
        clean_input = self._sanitize_messages(messages_or_prompt)
        last_error = None
        for model in self.candidate_models:
            yielded_any = False
            try:
                llm = self._create_llm(model)
                async for chunk in llm.astream(clean_input, **kwargs):
                    yielded_any = True
                    yield chunk
                self.active_model = model
                return
            except Exception as e:
                last_error = e
                print(f"[GeminiAdapter] astream failed with model '{model}': {e}")
                if yielded_any or not self._should_fallback(e):
                    raise e
                print(f"[GeminiAdapter] Falling back from '{model}' to next candidate model...")
                await asyncio.sleep(0.5)

        raise last_error or RuntimeError("All candidate Gemini models failed")

    async def ainvoke(self, messages_or_prompt: Any, **kwargs):
        """Asynchronously invoke LLM with automatic model fallback."""
        clean_input = self._sanitize_messages(messages_or_prompt)
        last_error = None
        for model in self.candidate_models:
            try:
                llm = self._create_llm(model)
                res = await llm.ainvoke(clean_input, **kwargs)
                self.active_model = model
                return res
            except Exception as e:
                last_error = e
                print(f"[GeminiAdapter] ainvoke failed with model '{model}': {e}")
                if not self._should_fallback(e):
                    continue
                print(f"[GeminiAdapter] Falling back from '{model}' to next candidate model...")
                await asyncio.sleep(0.5)

        raise last_error or RuntimeError("All candidate Gemini models failed")

    def invoke(self, messages_or_prompt: Any, **kwargs):
        """Synchronously invoke LLM with automatic model fallback."""
        clean_input = self._sanitize_messages(messages_or_prompt)
        last_error = None
        for model in self.candidate_models:
            try:
                llm = self._create_llm(model)
                res = llm.invoke(clean_input, **kwargs)
                self.active_model = model
                return res
            except Exception as e:
                last_error = e
                print(f"[GeminiAdapter] invoke failed with model '{model}': {e}")
                if not self._should_fallback(e):
                    continue
                print(f"[GeminiAdapter] Falling back from '{model}' to next candidate model...")
                time.sleep(0.5)

        raise last_error or RuntimeError("All candidate Gemini models failed")

    def generate_text(self, prompt: str, **kwargs) -> str:
        response = self.invoke(prompt, **kwargs)
        return extract_text_content(response.content)

    async def astream_text(self, prompt: str, **kwargs):
        async for chunk in self.astream(prompt, **kwargs):
            yield extract_text_content(chunk.content)

    def _extract_json(self, text: str) -> dict:
        match = re.search(r"```(?:json)?\s*(\{.*\}|\[.*\])\s*```", text, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        return json.loads(text.strip())

    def get_structured_output(self, prompt: str, schema: Any, **kwargs) -> Any:
        prompt_with_schema = f"{prompt}\n\nPlease output valid JSON that conforms to this schema:\n{json.dumps(schema.model_json_schema())}"
        response = self.invoke(prompt_with_schema, **kwargs)
        content = self._extract_json(extract_text_content(response.content))
        return schema(**content)

    async def aget_structured_output(self, prompt: str, schema: Any, **kwargs) -> Any:
        prompt_with_schema = f"{prompt}\n\nPlease output ONLY valid JSON that conforms to this schema:\n{json.dumps(schema.model_json_schema())}"
        last_error = None
        for model in self.candidate_models:
            try:
                llm = self._create_llm(model)
                response = await llm.ainvoke(prompt_with_schema, **kwargs)
                content = self._extract_json(extract_text_content(response.content))
                parsed = schema(**content)
                self.active_model = model
                return parsed
            except Exception as e:
                last_error = e
                print(f"[GeminiAdapter] aget_structured_output failed with model '{model}': {e}")
                if not self._should_fallback(e) and not isinstance(e, (json.JSONDecodeError, ValidationError)):
                    continue
                print(f"[GeminiAdapter] Falling back from '{model}' to next candidate model...")
                await asyncio.sleep(0.5)

        raise last_error or RuntimeError("All candidate Gemini models failed to generate structured output")


class BaseImageProvider(ABC):
    """Abstract base class for Image Generation providers."""

    @abstractmethod
    async def generate_image(self, prompt: str, **kwargs) -> str:
        """Generate an image from prompt and return the image URL."""
        pass


class PollinationsImageAdapter(BaseImageProvider):
    """Image provider adapter leveraging high-speed cinematic flux model with authenticated Pollen API."""

    def __init__(self, width: int = 768, height: int = 1024, model: str = "flux"):
        self.width = width
        self.height = height
        self.model = model

    async def generate_image(self, prompt: str, **kwargs) -> str:
        import urllib.parse
        import random
        import httpx
        import base64

        clean_prompt = prompt.replace("\n", " ").strip()
        style_keywords = ["anime", "cartoon", "illustration", "photorealistic", "photography", "35mm", "cinematic", "concept art", "portrait", "cgi", "render", "drawing", "manga"]
        if not any(k in clean_prompt.lower() for k in style_keywords):
            clean_prompt = f"concept portrait, detailed, {clean_prompt}"
        encoded_prompt = urllib.parse.quote(clean_prompt)
        seed = kwargs.get("seed", random.randint(1000, 999999))
        key = getattr(settings, "POLLINATIONS_API_KEY", "") or os.getenv("POLLINATIONS_API_KEY", "")

        safe_params = [f"seed={seed}", "nologo=true"]
        if self.width and self.height:
            safe_params.append(f"width={self.width}&height={self.height}")
        if key:
            safe_params.append(f"key={key}")
        safe_query_str = "&".join(safe_params)
        safe_image_url = f"https://gen.pollinations.ai/image/{encoded_prompt}?{safe_query_str}"
        req_url = safe_image_url

        headers = {}
        if key:
            headers["Authorization"] = f"Bearer {key}"

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.get(req_url, headers=headers)
                if resp.status_code == 200 and resp.headers.get("content-type", "").startswith("image/"):
                    b64 = base64.b64encode(resp.content).decode("utf-8")
                    return f"data:image/jpeg;base64,{b64}"
                else:
                    print(f"[PollinationsImageAdapter] HTTP {resp.status_code}: {resp.text[:120]}")
        except Exception as e:
            print(f"[PollinationsImageAdapter] Fetch error: {e}")

        return safe_image_url


class HuggingFaceImageAdapter(BaseImageProvider):
    """Official Hugging Face Inference API adapter using user access token."""

    def __init__(self, api_key: str = "", model_id: str = "black-forest-labs/FLUX.1-schnell"):
        self.api_key = api_key or settings.HUGGINGFACE_API_KEY
        self.model_id = model_id

    async def generate_image(self, prompt: str, **kwargs) -> str:
        import base64
        import io
        import asyncio

        def _generate():
            from huggingface_hub import InferenceClient
            client = InferenceClient(provider="fal-ai", token=self.api_key)
            img = client.text_to_image(prompt, model=self.model_id)
            buf = io.BytesIO()
            img.save(buf, format="JPEG")
            b64_str = base64.b64encode(buf.getvalue()).decode("utf-8")
            return f"data:image/jpeg;base64,{b64_str}"

        try:
            return await asyncio.to_thread(_generate)
        except Exception as e:
            print(f"Hugging Face image generation error: {e}, falling back to Pollinations")
            fallback = PollinationsImageAdapter()
            return await fallback.generate_image(prompt, **kwargs)


class GoogleImagenAdapter(BaseImageProvider):
    """Google Gemini & Imagen adapter using official Gemini API key."""

    def __init__(self, api_key: str = ""):
        self.api_key = api_key or settings.GEMINI_API_KEY

    async def generate_image(self, prompt: str, **kwargs) -> str:
        import base64
        import httpx

        clean_prompt = prompt.strip()
        aspect_ratio = kwargs.get("aspect_ratio", "3:4")

        # 1. Attempt using official google-genai SDK
        try:
            from google import genai
            client = genai.Client(api_key=self.api_key)
            image_models = ["gemini-2.5-flash-image", "gemini-3.1-flash-image"]
            for model_id in image_models:
                try:
                    response = await asyncio.to_thread(
                        client.models.generate_content,
                        model=model_id,
                        contents=f"Generate a high-quality cinematic {aspect_ratio} portrait: {clean_prompt}"
                    )
                    if response and response.candidates:
                        for cand in response.candidates:
                            if hasattr(cand, "content") and cand.content and cand.content.parts:
                                for part in cand.content.parts:
                                    if hasattr(part, "inline_data") and part.inline_data:
                                        mime = getattr(part.inline_data, "mime_type", "image/jpeg") or "image/jpeg"
                                        raw_data = part.inline_data.data
                                        if isinstance(raw_data, bytes):
                                            b64_img = base64.b64encode(raw_data).decode("utf-8")
                                        else:
                                            b64_img = str(raw_data)
                                        print(f"Successfully generated image via Gemini SDK ({model_id})")
                                        return f"data:{mime};base64,{b64_img}"
                except Exception as model_err:
                    err_msg = str(model_err)
                    if "429" in err_msg or "quota" in err_msg.lower():
                        print(f"Gemini Image model {model_id} quota/rate limit encountered: {err_msg[:120]}")
                        break
                    continue
        except Exception as sdk_err:
            print(f"Google GenAI SDK invocation skipped/failed: {sdk_err}")

        # 2. Attempt using Gemini REST API
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key={self.api_key}"
            payload = {
                "contents": [{
                    "parts": [{"text": f"Generate a cinematic concept portrait: {clean_prompt}"}]
                }]
            }
            async with httpx.AsyncClient(timeout=45.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        for p in parts:
                            if "inlineData" in p:
                                mime = p["inlineData"].get("mimeType", "image/jpeg")
                                b64_img = p["inlineData"].get("data", "")
                                if b64_img:
                                    print("Successfully generated image via Gemini REST API")
                                    return f"data:{mime};base64,{b64_img}"
                else:
                    print(f"Gemini Image REST API status {res.status_code}: {res.text[:120]}")
        except Exception as rest_err:
            print(f"Gemini Image REST API request failed: {rest_err}")

        # 3. Fallback to high-speed cinematic FLUX generator
        print("Gemini image generation unavailable (e.g. free tier quota limit: 0). Falling back to cinematic FLUX generator.")
        fallback = PollinationsImageAdapter()
        return await fallback.generate_image(clean_prompt, **kwargs)


# Alias GeminiImageAdapter
GeminiImageAdapter = GoogleImagenAdapter


def get_image_provider() -> BaseImageProvider:
    """Factory to automatically select the active image generation provider based on environment keys."""
    provider_pref = settings.IMAGE_PROVIDER.lower().strip() if settings.IMAGE_PROVIDER else "auto"

    if provider_pref == "huggingface" and settings.HUGGINGFACE_API_KEY:
        return HuggingFaceImageAdapter()
    elif provider_pref in ["imagen", "gemini"]:
        return GoogleImagenAdapter()
    elif provider_pref == "pollinations":
        return PollinationsImageAdapter()

    # Auto selection: prioritize Hugging Face token if present
    if settings.HUGGINGFACE_API_KEY:
        return HuggingFaceImageAdapter()
    elif settings.GEMINI_API_KEY:
        return GoogleImagenAdapter()

    return PollinationsImageAdapter()
 
 
class BaseAudioProvider(ABC):
    """Abstract base class for Text-To-Speech audio providers."""

    @abstractmethod
    async def generate_speech(self, text: str, voice_id: str = "en-US-ChristopherNeural", pitch: str = "+0Hz", rate: str = "+0%") -> str:
        """Generate audio from text and return audio URL or data URI."""
        pass


class EdgeTTSAudioAdapter(BaseAudioProvider):
    """Microsoft Edge Neural TTS Provider - distinct boy/girl cinematic, everyday normal, & anime voice classifications."""

    VOICE_PRESETS = {
        # Iconic Anime & Cartoon Voices
        "doraemon": {
            "voice": "en-US-AnaNeural",
            "pitch": "+18Hz",
            "rate": "+12%",
            "label": "Doraemon (Playful Robotic Cat)",
            "gender": "male"
        },
        "nobita": {
            "voice": "en-US-AnaNeural",
            "pitch": "+8Hz",
            "rate": "+4%",
            "label": "Nobita (Expressive Anime Boy)",
            "gender": "male"
        },
        "anime_kid_boy": {
            "voice": "en-US-AnaNeural",
            "pitch": "+8Hz",
            "rate": "+4%",
            "label": "Anime Boy / Kid",
            "gender": "male"
        },
        "anime_kid_girl": {
            "voice": "en-US-AnaNeural",
            "pitch": "+14Hz",
            "rate": "+4%",
            "label": "Anime Girl / Kid",
            "gender": "female"
        },
        "anime_shizuka": {
            "voice": "en-US-AnaNeural",
            "pitch": "+14Hz",
            "rate": "+2%",
            "label": "Shizuka (Sweet Anime Girl)",
            "gender": "female"
        },
        "anime_gian": {
            "voice": "en-US-GuyNeural",
            "pitch": "-8Hz",
            "rate": "+0%",
            "label": "Gian (Gruff Bully Boy)",
            "gender": "male"
        },
        "anime_suneo": {
            "voice": "en-US-EricNeural",
            "pitch": "+10Hz",
            "rate": "+10%",
            "label": "Suneo (Sneaky Kid)",
            "gender": "male"
        },

        # Normal / Grounded Everyday Characters
        "normal_child_boy": {"voice": "en-US-AnaNeural", "pitch": "+8Hz", "rate": "+4%", "label": "Child (Boy)", "gender": "male"},
        "normal_child_girl": {"voice": "en-US-AnaNeural", "pitch": "+14Hz", "rate": "+4%", "label": "Child (Girl)", "gender": "female"},
        "normal_teen_male": {"voice": "en-US-AndrewNeural", "pitch": "+2Hz", "rate": "+2%", "label": "Teen / Young Man", "gender": "male"},
        "normal_teen_female": {"voice": "en-US-AvaNeural", "pitch": "+2Hz", "rate": "+1%", "label": "Teen / Young Woman", "gender": "female"},
        "normal_adult_male": {"voice": "en-US-ChristopherNeural", "pitch": "+0Hz", "rate": "+0%", "label": "Adult (Male)", "gender": "male"},
        "normal_adult_female": {"voice": "en-US-JennyNeural", "pitch": "+0Hz", "rate": "+0%", "label": "Adult (Female)", "gender": "female"},
        "normal_elderly_male": {"voice": "en-US-BrianNeural", "pitch": "-5Hz", "rate": "-6%", "label": "Elderly / Mature (Male)", "gender": "male"},
        "normal_elderly_female": {"voice": "en-US-EmmaNeural", "pitch": "-3Hz", "rate": "-6%", "label": "Elderly / Mature (Female)", "gender": "female"},

        # Complex Heroic / Fantasy / Sci-Fi Voices
        "male_hero": {"voice": "en-US-ChristopherNeural", "pitch": "+1Hz", "rate": "+0%", "label": "Heroic Resonant (Male)", "gender": "male"},
        "male_villain": {"voice": "en-US-ChristopherNeural", "pitch": "-24Hz", "rate": "-12%", "label": "Demonic Gravel (Male)", "gender": "male"},
        "male_speed": {"voice": "en-US-EricNeural", "pitch": "+6Hz", "rate": "+12%", "label": "Hyper-Velocity (Male)", "gender": "male"},
        "male_tactical": {"voice": "en-US-BrianNeural", "pitch": "-3Hz", "rate": "+0%", "label": "Tactical Commander (Male)", "gender": "male"},
        "male_default": {"voice": "en-US-GuyNeural", "pitch": "+0Hz", "rate": "+0%", "label": "Narrator (Male)", "gender": "male"},

        "female_mystic": {"voice": "en-US-AvaNeural", "pitch": "-4Hz", "rate": "-5%", "label": "Arcane Ethereal (Female)", "gender": "female"},
        "female_warrior": {"voice": "en-US-JennyNeural", "pitch": "-2Hz", "rate": "+2%", "label": "Gritty Commander (Female)", "gender": "female"},
        "female_command": {"voice": "en-US-AriaNeural", "pitch": "+0Hz", "rate": "+3%", "label": "Dramatic Action (Female)", "gender": "female"},
        "female_intellect": {"voice": "en-US-EmmaNeural", "pitch": "+0Hz", "rate": "-2%", "label": "Intellectual Operative (Female)", "gender": "female"},
        "female_default": {"voice": "en-US-JennyNeural", "pitch": "+0Hz", "rate": "+0%", "label": "Narrator (Female)", "gender": "female"}
    }

    VOICESTUDIO_OR_CUSTOM_MAP = {
        "appu": "en-US-AnaNeural",
        "chintu": "en-US-EricNeural",
        "doraemon": "en-US-AnaNeural",
        "nobita": "en-US-AnaNeural",
        "default": "en-US-ChristopherNeural",
        "narrator": "en-US-ChristopherNeural",
    }
    ELEVEN_TO_EDGE_MAP = {
        "pNInz6obpgDQGcFmaJgB": "en-US-ChristopherNeural",
        "JBFqnCBsd6RMkjVDRZzb": "en-US-GuyNeural",
        "SOYHLrjzK2X1ezoPC6cr": "en-US-ChristopherNeural",
        "N2lVS1w4EtoT3dr4eOWO": "en-US-ChristopherNeural",
        "nPczCjzI2devNBz1zQrb": "en-US-BrianNeural",
        "TX3LPaxmHKxFdv7VOQHJ": "en-US-EricNeural",
        "CwhRBWXzGAHq8TQ4Fs17": "en-US-AndrewNeural",
        "cjVigY5qzO86Huf0OWal": "en-US-AndrewNeural",
        "EXAVITQu4vr4xnSDxMaL": "en-US-JennyNeural",
        "pFZP5JQG7iQjIQuC4Bku": "en-US-AvaNeural",
        "cgSgspJ2msm6clMCkdW9": "en-US-AnaNeural",
        "Xb7hH8MSUJpSbSDYk0k2": "en-US-EmmaNeural",
        "FGY2WhTYpPnrIDTdsKH5": "en-US-AriaNeural",
        "XrExE9yKIg1WjnnlVkGX": "en-US-EmmaNeural",
    }

    async def generate_speech(self, text: str, voice_id: str = "en-US-ChristopherNeural", pitch: str = "+0Hz", rate: str = "+0%") -> str:
        import edge_tts
        import base64
        clean_text = text.strip()

        resolved_voice = voice_id
        if resolved_voice in self.VOICE_PRESETS:
            preset = self.VOICE_PRESETS[resolved_voice]
            resolved_voice = preset["voice"]
            pitch = preset.get("pitch", pitch)
            rate = preset.get("rate", rate)
        elif resolved_voice in self.ELEVEN_TO_EDGE_MAP:
            resolved_voice = self.ELEVEN_TO_EDGE_MAP[resolved_voice]
        elif resolved_voice.lower() in self.VOICESTUDIO_OR_CUSTOM_MAP:
            resolved_voice = self.VOICESTUDIO_OR_CUSTOM_MAP[resolved_voice.lower()]
        elif "Neural" not in resolved_voice:
            resolved_voice = "en-US-ChristopherNeural"

        if pitch == "+0Hz" and rate == "+0%":
            for preset in self.VOICE_PRESETS.values():
                if preset["voice"] == resolved_voice and (preset.get("pitch") != "+0Hz" or preset.get("rate") != "+0%"):
                    pitch = preset["pitch"]
                    rate = preset["rate"]
                    break
        try:
            comm = edge_tts.Communicate(clean_text, resolved_voice, pitch=pitch, rate=rate)
            chunks = []
            async for chunk in comm.stream():
                if chunk["type"] == "audio":
                    chunks.append(chunk["data"])
            audio_bytes = b"".join(chunks)
            if audio_bytes:
                b64 = base64.b64encode(audio_bytes).decode("utf-8")
                return f"data:audio/mp3;base64,{b64}"
        except Exception as e:
            print(f"[EdgeTTS] Error generating speech with voice {resolved_voice}: {e}. Retrying with default voice.")
            comm = edge_tts.Communicate(clean_text, "en-US-GuyNeural")
            chunks = []
            async for chunk in comm.stream():
                if chunk["type"] == "audio":
                    chunks.append(chunk["data"])
            audio_bytes = b"".join(chunks)
            if audio_bytes:
                b64 = base64.b64encode(audio_bytes).decode("utf-8")
                return f"data:audio/mp3;base64,{b64}"
            raise e
        return ""

    def match_character_voice(self, char_name: str, char_role: str = "", description: str = "", gender: str = "") -> dict:
        import re
        name_lower = char_name.lower().strip()
        desc_lower = f"{char_name} {char_role} {description}".lower()

        # 1. Determine explicit gender using word boundaries
        is_female = False
        gender_clean = (gender or "").lower().strip()
        if gender_clean in ["female", "girl", "woman", "she"]:
            is_female = True
        elif gender_clean in ["male", "boy", "man", "he"]:
            is_female = False
        else:
            female_pattern = r'\b(female|woman|women|girl|girls|lady|she|her|mother|daughter|sister|actress|sorceress|witch|goddess|queen|princess|schoolgirl)\b'
            male_pattern = r'\b(male|man|men|boy|boys|guy|he|his|him|father|son|brother|actor|wizard|sorcerer|god|king|prince|schoolboy)\b'
            if re.search(female_pattern, desc_lower):
                is_female = True
            elif re.search(male_pattern, desc_lower):
                is_female = False

        # 2. Match specific iconic anime & cartoon characters
        if "appu" in name_lower or "elephant" in name_lower:
            return {
                "voice": "en-US-AnaNeural",
                "pitch": "+16Hz",
                "rate": "+6%",
                "label": "Appu (Baby Elephant)",
                "gender": "male"
            }
        elif "chintu" in name_lower or "tiger" in name_lower or "cub" in name_lower:
            return {
                "voice": "en-US-EricNeural",
                "pitch": "+12Hz",
                "rate": "+10%",
                "label": "Chintu (Tiger Cub)",
                "gender": "male"
            }
        elif "doraemon" in name_lower:
            return self.VOICE_PRESETS["doraemon"]
        elif "nobita" in name_lower:
            return self.VOICE_PRESETS["nobita"]
        elif "shizuka" in name_lower:
            return self.VOICE_PRESETS["anime_shizuka"]
        elif "gian" in name_lower or "takeshi" in name_lower:
            return self.VOICE_PRESETS["anime_gian"]
        elif "suneo" in name_lower:
            return self.VOICE_PRESETS["anime_suneo"]
        elif "solaris" in name_lower:
            return self.VOICE_PRESETS["male_hero"]
        elif "malakor" in name_lower:
            return self.VOICE_PRESETS["male_villain"]
        elif "shadow" in name_lower or "weaver" in name_lower:
            return self.VOICE_PRESETS["female_mystic"]
        elif "titaness" in name_lower:
            return self.VOICE_PRESETS["female_warrior"]
        elif "aero" in name_lower:
            return self.VOICE_PRESETS["male_speed"]

        # 3. Match cartoon mascot / robotic cat traits
        if any(w in desc_lower for w in ["robot cat", "mascot", "earless", "robotic cat", "cartoon cat"]):
            return self.VOICE_PRESETS["doraemon"]

        # 4. Match children & students
        if any(w in desc_lower for w in ["schoolboy", "little boy", "young boy", "kid boy", "child boy"]):
            return self.VOICE_PRESETS["nobita"]
        if is_female and any(w in desc_lower for w in ["schoolgirl", "little girl", "young girl", "kid girl", "child girl"]):
            return self.VOICE_PRESETS["anime_kid_girl"]
        if not is_female and any(w in desc_lower for w in ["kid", "child", "boy", "student", "schoolboy"]):
            return self.VOICE_PRESETS["normal_child_boy"]
        if is_female and any(w in desc_lower for w in ["kid", "child", "girl", "schoolgirl"]):
            return self.VOICE_PRESETS["normal_child_girl"]

        # 5. Match teens / young adults
        if any(w in desc_lower for w in ["teen", "teenager", "college", "young adult", "youth"]):
            return self.VOICE_PRESETS["normal_teen_female"] if is_female else self.VOICE_PRESETS["normal_teen_male"]

        # 6. Match elderly / grandparents / mentors
        if any(w in desc_lower for w in ["elder", "old", "grandfather", "grandmother", "grandpa", "grandma", "veteran", "senior"]):
            return self.VOICE_PRESETS["normal_elderly_female"] if is_female else self.VOICE_PRESETS["normal_elderly_male"]

        # 7. Match complex fantasy / sci-fi archetypes
        if is_female:
            if any(w in desc_lower for w in ["sorceress", "mystic", "arcane", "witch", "shadow", "purple", "amethyst", "fairy"]):
                return self.VOICE_PRESETS["female_mystic"]
            elif any(w in desc_lower for w in ["warrior", "titan", "armor", "defense", "soldier", "brute", "gauntlet"]):
                return self.VOICE_PRESETS["female_warrior"]
            elif any(w in desc_lower for w in ["command", "leader", "captain", "sharp", "action"]):
                return self.VOICE_PRESETS["female_command"]
            elif any(w in desc_lower for w in ["intellect", "tech", "scientist", "hacker", "cyber"]):
                return self.VOICE_PRESETS["female_intellect"]
            # Default normal adult female
            return self.VOICE_PRESETS["normal_adult_female"]
        else:
            if any(w in desc_lower for w in ["demon", "villain", "dark", "evil", "monster", "warlord", "obsidian", "antagonist"]):
                return self.VOICE_PRESETS["male_villain"]
            elif any(w in desc_lower for w in ["speed", "swift", "rapid", "supersonic", "vanguard"]):
                return self.VOICE_PRESETS["male_speed"]
            elif any(w in desc_lower for w in ["tactical", "commander", "captain", "soldier"]):
                return self.VOICE_PRESETS["male_tactical"]
            elif any(w in desc_lower for w in ["hero", "leader", "celestial", "sun", "gold", "light", "cosmic"]):
                return self.VOICE_PRESETS["male_hero"]
            # Default normal adult male
            return self.VOICE_PRESETS["normal_adult_male"]


class ElevenLabsAudioAdapter(BaseAudioProvider):
    """Studio-grade voiceover provider powered by ElevenLabs with automatic fallback to EdgeTTS."""

    _api_key_valid: bool | None = None

    VOICE_PRESETS = {
        # Narrative & Dramatic
        "narrator": {"voice": "pNInz6obpgDQGcFmaJgB", "label": "Adam (Dominant Movie Trailer Narrator)", "gender": "male"},
        "storyteller": {"voice": "JBFqnCBsd6RMkjVDRZzb", "label": "George (Warm Captivating Storyteller)", "gender": "male"},
        
        # Male Archetypes
        "male_hero": {"voice": "SOYHLrjzK2X1ezoPC6cr", "label": "Harry (Fierce Warrior Hero)", "gender": "male"},
        "male_villain": {"voice": "N2lVS1w4EtoT3dr4eOWO", "label": "Callum (Husky Trickster / Dark Antagonist)", "gender": "male"},
        "male_tactical": {"voice": "nPczCjzI2devNBz1zQrb", "label": "Brian (Deep Resonant Commander)", "gender": "male"},
        "male_young": {"voice": "TX3LPaxmHKxFdv7VOQHJ", "label": "Liam (Energetic Youth / Teen)", "gender": "male"},
        "male_casual": {"voice": "CwhRBWXzGAHq8TQ4Fs17", "label": "Roger (Laid-Back Resonant)", "gender": "male"},
        "normal_adult_male": {"voice": "cjVigY5qzO86Huf0OWal", "label": "Eric (Smooth Trustworthy Male)", "gender": "male"},

        # Female Archetypes
        "female_heroine": {"voice": "EXAVITQu4vr4xnSDxMaL", "label": "Sarah (Mature Reassuring Lead)", "gender": "female"},
        "female_mystic": {"voice": "pFZP5JQG7iQjIQuC4Bku", "label": "Lily (Velvety Sorceress / Ethereal)", "gender": "female"},
        "female_young": {"voice": "cgSgspJ2msm6clMCkdW9", "label": "Jessica (Bright Playful Lead)", "gender": "female"},
        "female_intellect": {"voice": "Xb7hH8MSUJpSbSDYk0k2", "label": "Alice (Clear Engaging Scientist / Android)", "gender": "female"},
        "female_action": {"voice": "FGY2WhTYpPnrIDTdsKH5", "label": "Laura (Quirky Enthusiastic Action)", "gender": "female"},
        "normal_adult_female": {"voice": "XrExE9yKIg1WjnnlVkGX", "label": "Matilda (Professional Reassuring Female)", "gender": "female"},

        # Iconic Cartoon / Anime fallbacks
        "doraemon": {"voice": "cgSgspJ2msm6clMCkdW9", "label": "Jessica (Playful Mascot / Robot Cat)", "gender": "male"},
        "nobita": {"voice": "TX3LPaxmHKxFdv7VOQHJ", "label": "Liam (Expressive Anime Boy)", "gender": "male"},
        "anime_kid_girl": {"voice": "cgSgspJ2msm6clMCkdW9", "label": "Jessica (Sweet Anime Girl)", "gender": "female"},
        "anime_kid_boy": {"voice": "TX3LPaxmHKxFdv7VOQHJ", "label": "Liam (Energetic Anime Boy)", "gender": "male"}
    }

    # Map Edge-TTS voice names to ElevenLabs premade IDs in case legacy IDs are provided
    EDGE_TO_ELEVEN_MAP = {
        "en-US-ChristopherNeural": "pNInz6obpgDQGcFmaJgB",
        "en-US-GuyNeural": "pNInz6obpgDQGcFmaJgB",
        "en-US-BrianNeural": "nPczCjzI2devNBz1zQrb",
        "en-US-EricNeural": "TX3LPaxmHKxFdv7VOQHJ",
        "en-US-AndrewNeural": "cjVigY5qzO86Huf0OWal",
        "en-US-JennyNeural": "EXAVITQu4vr4xnSDxMaL",
        "en-US-AvaNeural": "Xb7hH8MSUJpSbSDYk0k2",
        "en-US-AnaNeural": "cgSgspJ2msm6clMCkdW9",
        "en-US-AriaNeural": "FGY2WhTYpPnrIDTdsKH5",
        "en-US-EmmaNeural": "XrExE9yKIg1WjnnlVkGX"
    }

    def __init__(self, api_key: str = "", model_id: str = "eleven_multilingual_v2"):
        self.api_key = api_key or settings.ELEVENLABS_API_KEY
        self.model_id = model_id
        self._fallback_provider = EdgeTTSAudioAdapter()

    async def generate_speech(self, text: str, voice_id: str = "pNInz6obpgDQGcFmaJgB", pitch: str = "+0Hz", rate: str = "+0%") -> str:
        import httpx
        import base64

        clean_text = text.strip()
        if not clean_text:
            return ""

        if ElevenLabsAudioAdapter._api_key_valid is False or not self.api_key:
            return await self._fallback_provider.generate_speech(text, voice_id=voice_id, pitch=pitch, rate=rate)

        # Map EdgeTTS voice names if passed
        resolved_voice = self.EDGE_TO_ELEVEN_MAP.get(voice_id, voice_id)
        # If not a valid ElevenLabs voice ID length (standard is 20 chars), fallback to default
        if len(resolved_voice) < 15:
            resolved_voice = "pNInz6obpgDQGcFmaJgB"

        url = f"https://api.elevenlabs.io/v1/text-to-speech/{resolved_voice}"
        headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg"
        }
        payload = {
            "text": clean_text,
            "model_id": self.model_id,
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75,
                "style": 0.0,
                "use_speaker_boost": True
            }
        }

        try:
            async with httpx.AsyncClient(timeout=45.0) as client:
                resp = await client.post(url, headers=headers, json=payload)
                if resp.status_code == 200:
                    ElevenLabsAudioAdapter._api_key_valid = True
                    b64_audio = base64.b64encode(resp.content).decode("utf-8")
                    return f"data:audio/mp3;base64,{b64_audio}"
                else:
                    if resp.status_code in (401, 403):
                        ElevenLabsAudioAdapter._api_key_valid = False
                    print(f"[ElevenLabsAudioAdapter] API returned {resp.status_code}: {resp.text[:120]}. Falling back to EdgeTTS.")
        except Exception as e:
            print(f"[ElevenLabsAudioAdapter] Network or generation error: {e}. Falling back to EdgeTTS.")

        # Fallback to EdgeTTS if ElevenLabs request fails
        return await self._fallback_provider.generate_speech(text, voice_id=voice_id, pitch=pitch, rate=rate)

    def match_character_voice(self, char_name: str, char_role: str = "", description: str = "", gender: str = "") -> dict:
        import re
        name_lower = char_name.lower().strip()
        desc_lower = f"{char_name} {char_role} {description}".lower()

        # 1. Determine explicit gender
        is_female = False
        gender_clean = (gender or "").lower().strip()
        if gender_clean in ["female", "girl", "woman", "she"]:
            is_female = True
        elif gender_clean in ["male", "boy", "man", "he"]:
            is_female = False
        else:
            female_pattern = r'\b(female|woman|women|girl|girls|lady|she|her|mother|daughter|sister|actress|sorceress|witch|goddess|queen|princess|schoolgirl)\b'
            male_pattern = r'\b(male|man|men|boy|boys|guy|he|his|him|father|son|brother|actor|wizard|sorcerer|god|king|prince|schoolboy)\b'
            if re.search(female_pattern, desc_lower):
                is_female = True
            elif re.search(male_pattern, desc_lower):
                is_female = False

        preset = None
        # 2. Check for Narrator / Voiceover
        if any(w in name_lower for w in ["narrator", "voiceover", "announcer", "prologue", "host"]):
            preset = self.VOICE_PRESETS["narrator"]
        # 3. Check for iconic cartoon / anime characters
        elif "doraemon" in name_lower:
            preset = self.VOICE_PRESETS["doraemon"]
        elif "nobita" in name_lower:
            preset = self.VOICE_PRESETS["nobita"]
        elif any(w in desc_lower for w in ["child", "kid", "little boy", "young boy"]):
            preset = self.VOICE_PRESETS["anime_kid_girl"] if is_female else self.VOICE_PRESETS["anime_kid_boy"]
        # 4. Check for villain / dark archetype
        elif any(w in desc_lower for w in ["villain", "dark", "evil", "demon", "monster", "antagonist", "traitor"]):
            preset = self.VOICE_PRESETS["female_mystic"] if is_female else self.VOICE_PRESETS["male_villain"]
        # 5. Check for warrior / hero archetype
        elif any(w in desc_lower for w in ["warrior", "hero", "soldier", "titan", "fighter", "champion"]):
            preset = self.VOICE_PRESETS["female_action"] if is_female else self.VOICE_PRESETS["male_hero"]
        # 6. Check for tactical / commander / detective archetype
        elif any(w in desc_lower for w in ["tactical", "commander", "captain", "detective", "enforcer", "police", "officer"]):
            preset = self.VOICE_PRESETS["female_heroine"] if is_female else self.VOICE_PRESETS["male_tactical"]
        # 7. Check for intellect / scientist / android archetype
        elif any(w in desc_lower for w in ["scientist", "tech", "hacker", "android", "cyber", "robot", "ai", "doctor"]):
            preset = self.VOICE_PRESETS["female_intellect"] if is_female else self.VOICE_PRESETS["storyteller"]
        # 8. Check for mystical / sorceress
        elif any(w in desc_lower for w in ["sorceress", "witch", "mystic", "arcane", "magic", "spirit", "priest"]):
            preset = self.VOICE_PRESETS["female_mystic"] if is_female else self.VOICE_PRESETS["storyteller"]
        # 9. Youth / Teen
        elif any(w in desc_lower for w in ["teen", "youth", "student"]):
            preset = self.VOICE_PRESETS["female_young"] if is_female else self.VOICE_PRESETS["male_young"]
        else:
            preset = self.VOICE_PRESETS["normal_adult_female"] if is_female else self.VOICE_PRESETS["normal_adult_male"]

        return {
            "voice": preset["voice"],
            "label": preset["label"],
            "gender": preset["gender"],
            "pitch": "+0Hz",
            "rate": "+0%"
        }


class VoiceStudioAudioAdapter(BaseAudioProvider):
    """
    Open-source local voice synthesis provider powered by VoiceStudio (OmniVoice / XTTS / Kokoro).
    Connects to local OpenAI-compatible REST API (default http://localhost:8080/v1).
    Falls back gracefully to EdgeTTS if VoiceStudio local instance is unreachable.
    """
    def __init__(self, api_url: str = ""):
        self.api_url = (api_url or getattr(settings, "VOICESTUDIO_API_URL", "http://localhost:8080/v1")).rstrip("/")
        self._fallback_provider = EdgeTTSAudioAdapter()

    async def generate_speech(self, text: str, voice_id: str = "default", pitch: str = "+0Hz", rate: str = "+0%", prompt: str = "") -> str:
        import httpx
        import base64

        clean_text = text.strip()
        if not clean_text:
            return ""

        url = f"{self.api_url}/audio/speech"
        payload = {
            "model": "omni-voice",
            "input": clean_text,
            "voice": voice_id,
            "prompt": prompt or f"Expressive character voice for: {voice_id}",
            "response_format": "mp3"
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, json=payload)
                if resp.status_code == 200 and len(resp.content) > 500:
                    b64 = base64.b64encode(resp.content).decode("utf-8")
                    return f"data:audio/mp3;base64,{b64}"
                else:
                    print(f"[VoiceStudio] Endpoint returned {resp.status_code}. Falling back to EdgeTTS.")
        except Exception as e:
            print(f"[VoiceStudio] Local instance unreachable at {self.api_url} ({e}). Falling back to EdgeTTS.")

        return await self._fallback_provider.generate_speech(text, voice_id=voice_id, pitch=pitch, rate=rate)

    def match_character_voice(self, char_name: str, char_role: str = "", description: str = "", gender: str = "") -> dict:
        name_lower = char_name.lower().strip()
        if "appu" in name_lower or "elephant" in name_lower:
            prompt = "A squeaky, cheerful 4-year-old baby elephant with playful giggles and warm tone"
            fallback = {"voice": "en-US-AnaNeural", "pitch": "+16Hz", "rate": "+6%", "label": "Appu (VoiceStudio / Baby Elephant)", "gender": "male"}
        elif "chintu" in name_lower or "tiger" in name_lower:
            prompt = "An energetic, feisty baby tiger cub with a raspy laugh and high-pitched excitement"
            fallback = {"voice": "en-US-EricNeural", "pitch": "+12Hz", "rate": "+10%", "label": "Chintu (VoiceStudio / Tiger Cub)", "gender": "male"}
        else:
            prompt = f"Expressive voice for {char_name}: {char_role}, {description}"
            fallback = self._fallback_provider.match_character_voice(char_name, char_role, description, gender)

        return {
            "voice": name_lower.replace(" ", "_"),
            "voice_prompt": prompt,
            "label": fallback.get("label", char_name),
            "gender": fallback.get("gender", "male"),
            "pitch": fallback.get("pitch", "+0Hz"),
            "rate": fallback.get("rate", "+0%")
        }


def get_audio_provider() -> BaseAudioProvider:
    """Factory to return active audio generation provider (VoiceStudio, ElevenLabs, or EdgeTTS)."""
    provider_pref = (getattr(settings, "AUDIO_PROVIDER", "") or "auto").lower().strip()
    if provider_pref == "edgetts":
        return EdgeTTSAudioAdapter()
    if provider_pref == "elevenlabs" and getattr(settings, "ELEVENLABS_API_KEY", ""):
        return ElevenLabsAudioAdapter()
    if provider_pref == "voicestudio":
        return VoiceStudioAudioAdapter()

    # auto mode: prioritize explicit keys or configured availability
    if getattr(settings, "ENABLE_VOICESTUDIO", False):
        return VoiceStudioAudioAdapter()
    if getattr(settings, "ELEVENLABS_API_KEY", ""):
        return ElevenLabsAudioAdapter()
    return EdgeTTSAudioAdapter()
