from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel
from typing import Dict, Any, Optional
import asyncio
import copy
import hmac
import json
import logging
import re
import os
from pathlib import Path
from langchain_core.messages import HumanMessage, AIMessage
from fastapi.responses import StreamingResponse

from agents.graph import app as graph_app
from schemas.state import FilmGraphState
from core.config import settings
from core.events import WorkflowEventEmitter, get_event_queue, respond_to_approval
from core.storage import media_storage

logger = logging.getLogger("cineforge.workflow")

async def verify_internal_api_key(x_internal_api_key: Optional[str] = Header(default=None)):
    expected = settings.INTERNAL_API_KEY
    if expected and (not x_internal_api_key or not hmac.compare_digest(x_internal_api_key, expected)):
        raise HTTPException(status_code=401, detail="Unauthorized internal access")

router = APIRouter(prefix="/workflow", tags=["workflow"], dependencies=[Depends(verify_internal_api_key)])
_project_locks: Dict[str, asyncio.Lock] = {}
_active_tasks: Dict[str, asyncio.Task] = {}

def _get_project_lock(project_id: str) -> asyncio.Lock:
    lock = _project_locks.get(project_id)
    if lock is None:
        lock = asyncio.Lock()
        _project_locks[project_id] = lock
    return lock

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

class ApproveShotRequest(BaseModel):
    project_id: str
    shot_id: str
    approved: bool
    feedback: Optional[str] = None

STATE_CACHE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".state_cache"))
os.makedirs(STATE_CACHE_DIR, exist_ok=True)
RENDERS_ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "frontend", "public", "renders"))

_PROJECT_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")

def _validate_project_id(project_id: str) -> str:
    if not project_id or not _PROJECT_ID_RE.fullmatch(project_id):
        raise HTTPException(status_code=400, detail="Invalid project_id")
    return project_id

def _get_cache_path(project_id: str) -> str:
    pid = _validate_project_id(project_id)
    target = Path(STATE_CACHE_DIR, f"{pid}.json").resolve()
    root = Path(STATE_CACHE_DIR).resolve()
    if root not in target.parents:
        raise HTTPException(status_code=400, detail="Invalid project_id path")
    return str(target)

def _get_renders_dir(project_id: str) -> str:
    pid = _validate_project_id(project_id)
    target = Path(RENDERS_ROOT_DIR, pid).resolve()
    root = Path(RENDERS_ROOT_DIR).resolve()
    if root not in target.parents:
        raise HTTPException(status_code=400, detail="Invalid renders directory")
    os.makedirs(target, exist_ok=True)
    return str(target)

_memory_store: Dict[str, FilmGraphState] = {}

