from pydantic import BaseModel, Field
from typing import List, Optional, Union

class LLMShot(BaseModel):
    shot_id: str = Field(description="Unique identifier for this shot, e.g., 'shot_1'")
    visual_description: str = Field(description="Detailed visual description of what happens in the shot.")
    duration_seconds: float = Field(description="Duration of this shot in seconds (e.g. 8.0, 5.0, 4.0). Must not exceed the provider clip duration limit.")
    dialogue: str = Field(default="", description="The exact spoken dialogue for this shot. Must fit the shot duration at max ~2.5 words per second.")
    speaker: Optional[str] = Field(None, description="The name of the character speaking the dialogue. Leave null if there is no dialogue.")

class LLMScriptData(BaseModel):
    global_narrative: str = Field(description="A brief summary of the overall story and tone.")
    shots: List[LLMShot] = Field(description="An array of video shots that make up the film. The total sum of duration_seconds must exactly equal the requested target duration.")

class LLMCharacter(BaseModel):
    id: str = Field(description="Unique identifier for character, e.g., 'char_1'")
    name: str = Field(description="Character's name, e.g., 'Doraemon', 'Nobita', 'Sarah', 'Detective Vance'")
    role: str = Field(description="Role in the film, e.g., 'Robotic Cat Companion', 'Student', 'Protagonist', 'Teacher', 'Detective', 'Hero', 'Villain'")
    gender: str = Field(description="Gender classification of the character: 'male' or 'female'")
    description: str = Field(description="Rich physical and personality description: costume/clothing, facial features, age, demeanor, signature items or gadgets.")
    image_prompt: str = Field(description="Detailed visual prompt matching the film's genre: for anime/cartoon specify 'vibrant 2D anime illustration, clean line art, official character design'; for realistic specify 'photorealistic portrait, natural lighting, contemporary casual wear, 35mm photography'; for fantasy/sci-fi specify 'cinematic concept art portrait, detailed'.")

class LLMCharactersData(BaseModel):
    characters: List[LLMCharacter] = Field(description="All distinct characters identified from the script narrative, dialogue speakers, and shot descriptions.")
