from pydantic import BaseModel, Field
from typing import List, Optional

class LLMShot(BaseModel):
    shot_id: str = Field(description="Unique identifier for this shot, e.g., 'shot_1'")
    visual_description: str = Field(description="Detailed visual description of what happens in the shot.")
    duration_seconds: int = Field(description="Duration of this shot in seconds. Must be an integer.")
    dialogue: str = Field(description="The exact spoken dialogue for this shot. Leave empty if there is no dialogue.")
    speaker: Optional[str] = Field(None, description="The name of the character speaking the dialogue. Leave null if there is no dialogue.")

class LLMScriptData(BaseModel):
    global_narrative: str = Field(description="A brief summary of the overall story and tone.")
    shots: List[LLMShot] = Field(description="An array of video shots that make up the film. The total sum of duration_seconds must exactly equal the requested target duration.")
