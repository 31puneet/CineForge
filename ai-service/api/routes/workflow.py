from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional
import asyncio
import json
import traceback
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
    initial_state: FilmGraphState = {
        "project_id": req.project_id,
        "metadata": req.metadata or {},
        "messages": [HumanMessage(content=req.user_prompt)],
        "current_stage": "script",
        "script_data": None,
        "script_version": 0,
        "script_history": [],
        "characters": [],
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
    
    def update_state(s):
        _memory_store[req.project_id] = s
    config["configurable"]["update_state"] = update_state

    async def run_graph():
        try:
            final_state = await graph_app.ainvoke(initial_state, config)
            _memory_store[req.project_id] = final_state
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
        "approval_states": state.get("approval_states", {})
    }
