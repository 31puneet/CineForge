from abc import ABC, abstractmethod
from typing import Any
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
    def __init__(self, model_name: str = "gemini-1.5-flash"):
        self.llm = ChatGoogleGenerativeAI(
            model=model_name,
            google_api_key=settings.GEMINI_API_KEY,
            temperature=0.7
        )

    def generate_text(self, prompt: str, **kwargs) -> str:
        response = self.llm.invoke(prompt)
        return str(response.content)

    def get_structured_output(self, prompt: str, schema: Any, **kwargs) -> Any:
        # Langchain supports with_structured_output which handles the validation
        structured_llm = self.llm.with_structured_output(schema)
        return structured_llm.invoke(prompt)
