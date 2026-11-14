from typing import TypedDict, Annotated, List, Optional, Any, Dict
import operator

# State transition stages
STAGES = [
    "script", 
    "character", 
    "voiceover", 
    "video", 
    "editor", 
    "completed"
]

# We will use standard lists and dicts here for simplicity, 
# appending is handled by LangGraph's Annotated.

class Shot(TypedDict):
    id: str
    description: str
    duration_sec: float
    dialogue: str
    speaker: Optional[str]

class ScriptData(TypedDict):
    global_narrative: str
    shots: List[Shot]

class Character(TypedDict, total=False):
    id: str
    name: str
    role: Optional[str]
    gender: Optional[str]
    description: str
    image_url: Optional[str]
    image_prompt: Optional[str]

class Voiceover(TypedDict, total=False):
    shot_id: str
    speaker: Optional[str]
    gender: Optional[str]
    dialogue: Optional[str]
    audio_url: str
    voice_name: Optional[str]
    voice_id: Optional[str]
    duration_seconds: Optional[float]

class VideoShot(TypedDict, total=False):
    shot_id: str
    video_url: str
    thumbnail_url: Optional[str]
    prompt: Optional[str]
    speaker: Optional[str]
    dialogue: Optional[str]
    duration_seconds: Optional[float]
    duration_sec: Optional[float]
    status: Optional[str]  # queued | rendering | completed | failed | failed_quota | needs_attention
    padding_applied: Optional[str]  # loop | hold | None
    static_fallback: Optional[bool]
    error_message: Optional[str]

class ApprovalStates(TypedDict):
    script_approved: bool
    characters_approved: bool
    voiceovers_approved: bool
    video_approved: bool
    editor_approved: Optional[bool]

# The massive state object for LangGraph
class FilmGraphState(TypedDict):
    project_id: str
    metadata: Dict[str, Any]
    messages: Annotated[List[Any], operator.add]
    current_stage: str
    
    script_data: Optional[ScriptData]
    script_version: int
    script_history: List[Dict[str, Any]]
    
    characters: List[Character]
    character_version: int
    character_history: List[Dict[str, Any]]
    voiceovers: List[Voiceover]
    video_shots: List[VideoShot]
    
    final_film_url: Optional[str]
    manifest: Optional[Dict[str, Any]]
    
    approval_states: ApprovalStates
