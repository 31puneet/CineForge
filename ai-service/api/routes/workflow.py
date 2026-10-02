from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional
from agents.graph import app as graph_app
from schemas.state import FilmGraphState

router = APIRouter(prefix="/workflow", tags=["workflow"])

class StartWorkflowRequest(BaseModel):
    project_id: str
    user_prompt: str

class ResumeWorkflowRequest(BaseModel):
    project_id: str
    action: str # "approve", "reject", "regenerate", "message"
    data: Optional[Dict[str, Any]] = None

# In memory state store for dummy implementation
# In production, LangGraph's checkpointer (e.g. Postgres or Mongo) will be used.
_memory_store: Dict[str, FilmGraphState] = {}

@router.post("/start")
async def start_workflow(req: StartWorkflowRequest):
    # Initialize the state
    initial_state: FilmGraphState = {
        "project_id": req.project_id,
        "messages": [req.user_prompt],
        "current_stage": "script",
        "script_data": None,
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
    
    # Run the graph
    print(f"Starting workflow for project {req.project_id}")
    config = {"configurable": {"thread_id": req.project_id}}
    
    # Since we don't have a DB checkpointer yet, we just run invoke.
    # In a real app we'd use stream() and a persistent checkpointer.
    final_state = graph_app.invoke(initial_state, config)
    
    _memory_store[req.project_id] = final_state
    
    return {"status": "paused", "state": final_state}

@router.post("/resume")
async def resume_workflow(req: ResumeWorkflowRequest):
    if req.project_id not in _memory_store:
        raise HTTPException(status_code=404, detail="Project workflow state not found")
        
    state = _memory_store[req.project_id]
    
    print(f"Resuming workflow for project {req.project_id} with action {req.action}")
    
    # Handle dummy approval actions
    if req.action == "approve":
        stage = state.get("current_stage")
        approvals = state.get("approval_states", {})
        
        if stage == "script":
            approvals["script_approved"] = True
        elif stage == "character":
            approvals["characters_approved"] = True
        elif stage == "voiceover":
            approvals["voiceovers_approved"] = True
        elif stage == "video":
            approvals["video_approved"] = True
            
        state["approval_states"] = approvals
        
        # Resume the graph
        config = {"configurable": {"thread_id": req.project_id}}
        final_state = graph_app.invoke(state, config)
        _memory_store[req.project_id] = final_state
        return {"status": "paused", "state": final_state}
        
    return {"status": "ignored", "state": state}