def load_persisted_state(project_id: str) -> Optional[FilmGraphState]:
    cache_path = _get_cache_path(project_id)
    if os.path.exists(cache_path):
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                messages = []
                for m in data.get("messages", []):
                    if isinstance(m, dict):
                        content = m.get("content", "")
                        if m.get("role") == "user":
                            messages.append(HumanMessage(content=content))
                        else:
                            messages.append(AIMessage(content=content))
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
    cache_path = _get_cache_path(project_id)
    tmp_path = f"{cache_path}.tmp"
    try:
        final_film = state.get("final_film_url") or state.get("final_video_url")
        serializable = {
            "project_id": state.get("project_id"),
            "metadata": state.get("metadata", {}),
            "current_stage": state.get("current_stage"),
            "script_data": state.get("script_data"),
            "script_version": state.get("script_version", 0),
            "script_history": state.get("script_history", []),
            "characters": state.get("characters", []),
            "character_version": state.get("character_version", 0),
            "character_history": state.get("character_history", []),
            "voiceovers": state.get("voiceovers", []),
            "video_shots": state.get("video_shots", []),
            "final_film_url": final_film,
            "final_video_url": final_film,
            "manifest": state.get("manifest"),
            "total_film_duration": state.get("total_film_duration", 60.0),
            "approval_states": state.get("approval_states", {}),
            "messages": [
                {"role": "user" if isinstance(m, HumanMessage) else "assistant", "content": getattr(m, "content", str(m))}
                for m in state.get("messages", [])
            ]
        }
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(serializable, f, indent=2)
        os.replace(tmp_path, cache_path)
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
    
    # Process potential attachments with size & scheme guards
    MAX_ATTACHMENT_B64_CHARS = 14_000_000
    content_blocks = [{"type": "text", "text": req.user_prompt}]
    if req.metadata and "attachments" in req.metadata:
        for att in req.metadata["attachments"]:
            att_url = att.get("url", "")
            if not isinstance(att_url, str) or len(att_url) > MAX_ATTACHMENT_B64_CHARS:
                raise HTTPException(status_code=400, detail="Attachment exceeds maximum allowed size")

            mime_type = "unknown"
            if att_url.startswith("data:") and ";" in att_url:
                mime_type = att_url.split(";")[0].replace("data:", "")

            if att.get("type") == "image_url" or "image/" in mime_type:
                if not (att_url.startswith("data:image/") or att_url.startswith("https://")):
                    raise HTTPException(status_code=400, detail="Invalid image attachment URL scheme")
                content_blocks.append({
                    "type": "image_url",
                    "image_url": {"url": att_url}
                })
            else:
                try:
                    import base64
                    import io
                    b64_str = att_url.split(",", 1)[1] if "," in att_url else att_url
                    if len(b64_str) > MAX_ATTACHMENT_B64_CHARS:
                        raise HTTPException(status_code=400, detail="Attachment payload too large")
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
                except HTTPException:
                    raise
                except Exception as e:
                    logger.warning("Failed to extract document %s: %s", att.get("name"), e)

    prompt_clean = req.user_prompt.strip().lower().rstrip(".!")
    approval_keywords = {
        "continue", "proceed", "next", "ok", "yes", "go on", "yep", "sure",
        "looks good", "approve", "approved", "perfect", "good", "move on", "advance"
    }
    is_continuation = prompt_clean in approval_keywords
    
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
            logger.exception("Graph execution failed for project %s", req.project_id)
            err_str = str(e)
            if "503" in err_str or "high demand" in err_str.lower() or "unavailable" in err_str.lower():
                friendly_msg = "The AI service is temporarily experiencing high demand from Google. Please try again in a few moments."
            elif "429" in err_str or "quota" in err_str.lower() or "resource_exhausted" in err_str.lower():
                friendly_msg = "Rate limit reached. Please wait a few moments and try again."
            else:
                friendly_msg = "Workflow execution failed. Please check logs or retry."
            await emitter.push("error", content=friendly_msg)
        finally:
            _active_tasks.pop(req.project_id, None)
            await emitter.push("done")

    # Avoid launching duplicate concurrent graph tasks for the same project
    existing_task = _active_tasks.get(req.project_id)
    if existing_task is None or existing_task.done():
        _active_tasks[req.project_id] = asyncio.create_task(run_graph())

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
                yield json.dumps({"type": "ping"}) + "\n"
            except asyncio.CancelledError:
                break
            except Exception:
                logger.exception("Stream error for project %s", req.project_id)
                yield json.dumps({"type": "error", "content": "Workflow stream failed"}) + "\n"
                break

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")

@router.post("/respond")
@router.post("/approve")
async def respond_approval(req: RespondApprovalRequest):
    async with _get_project_lock(req.project_id):
        cached = load_persisted_state(req.project_id)
        if not cached:
            raise HTTPException(status_code=404, detail="Workflow not found for this project")

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
                    for s in cached.get("video_shots", []):
                        s["approved"] = True
                    approval_states["video_approved"] = True
                else:
                    approval_states["video_approved"] = False
                    cached["current_stage"] = "video"
            elif not approval_states.get("assembly_confirmed"):
                approval_states["assembly_confirmed"] = True
            elif cached.get("current_stage") in ("editor_failed", "editor_qc_failed"):
                if are_video_shots_valid(cached):
                    approval_states["video_approved"] = True
                    approval_states["assembly_confirmed"] = True
                else:
                    approval_states["video_approved"] = False
                    cached["current_stage"] = "video"
        save_persisted_state(req.project_id, cached)

    respond_to_approval(req.project_id, req.approved, req.reason)

    # If the graph paused at END (e.g. after server restart or previous stop), resume it cleanly
    existing_task = _active_tasks.get(req.project_id)
    if req.approved and (existing_task is None or existing_task.done()):
        emitter = WorkflowEventEmitter(req.project_id)
        config = {"configurable": {"thread_id": req.project_id, "emitter": emitter}}

        async def _resume_sync(s):
            save_persisted_state(req.project_id, s)

        config["configurable"]["update_state"] = _resume_sync

        async def _resume_graph():
            try:
                final_state = await graph_app.ainvoke(cached, config)
                save_persisted_state(req.project_id, final_state)
            except Exception:
                logger.exception("Resumed graph failed for project %s", req.project_id)
                await emitter.push("error", content="Failed to resume workflow")
            finally:
                _active_tasks.pop(req.project_id, None)
                await emitter.push("done")

        _active_tasks[req.project_id] = asyncio.create_task(_resume_graph())

    return {"status": "ok"}

