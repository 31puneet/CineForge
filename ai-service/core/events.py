import asyncio
import json

_STAGE_ALIASES = {
    "script": "script",
    "character": "characters",
    "characters": "characters",
    "voiceover": "voiceover",
    "voiceovers": "voiceover",
    "video": "video",
    "videos": "video",
    "assembly": "assembly",
    "editor": "assembly",
    "editor_ready": "assembly",
}


def normalize_stage(stage: str) -> str:
    cleaned = (stage or "").strip().lower()
    return _STAGE_ALIASES.get(cleaned, cleaned or "default")


_event_queues: dict[str, asyncio.Queue] = {}
_approval_events: dict[tuple[str, str], asyncio.Event] = {}
_approval_responses: dict[tuple[str, str], dict] = {}


class WorkflowEventEmitter:
    def __init__(self, project_id: str):
        self.project_id = project_id
        if project_id not in _event_queues:
            _event_queues[project_id] = asyncio.Queue()

    def _get_approval_event(self, stage: str) -> asyncio.Event:
        key = (self.project_id, normalize_stage(stage))
        if key not in _approval_events:
            _approval_events[key] = asyncio.Event()
        return _approval_events[key]

    async def push(self, event_type: str, **kwargs):
        payload = {"type": event_type, **kwargs}
        await _event_queues[self.project_id].put(json.dumps(payload) + "\n")

    async def wait_for_approval(self, stage: str = "default") -> dict:
        key = (self.project_id, normalize_stage(stage))
        self.reset_approval(stage)
        evt = self._get_approval_event(stage)
        await evt.wait()
        return _approval_responses.get(key, {"approved": False, "reason": ""})

    def reset_approval(self, stage: str = "default"):
        key = (self.project_id, normalize_stage(stage))
        if key in _approval_events:
            _approval_events[key].clear()
        if key in _approval_responses:
            del _approval_responses[key]


def get_event_queue(project_id: str) -> asyncio.Queue | None:
    return _event_queues.get(project_id)


def respond_to_approval(project_id: str, approved: bool, reason: str = "", stage: str = "default"):
    key = (project_id, normalize_stage(stage))
    _approval_responses[key] = {"approved": approved, "reason": reason}
    if key in _approval_events:
        _approval_events[key].set()


async def wait_for_approval(project_id: str, stage: str = "default") -> dict:
    emitter = WorkflowEventEmitter(project_id)
    return await emitter.wait_for_approval(stage=stage)

