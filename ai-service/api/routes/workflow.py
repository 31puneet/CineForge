from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional
import asyncio
import json
import traceback
import os
from langchain_core.messages import HumanMessage
from fastapi.responses import StreamingResponse

from agents.graph import app as graph_app
from schemas.state import FilmGraphState
from core.events import WorkflowEventEmitter, get_event_queue, respond_to_approval

router = APIRouter(prefix="/workflow", tags=["workflow"])

class StartWorkflowRequest(BaseModel):
    project_id: str
    user_prompt: str
    metadata: Optional[Dict[str, Any]] = None

class RespondApprovalRequest(BaseModel):
    project_id: str
    approved: bool
    reason: str = ""

class RegenerateCharacterRequest(BaseModel):
    project_id: str
    character_id: str
    feedback: Optional[str] = None

class RegenerateVoiceoverRequest(BaseModel):
    project_id: str
    shot_id: str
    voice_id: Optional[str] = None
    dialogue: Optional[str] = None

class RegenerateShotRequest(BaseModel):
    project_id: str
    shot_id: str
    feedback: Optional[str] = None

import os
STATE_CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", "..", ".state_cache")
os.makedirs(STATE_CACHE_DIR, exist_ok=True)

_memory_store: Dict[str, FilmGraphState] = {}

def load_persisted_state(project_id: str) -> Optional[FilmGraphState]:
    cache_path = os.path.join(STATE_CACHE_DIR, f"{project_id}.json")
    if os.path.exists(cache_path):
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                messages = []
                for m in data.get("messages", []):
                    if isinstance(m, dict):
                        messages.append(HumanMessage(content=m.get("content", "")))
                    elif isinstance(m, str):
                        messages.append(HumanMessage(content=m))
                data["messages"] = messages
                _memory_store[project_id] = data
                return data
        except Exception as e:
            print(f"Error loading state cache: {e}")
    if project_id in _memory_store:
        return _memory_store[project_id]
    return None

def save_persisted_state(project_id: str, state: FilmGraphState):
    _memory_store[project_id] = state
    cache_path = os.path.join(STATE_CACHE_DIR, f"{project_id}.json")
    try:
        serializable = {
            "project_id": state.get("project_id"),
            "metadata": state.get("metadata", {}),
            "current_stage": state.get("current_stage"),
            "script_data": state.get("script_data"),
            "script_version": state.get("script_version", 0),
            "script_history": state.get("script_history", []),
            "characters": state.get("characters", []),
            "voiceovers": state.get("voiceovers", []),
            "video_shots": state.get("video_shots", []),
            "approval_states": state.get("approval_states", {}),
            "messages": [
                {"role": "user" if isinstance(m, HumanMessage) else "assistant", "content": getattr(m, "content", str(m))}
                for m in state.get("messages", [])
            ]
        }
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(serializable, f, indent=2)
    except Exception as e:
        print(f"Error saving state cache: {e}")

def are_video_shots_valid(state: Dict[str, Any]) -> bool:
    script_shots = state.get("script_data", {}).get("shots", [])
    video_shots = state.get("video_shots", [])
    if not script_shots or not video_shots:
        return False
    completed_ids = {
        vs.get("shot_id") for vs in video_shots
        if vs.get("status") == "completed" and vs.get("video_url")
    }
    all_shot_ids = {
        s.get("id") or s.get("shot_id") or f"shot_{i+1}"
        for i, s in enumerate(script_shots)
    }
    return bool(all_shot_ids) and all_shot_ids.issubset(completed_ids)