@router.post("/regenerate-character")
async def regenerate_character(req: RegenerateCharacterRequest):
    state = load_persisted_state(req.project_id)
    if not state:
        raise HTTPException(status_code=404, detail="Workflow not found for this project")
    
    characters = state.get("characters", [])
    target_char = next((c for c in characters if c.get("id") == req.character_id or c.get("character_id") == req.character_id), None)
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
            logger.warning("LLM prompt refinement skipped: %s", e)
            target_char["image_prompt"] = f"{target_char.get('image_prompt', target_char['name'])}, {req.feedback}"

    import random
    import base64
    import httpx
    new_seed = random.randint(100000, 999999)
    new_url = await image_adapter.generate_image(target_char.get("image_prompt", target_char["name"]), seed=new_seed)

    new_version = int(state.get("character_version", 0)) + 1
    renders_dir = _get_renders_dir(req.project_id)
    char_file = os.path.join(renders_dir, f"{req.character_id}.jpg")
    if new_url and new_url.startswith("data:image") and "base64," in new_url:
        raw_b = base64.b64decode(new_url.split("base64,", 1)[1])
        if len(raw_b) > 1000:
            with open(char_file, "wb") as f_out:
                f_out.write(raw_b)
            new_url = media_storage.upload_file(
                char_file,
                project_id=req.project_id,
                object_key=f"projects/{req.project_id}/characters/{req.character_id}/v{new_version}/image.jpg",
                bucket="cineforge-assets",
                content_type="image/jpeg",
                asset_type="image",
                character_id=req.character_id,
                version=new_version,
            )
    elif new_url and new_url.startswith("http"):
        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.get(new_url)
            if r.status_code == 200 and len(r.content) > 1000:
                with open(char_file, "wb") as f_out:
                    f_out.write(r.content)
                new_url = media_storage.upload_file(
                    char_file,
                    project_id=req.project_id,
                    object_key=f"projects/{req.project_id}/characters/{req.character_id}/v{new_version}/image.jpg",
                    bucket="cineforge-assets",
                    content_type="image/jpeg",
                    asset_type="image",
                    character_id=req.character_id,
                    version=new_version,
                )

    target_char["image_url"] = new_url

    async with _get_project_lock(req.project_id):
        latest = load_persisted_state(req.project_id) or state
        latest_chars = latest.get("characters", [])
        for idx, c in enumerate(latest_chars):
            if c.get("id") == req.character_id or c.get("character_id") == req.character_id:
                latest_chars[idx] = target_char
                break
        latest["characters"] = latest_chars
        latest["character_version"] = int(latest.get("character_version", 0)) + 1
        history = latest.setdefault("character_history", [])
        history.append({
            "version": latest["character_version"],
            "data": copy.deepcopy({"characters": latest_chars}),
        })
        save_persisted_state(req.project_id, latest)

    return {"status": "ok", "character": target_char, "character_version": latest["character_version"]}

