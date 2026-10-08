from abc import ABC, abstractmethod
from typing import Any
import json
import re
from langchain_google_genai import ChatGoogleGenerativeAI
from core.config import settings

class BaseLLMProvider(ABC):
    """Abstract base class for LLM interactions to prevent hardcoding providers."""
    
    @abstractmethod
    def generate_text(self, prompt: str, **kwargs) -> str:
        pass
        
    @abstractmethod
    def get_structured_output(self, prompt: str, schema: Any, **kwargs) -> Any:
        pass


class GeminiAdapter(BaseLLMProvider):
    def __init__(self, model_name: str = "gemini-3.5-flash"):
        self.llm = ChatGoogleGenerativeAI(
            model=model_name,
            google_api_key=settings.GEMINI_API_KEY,
            temperature=0.7
        )

    def generate_text(self, prompt: str, **kwargs) -> str:
        response = self.llm.invoke(prompt)
        return str(response.content)
        
    async def astream_text(self, prompt: str, **kwargs):
        async for chunk in self.llm.astream(prompt):
            yield chunk.content

    def _extract_json(self, text: str) -> dict:
        match = re.search(r"```(?:json)?\s*(\{.*\}|\[.*\])\s*```", text, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        return json.loads(text.strip())

    def get_structured_output(self, prompt: str, schema: Any, **kwargs) -> Any:
        prompt_with_schema = f"{prompt}\n\nPlease output ONLY valid JSON that conforms to this schema:\n{json.dumps(schema.model_json_schema())}"
        response = self.llm.invoke(prompt_with_schema)
        content = self._extract_json(response.content)
        return schema(**content)
        
    async def aget_structured_output(self, prompt: str, schema: Any, **kwargs) -> Any:
        prompt_with_schema = f"{prompt}\n\nPlease output ONLY valid JSON that conforms to this schema:\n{json.dumps(schema.model_json_schema())}"
        response = await self.llm.ainvoke(prompt_with_schema)
        content = self._extract_json(response.content)
        return schema(**content)