@router.post("/start")
async def start_workflow(req: StartWorkflowRequest):
    cached = load_persisted_state(req.project_id)
    
    # Process potential attachments
    content_blocks = [{"type": "text", "text": req.user_prompt}]
    if req.metadata and "attachments" in req.metadata:
        for att in req.metadata["attachments"]:
            mime_type = "unknown"
            if "data:" in att.get("url", ""):
                mime_type = att["url"].split(";")[0].replace("data:", "")
                
            if att.get("type") == "image_url" or "image/" in mime_type:
                content_blocks.append({
                    "type": "image_url",
                    "image_url": {"url": att.get("url")}
                })
            else:
                try:
                    import base64, io
                    b64_str = att.get("url", "")
                    if "," in b64_str:
                        b64_str = b64_str.split(",", 1)[1]
                    file_bytes = base64.b64decode(b64_str)
                    
                    extracted_text = ""
                    if "pdf" in mime_type:
                        import fitz
                        doc = fitz.open(stream=file_bytes, filetype="pdf")
                        for page in doc:
                            extracted_text += page.get_text() + "\n"
                        doc.close()
                    elif "word" in mime_type or "officedocument.wordprocessingml" in mime_type:
                        import docx
                        doc = docx.Document(io.BytesIO(file_bytes))
                        for para in doc.paragraphs:
                            extracted_text += para.text + "\n"
                    elif "text/plain" in mime_type:
                        extracted_text = file_bytes.decode("utf-8", errors="ignore")
                        
                    if extracted_text.strip():
                        content_blocks.append({
                            "type": "text",
                            "text": f"\n\n[Content from attached file '{att.get('name', 'document')}']:\n{extracted_text}\n"
                        })
                except Exception as e:
                    print(f"Failed to extract document {att.get('name')}: {e}")

    prompt_clean = req.user_prompt.strip().lower()
    approval_keywords = [
        "continue", "proceed", "next", "ok", "yes", "go on", "yep", "sure", 
        "looks good", "approve", "approved", "perfect", "good", "move on", "advance"
    ]
    is_continuation = any(prompt_clean == kw or prompt_clean.startswith(kw) for kw in approval_keywords)
    
    if cached and cached.get("script_data"):
        active_state = cached
        active_state["messages"].append(HumanMessage(content=content_blocks if len(content_blocks) > 1 else req.user_prompt))
        if req.metadata:
            active_state.setdefault("metadata", {}).update(req.metadata)
            
        approval_states = active_state.setdefault("approval_states", {})
        if is_continuation:
            if not approval_states.get("script_approved") and active_state.get("script_data"):
                approval_states["script_approved"] = True
                respond_to_approval(req.project_id, True)
            elif not approval_states.get("characters_approved") and active_state.get("characters"):
                approval_states["characters_approved"] = True
                respond_to_approval(req.project_id, True)
            elif not approval_states.get("voiceovers_approved") and active_state.get("voiceovers"):
                approval_states["voiceovers_approved"] = True
                respond_to_approval(req.project_id, True)
            elif not approval_states.get("video_approved") and active_state.get("video_shots"):
                if are_video_shots_valid(active_state):
                    approval_states["video_approved"] = True
                    respond_to_approval(req.project_id, True)
                else:
                    approval_states["video_approved"] = False
                    active_state["current_stage"] = "video"
                    respond_to_approval(req.project_id, True)
            elif active_state.get("current_stage") == "editor_failed":
                if are_video_shots_valid(active_state):
                    approval_states["video_approved"] = True
                    respond_to_approval(req.project_id, True)
                else:
                    approval_states["video_approved"] = False
                    active_state["current_stage"] = "video"
                    respond_to_approval(req.project_id, True)
        else:
            respond_to_approval(req.project_id, False, req.user_prompt)
        save_persisted_state(req.project_id, active_state)
    else:
        active_state = {
            "project_id": req.project_id,
            "metadata": req.metadata or (cached.get("metadata", {}) if cached else {}),
            "messages": [HumanMessage(content=content_blocks if len(content_blocks) > 1 else req.user_prompt)],
            "current_stage": "script",
            "script_data": None,
            "script_version": 0,
            "script_history": [],
            "characters": [],
            "character_version": 0,
            "character_history": [],
            "voiceovers": [],
            "video_shots": [],
            "approval_states": {
                "script_approved": False,
                "characters_approved": False,
                "voiceovers_approved": False,
                "video_approved": False
            }
        }
    
    config = {"configurable": {"thread_id": req.project_id}}
    
    # Initialize the event emitter
    emitter = WorkflowEventEmitter(req.project_id)
    config["configurable"]["emitter"] = emitter
    
    async def update_state(s):
        save_persisted_state(req.project_id, s)
        _memory_store[req.project_id] = s
        
        backend_url = os.getenv("BACKEND_URL", "http://cineforge-backend:3000")
        internal_api_key = os.environ.get("INTERNAL_API_KEY")
        if not internal_api_key:
            return

        try:
            import httpx
            from langchain_core.messages import BaseMessage
            serializable_state = dict(s)
            if "messages" in serializable_state:
                cleaned_messages = []
                for m in serializable_state.get("messages", []):
                    if isinstance(m, BaseMessage):
                        content = m.content
                        if isinstance(content, list):
                            content = [
                                {"type": "text", "text": "[Image attached]"} if b.get("type") == "image_url" else b
                                for b in content
                            ]
                        cleaned_messages.append({"role": m.type, "content": content})
                    else:
                        cleaned_messages.append(m)
                serializable_state["messages"] = cleaned_messages

            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.put(
                    f"{backend_url}/api/internal/projects/{req.project_id}/messages/state", 
                    json=serializable_state,
                    headers={"x-internal-api-key": internal_api_key}
                )
                resp.raise_for_status()
        except Exception as e:
            print(f"Failed to persist state to backend: {e}")
    config["configurable"]["update_state"] = update_state

    async def run_graph():
        try:
            final_state = await graph_app.ainvoke(active_state, config)
            save_persisted_state(req.project_id, final_state)
            await update_state(final_state)
        except Exception as e:
            # Send error event
            traceback.print_exc()
            print(f"Graph execution failed: {e}")
            err_str = str(e)
            if "503" in err_str or "high demand" in err_str.lower() or "unavailable" in err_str.lower():
                friendly_msg = "The AI service is temporarily experiencing high demand from Google. Please try again in a few moments."
            elif "429" in err_str or "quota" in err_str.lower() or "resource_exhausted" in err_str.lower():
                friendly_msg = "Rate limit reached. Please wait a few moments and try again."
            else:
                friendly_msg = err_str
            await emitter.push("error", content=friendly_msg)
        finally:
            await emitter.push("done")


    # Start graph in background
    asyncio.create_task(run_graph())

    async def event_stream():
        queue = get_event_queue(req.project_id)
        if not queue:
            yield json.dumps({"type": "error", "content": "No active workflow"}) + "\n"
            return
            
        while True:
            try:
                event_str = await asyncio.wait_for(queue.get(), timeout=10.0)
                yield event_str
                event = json.loads(event_str)
                if event.get("type") == "done" or event.get("type") == "error":
                    break
            except asyncio.TimeoutError:
                # Send heartbeat
                yield json.dumps({"type": "ping"}) + "\n"
            except asyncio.CancelledError:
                break
            except Exception as e:
                yield json.dumps({"type": "error", "content": str(e)}) + "\n"
                break

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")