@router.post("/regenerate-voiceover")
async def regenerate_voiceover(req: RegenerateVoiceoverRequest):
    state = load_persisted_state(req.project_id)
    if not state:
        raise HTTPException(status_code=404, detail="Workflow not found for this project")
    
    voiceovers = state.get("voiceovers", [])
    target_vo = next((v for v in voiceovers if v.get("shot_id") == req.shot_id), None)
    if not target_vo:
        raise HTTPException(status_code=404, detail=f"Voiceover for shot {req.shot_id} not found")
    
    from core.providers import get_audio_provider
    from core.media_processor import probe
    tts = get_audio_provider()
    
    text = req.dialogue or target_vo.get("dialogue", "")
    voice_id = req.voice_id or target_vo.get("voice_id", "en-US-ChristopherNeural")
    
    new_audio_url = await tts.generate_speech(text=text, voice_id=voice_id)
    if new_audio_url and "base64," in new_audio_url:
        import base64
        renders_dir = _get_renders_dir(req.project_id)
        audio_disk_path = os.path.join(renders_dir, f"audio_{req.shot_id}.mp3")
        b64_part = new_audio_url.split("base64,", 1)[1]
        with open(audio_disk_path, "wb") as af:
            af.write(base64.b64decode(b64_part))
        try:
            a_info = probe(audio_disk_path)
            if a_info.duration > 0:
                target_vo["duration_seconds"] = round(a_info.duration, 2)
        except Exception:
            pass
        new_audio_url = media_storage.upload_file(
            audio_disk_path,
            project_id=req.project_id,
            object_key=f"projects/{req.project_id}/voiceovers/{req.shot_id}/v2/audio.mp3",
            bucket="cineforge-assets",
            content_type="audio/mpeg",
            asset_type="audio",
            version=2,
        )

    target_vo["audio_url"] = new_audio_url
    if req.dialogue:
        target_vo["dialogue"] = req.dialogue
    if req.voice_id:
        target_vo["voice_id"] = req.voice_id
        target_vo["voice_name"] = req.voice_id

    async with _get_project_lock(req.project_id):
        latest = load_persisted_state(req.project_id) or state
        for idx, v in enumerate(latest.get("voiceovers", [])):
            if v.get("shot_id") == req.shot_id:
                latest["voiceovers"][idx] = target_vo
                break
        save_persisted_state(req.project_id, latest)

    return {"status": "ok", "voiceover": target_vo}

@router.post("/approve-shot")
async def approve_shot(req: ApproveShotRequest):
    async with _get_project_lock(req.project_id):
        state = load_persisted_state(req.project_id)
        if not state:
            raise HTTPException(status_code=404, detail="Workflow not found for this project")

        video_shots = state.get("video_shots", [])
        target_shot = next((s for s in video_shots if s.get("shot_id") == req.shot_id), None)
        if not target_shot:
            raise HTTPException(status_code=404, detail=f"Shot {req.shot_id} not found")

        if req.approved and target_shot.get("status") != "completed":
            raise HTTPException(status_code=400, detail=f"Shot {req.shot_id} is not completed and cannot be approved")

        target_shot["approved"] = req.approved
        if not req.approved and req.feedback:
            target_shot["error_message"] = req.feedback

        all_approved = bool(video_shots) and all(
            s.get("approved") is True and s.get("status") == "completed"
            for s in video_shots
        )
        approval_states = state.setdefault("approval_states", {})
        approval_states["video_approved"] = all_approved
        save_persisted_state(req.project_id, state)

    return {
        "status": "ok",
        "shot": target_shot,
        "video_approved": all_approved,
    }

