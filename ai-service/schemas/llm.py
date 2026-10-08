from pydantic import BaseModel, Field
from typing import List, Optional

class LLMCharacter(BaseModel):
    character_id: str = Field(description="Unique character ID (e.g., 'char_1')")
    name: str = Field(description="Format: 'Name (CharacterID)'. Example: 'John Doe (char_1)'")
    visual_description: str = Field(description="Highly detailed physical description (face, clothing, build) used as a prompt for image generation.")

class LLMCharacterData(BaseModel):
    total_characters: int = Field(description="Total number of characters in the film.")
    characters: List[LLMCharacter] = Field(description="List of all characters appearing in the film.")


class LLMShot(BaseModel):
    shot_id: str = Field(description="Unique identifier for this shot, e.g., 'shot_1'")
    visual_description: str = Field(description="Detailed visual description of what happens in the shot.")
    duration_seconds: int = Field(description="Duration of this shot in seconds. MUST ALWAYS BE EXACTLY 10.")
    dialogue: str = Field(description="The exact spoken dialogue for this shot. Leave empty if there is no dialogue.")
    speaker: Optional[str] = Field(None, description="The ID of the character speaking the dialogue (e.g. 'char_1'). Leave null if there is no dialogue.")

class LLMScriptData(BaseModel):
    global_narrative: str = Field(description="A brief summary of the overall story and tone.")
    shots: List[LLMShot] = Field(description="An array of video shots that make up the film. Each shot MUST be exactly 10 seconds. The total number of shots must equal the requested target duration divided by 10.")