@router.post("/respond")
@router.post("/approve")
async def respond_approval(req: RespondApprovalRequest):
    respond_to_approval(req.project_id, req.approved, req.reason)
    cached = load_persisted_state(req.project_id)
    if cached:
        approval_states = cached.setdefault("approval_states", {})
        if req.approved:
            if not approval_states.get("script_approved") and cached.get("script_data"):
                approval_states["script_approved"] = True
            elif not approval_states.get("characters_approved") and cached.get("characters"):
                approval_states["characters_approved"] = True
            elif not approval_states.get("voiceovers_approved") and cached.get("voiceovers"):
                approval_states["voiceovers_approved"] = True
            elif not approval_states.get("video_approved") and cached.get("video_shots"):
                if are_video_shots_valid(cached):
                    approval_states["video_approved"] = True
                else:
                    approval_states["video_approved"] = False
                    cached["current_stage"] = "video"
            elif cached.get("current_stage") == "editor_failed":
                if are_video_shots_valid(cached):
                    approval_states["video_approved"] = True
                else:
                    approval_states["video_approved"] = False
                    cached["current_stage"] = "video"
        save_persisted_state(req.project_id, cached)
    return {"status": "ok"}

@router.post("/regenerate-character")
async def regenerate_character(req: RegenerateCharacterRequest):
    state = load_persisted_state(req.project_id)
    if not state:
        raise HTTPException(status_code=404, detail="Workflow not found for this project")
    
    characters = state.get("characters", [])
    target_char = next((c for c in characters if c["id"] == req.character_id), None)
    if not target_char:
        raise HTTPException(status_code=404, detail=f"Character {req.character_id} not found")
    
    from core.providers import GeminiAdapter, get_image_provider
    image_adapter = get_image_provider()
    
    if req.feedback:
        try:
            adapter = GeminiAdapter()
            prompt = f"""Revise this character visual concept prompt based on user feedback.
Character: {target_char['name']} ({target_char.get('role', 'Character')})
Current description: {target_char.get('description', '')}
Current visual prompt: {target_char.get('image_prompt', '')}
User feedback: {req.feedback}

Output ONLY the revised 8K cinematic concept portrait prompt, with no extra conversational text."""
            new_prompt = adapter.generate_text(prompt)
            target_char["image_prompt"] = new_prompt.strip()
        except Exception as e:
            print(f"LLM prompt refinement skipped due to: {e}")
            target_char["image_prompt"] = f"{target_char.get('image_prompt', target_char['name'])}, {req.feedback}"

    import random
    new_seed = random.randint(100000, 999999)
    new_url = await image_adapter.generate_image(target_char.get("image_prompt", target_char["name"]), seed=new_seed)
    target_char["image_url"] = new_url
    
    save_persisted_state(req.project_id, state)
    
    return {"status": "ok", "character": target_char}

