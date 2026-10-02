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

class Character(TypedDict):
    id: str
    name: str
    description: str
    image_url: Optional[str]

class Voiceover(TypedDict):
    shot_id: str
    audio_url: str

class VideoShot(TypedDict):
    shot_id: str
    video_url: str

class ApprovalStates(TypedDict):
    script_approved: bool
    characters_approved: bool
    voiceovers_approved: bool
    video_approved: bool

# The massive state object for LangGraph
class FilmGraphState(TypedDict):
    project_id: str
    messages: Annotated[List[Any], operator.add]
    current_stage: str
    
    script_data: Optional[ScriptData]
    characters: List[Character]
    voiceovers: List[Voiceover]
    video_shots: List[VideoShot]
    
    approval_states: ApprovalStates