@router.post("/regenerate-shot")
async def regenerate_shot(req: RegenerateShotRequest):
    state = load_persisted_state(req.project_id)
    if not state:
        raise HTTPException(status_code=404, detail="Workflow not found for this project")
    
    video_shots = state.get("video_shots", [])
    target_shot = next((s for s in video_shots if s.get("shot_id") == req.shot_id), None)
    if not target_shot:
        raise HTTPException(status_code=404, detail=f"Shot {req.shot_id} not found")
    
    renders_dir = _get_renders_dir(req.project_id)

    from core.video_generator import generate_ai_video_clip, QuotaExceededError
    from core.media_processor import FFMPEG_BIN, probe

    shot_img = os.path.join(renders_dir, f"{req.shot_id}_scene.jpg")
    if not os.path.exists(shot_img):
        for f in os.listdir(renders_dir):
            if f.endswith((".jpg", ".png")) and "thumb" not in f:
                shot_img = os.path.join(renders_dir, f)
                break

    motion_prompt = f"{target_shot.get('speaker', '')}: {req.feedback or target_shot.get('prompt', '')}"
    raw_clip_out = os.path.join(renders_dir, f"{req.shot_id}_raw.mp4")
    final_clip_out = os.path.join(renders_dir, f"{req.shot_id}.mp4")
    shot_dur = float(target_shot.get("duration_sec") or target_shot.get("duration_seconds") or settings.PROVIDER_CLIP_SECONDS)
    next_version = int(target_shot.get("version") or 1) + 1
    ai_clip = None

    try:
        ai_clip = await asyncio.to_thread(
            lambda: generate_ai_video_clip(
                image_path=shot_img,
                prompt=motion_prompt,
                hf_token=settings.HUGGINGFACE_API_KEY,
                duration=settings.PROVIDER_CLIP_SECONDS,
                steps=4
            )
        )
        if not ai_clip or not os.path.exists(ai_clip):
            raise RuntimeError("Video generation produced no clip")
        clip_info = await asyncio.to_thread(probe, ai_clip)
        if not clip_info.has_video:
            raise RuntimeError("Output clip has no video stream")
        if clip_info.duration <= 0.5 or (clip_info.fps is not None and clip_info.fps <= 1.0):
            raise RuntimeError(f"Static clip detected: duration={clip_info.duration:.2f}s, fps={clip_info.fps}")
        if clip_info.duration < 3.0:
            raise RuntimeError(f"Clip too short: {clip_info.duration:.2f}s < 3.00s")

        import shutil
        import subprocess
        shutil.copyfile(ai_clip, raw_clip_out)
        if clip_info.duration > shot_dur + 0.1:
            trim_cmd = [FFMPEG_BIN, "-y", "-i", ai_clip, "-t", str(shot_dur), "-c", "copy", final_clip_out]
            res = await asyncio.to_thread(lambda: subprocess.run(trim_cmd, capture_output=True))
            if res.returncode != 0 or not os.path.exists(final_clip_out):
                reencode_cmd = [
                    FFMPEG_BIN, "-y", "-i", ai_clip, "-t", str(shot_dur),
                    "-c:v", "libx264", "-preset", "fast", "-crf", str(settings.VIDEO_CRF),
                    "-pix_fmt", "yuv420p", "-an", final_clip_out
                ]
                res = await asyncio.to_thread(lambda: subprocess.run(reencode_cmd, capture_output=True))
            if res.returncode != 0 or not os.path.exists(final_clip_out):
                raise RuntimeError(f"Failed to trim regenerated shot to {shot_dur:.2f}s")
            final_info = await asyncio.to_thread(probe, final_clip_out)
            real_dur = round(final_info.duration, 3) if final_info.duration > 0 else shot_dur
        else:
            shutil.copyfile(ai_clip, final_clip_out)
            real_dur = round(clip_info.duration, 3)

        thumb_path = os.path.join(renders_dir, f"thumb_{req.shot_id}.jpg")
        await asyncio.to_thread(
            lambda: subprocess.run([FFMPEG_BIN, "-y", "-ss", "00:00:01", "-i", final_clip_out, "-vframes", "1", thumb_path], capture_output=True)
        )

        target_shot["status"] = "completed"
        target_shot["approved"] = False
        target_shot["version"] = next_version
        target_shot["video_url"] = media_storage.upload_file(
            final_clip_out,
            project_id=req.project_id,
            object_key=f"projects/{req.project_id}/clips/{req.shot_id}/v{next_version}/video.mp4",
            bucket="cineforge-renders",
            content_type="video/mp4",
            asset_type="video",
            version=next_version,
        )
        if os.path.exists(thumb_path):
            target_shot["thumbnail_url"] = media_storage.upload_file(
                thumb_path,
                project_id=req.project_id,
                object_key=f"projects/{req.project_id}/clips/{req.shot_id}/v{next_version}/thumb.jpg",
                bucket="cineforge-renders",
                content_type="image/jpeg",
                asset_type="image",
                version=next_version,
            )
        target_shot["static_fallback"] = False
        target_shot["duration_sec"] = real_dur
        target_shot["duration_seconds"] = real_dur
        target_shot["error_message"] = None
    except QuotaExceededError as qe:
        target_shot["status"] = "failed_quota"
        target_shot["approved"] = False
        target_shot["error_message"] = str(qe)
    except Exception as e:
        target_shot["status"] = "failed"
        target_shot["approved"] = False
        target_shot["error_message"] = str(e)
    finally:
        if ai_clip and ai_clip.startswith("/tmp") and os.path.exists(ai_clip):
            try:
                os.unlink(ai_clip)
            except OSError:
                pass

    async with _get_project_lock(req.project_id):
        latest = load_persisted_state(req.project_id) or state
        for idx, s in enumerate(latest.get("video_shots", [])):
            if s.get("shot_id") == req.shot_id:
                latest["video_shots"][idx] = target_shot
                break
        latest.setdefault("approval_states", {})["video_approved"] = False
        save_persisted_state(req.project_id, latest)

    if target_shot.get("status") != "completed":
        raise HTTPException(status_code=502, detail=target_shot.get("error_message") or "Shot regeneration failed")

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
        "final_video_url": state.get("final_film_url") or state.get("final_video_url"),
        "total_film_duration": state.get("total_film_duration", 60.0),
        "approval_states": state.get("approval_states", {})
    }
