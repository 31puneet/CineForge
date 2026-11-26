from pydantic import BaseModel, Field
from typing import List, Optional

class LLMCharacter(BaseModel):
    character_id: Optional[str] = Field(None, description="Unique character ID (e.g., 'char_1')")
    id: Optional[str] = Field(None, description="Unique identifier for character, e.g., 'char_1'")
    name: str = Field(description="Character's name, e.g., 'Doraemon', 'Nobita', 'Sarah', 'Detective Vance'")
    role: Optional[str] = Field(None, description="Role in the film, e.g., 'Robotic Cat Companion', 'Student', 'Protagonist'")
    gender: Optional[str] = Field(None, description="Gender classification of the character: 'male' or 'female'")
    description: Optional[str] = Field(None, description="Rich physical and personality description: costume/clothing, facial features, age, demeanor.")
    visual_description: Optional[str] = Field(None, description="Highly detailed physical description used as a prompt for image generation.")
    image_prompt: Optional[str] = Field(None, description="Detailed visual prompt matching the film's genre.")

class LLMCharacterData(BaseModel):
    total_characters: int = Field(default=0, description="Total number of characters in the film.")
    characters: List[LLMCharacter] = Field(description="List of all characters appearing in the film.")

LLMCharactersData = LLMCharacterData

class LLMShot(BaseModel):
    shot_id: str = Field(description="Unique identifier for this shot, e.g., 'shot_1'")
    visual_description: str = Field(description="Detailed visual description of what happens in the shot.")
    duration_seconds: float = Field(description="Duration of this shot in seconds (e.g. 8.0, 5.0, 4.0). Must not exceed the provider clip duration limit.")
    dialogue: str = Field(default="", description="The exact spoken dialogue for this shot. Must fit the shot duration at max ~2.5 words per second.")
    speaker: Optional[str] = Field(None, description="The name or ID of the character speaking the dialogue. Leave null if there is no dialogue.")

class LLMScriptData(BaseModel):
    global_narrative: str = Field(description="A brief summary of the overall story and tone.")
    shots: List[LLMShot] = Field(description="An array of video shots that make up the film. The total sum of duration_seconds must exactly equal the requested target duration.")