@router.post("/regenerate-voiceover")
async def regenerate_voiceover(req: RegenerateVoiceoverRequest):
    state = load_persisted_state(req.project_id)
    if not state:
        raise HTTPException(status_code=404, detail="Workflow not found for this project")
    
    voiceovers = state.get("voiceovers", [])
    target_vo = next((v for v in voiceovers if v["shot_id"] == req.shot_id), None)
    if not target_vo:
        raise HTTPException(status_code=404, detail=f"Voiceover for shot {req.shot_id} not found")
    
    from core.providers import get_audio_provider
    tts = get_audio_provider()
    
    text = req.dialogue or target_vo.get("dialogue", "")
    voice_id = req.voice_id or target_vo.get("voice_id", "en-US-ChristopherNeural")
    
    new_audio_url = await tts.generate_speech(text=text, voice_id=voice_id)
    target_vo["audio_url"] = new_audio_url
    if req.dialogue:
        target_vo["dialogue"] = req.dialogue
    if req.voice_id:
        target_vo["voice_id"] = req.voice_id
        target_vo["voice_name"] = req.voice_id
        
    save_persisted_state(req.project_id, state)
    
    return {"status": "ok", "voiceover": target_vo}

@router.post("/regenerate-shot")
async def regenerate_shot(req: RegenerateShotRequest):
    state = load_persisted_state(req.project_id)
    if not state:
        raise HTTPException(status_code=404, detail="Workflow not found for this project")
    
    video_shots = state.get("video_shots", [])
    target_shot = next((s for s in video_shots if s["shot_id"] == req.shot_id), None)
    if not target_shot:
        raise HTTPException(status_code=404, detail=f"Shot {req.shot_id} not found")
    
    renders_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "frontend", "public", "renders", req.project_id))
    os.makedirs(renders_dir, exist_ok=True)

    from core.video_generator import generate_ai_video_clip, QuotaExceededError
    from core.media_processor import FFMPEG_BIN, probe, compute_shot_duration
    from core.config import settings

    shot_img = os.path.join(renders_dir, f"{req.shot_id}_scene.jpg")
    if not os.path.exists(shot_img):
        # Fallback to any character or default
        for f in os.listdir(renders_dir):
            if f.endswith((".jpg", ".png")) and "thumb" not in f:
                shot_img = os.path.join(renders_dir, f)
                break

    motion_prompt = f"{target_shot.get('speaker', '')}: {req.feedback or target_shot.get('prompt', '')}"
    raw_clip_out = os.path.join(renders_dir, f"{req.shot_id}_raw.mp4")
    final_clip_out = os.path.join(renders_dir, f"{req.shot_id}.mp4")
    shot_dur = float(target_shot.get("duration_sec") or target_shot.get("duration_seconds") or settings.PROVIDER_CLIP_SECONDS)

    try:
        ai_clip = await asyncio.to_thread(
            lambda: generate_ai_video_clip(
                image_path=shot_img,
                prompt=motion_prompt,
                hf_token=settings.HUGGINGFACE_API_KEY,
                duration=shot_dur,
                steps=4
            )
        )
        if ai_clip and os.path.exists(ai_clip):
            import shutil
            shutil.copyfile(ai_clip, raw_clip_out)
            shutil.copyfile(ai_clip, final_clip_out)
            target_shot["status"] = "completed"
            target_shot["video_url"] = f"/renders/{req.project_id}/{req.shot_id}.mp4"
            target_shot["static_fallback"] = False
            target_shot["duration_sec"] = shot_dur
            target_shot["duration_seconds"] = shot_dur
            target_shot["error_message"] = None
        else:
            raise RuntimeError("Video generation produced no clip")
    except QuotaExceededError as qe:
        target_shot["status"] = "failed_quota"
        target_shot["error_message"] = str(qe)
    except Exception as e:
        target_shot["status"] = "failed"
        target_shot["error_message"] = str(e)

    # Refresh thumbnail
    thumb_path = os.path.join(renders_dir, f"thumb_{req.shot_id}.jpg")
    if os.path.exists(final_clip_out):
        import subprocess
        subprocess.run([FFMPEG_BIN, "-y", "-ss", "00:00:01", "-i", final_clip_out, "-vframes", "1", thumb_path], capture_output=True)
        target_shot["thumbnail_url"] = f"/renders/{req.project_id}/thumb_{req.shot_id}.jpg"

    save_persisted_state(req.project_id, state)
    return {"status": "ok", "shot": target_shot}

@router.get("/state/{project_id}")
async def get_workflow_state(project_id: str):
    state = load_persisted_state(project_id)
    if not state:
        return {"current_stage": None, "script_data": None, "characters": [], "voiceovers": [], "video_shots": [], "final_video_url": None, "approval_states": {}}
    
    return {
        "current_stage": state.get("current_stage"),
        "script_data": state.get("script_data"),
        "script_version": state.get("script_version", 0),
        "script_history": state.get("script_history", []),
        "characters": state.get("characters", []),
        "character_version": state.get("character_version", 0),
        "character_history": state.get("character_history", []),
        "voiceovers": state.get("voiceovers", []),
        "video_shots": state.get("video_shots", []),
        "final_video_url": state.get("final_video_url"),
        "total_film_duration": state.get("total_film_duration", 60.0),
        "approval_states": state.get("approval_states", {})
    }
