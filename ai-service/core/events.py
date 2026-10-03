import asyncio
import json
from typing import Any

_event_queues: dict[str, asyncio.Queue] = {}
_approval_events: dict[str, asyncio.Event] = {}
_approval_responses: dict[str, dict] = {}

class WorkflowEventEmitter:
    def __init__(self, project_id: str):
        self.project_id = project_id
        if project_id not in _event_queues:
            _event_queues[project_id] = asyncio.Queue()
        if project_id not in _approval_events:
            _approval_events[project_id] = asyncio.Event()

    async def push(self, event_type: str, **kwargs):
        payload = {"type": event_type, **kwargs}
        await _event_queues[self.project_id].put(json.dumps(payload) + "\n")

    async def wait_for_approval(self) -> dict:
        self.reset_approval()
        await _approval_events[self.project_id].wait()
        return _approval_responses.get(self.project_id, {"approved": False, "reason": ""})
        
    def reset_approval(self):
        _approval_events[self.project_id].clear()
        if self.project_id in _approval_responses:
            del _approval_responses[self.project_id]

def get_event_queue(project_id: str) -> asyncio.Queue | None:
    return _event_queues.get(project_id)
    
def respond_to_approval(project_id: str, approved: bool, reason: str = ""):
    _approval_responses[project_id] = {"approved": approved, "reason": reason}
    if project_id in _approval_events:
        _approval_events[project_id].set()
