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

_memory_store: Dict[str, FilmGraphState] = {}

@router.post("/start")
async def start_workflow(req: StartWorkflowRequest):
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

    initial_state: FilmGraphState = {
        "project_id": req.project_id,
        "metadata": req.metadata or {},
        "messages": [HumanMessage(content=content_blocks)],
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
        _memory_store[req.project_id] = s
        
        # Serialize state for backend (converting Pydantic/LangChain objects to dicts if needed)
        # However, s is already a dict. We just need to make sure it's JSON serializable.
        import httpx
        from langchain_core.messages import BaseMessage
        
        # Convert messages
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
            
        backend_url = os.getenv("BACKEND_URL", "http://cineforge-backend:3000")
        internal_api_key = os.environ.get("INTERNAL_API_KEY")
        if not internal_api_key:
            print("INTERNAL_API_KEY is not set. Skipping state persistence.")
            return

        try:
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
            final_state = await graph_app.ainvoke(initial_state, config)
            await update_state(final_state)
        except Exception as e:
            # Send error event
            traceback.print_exc()
            print(f"Graph execution failed: {e}")
            await emitter.push("error", content=str(e))
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
async def respond_approval(req: RespondApprovalRequest):
    respond_to_approval(req.project_id, req.approved, req.reason)
    return {"status": "ok"}

@router.get("/state/{project_id}")
async def get_workflow_state(project_id: str):
    if project_id not in _memory_store:
        return {"current_stage": None, "script_data": None, "approval_states": {}}
    
    state = _memory_store[project_id]
    
    return {
        "current_stage": state.get("current_stage"),
        "script_data": state.get("script_data"),
        "script_version": state.get("script_version", 0),
        "script_history": state.get("script_history", []),
        "characters": state.get("characters", []),
        "character_version": state.get("character_version", 0),
        "character_history": state.get("character_history", []),
        "approval_states": state.get("approval_states", {})
    }
