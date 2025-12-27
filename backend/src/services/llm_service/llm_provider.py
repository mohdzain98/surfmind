from typing import Dict

from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.rate_limiters import InMemoryRateLimiter
from langchain_core.language_models.chat_models import BaseChatModel
from src.utility.logger import AppLogger

logger = AppLogger.get_logger(__name__)


class LLMProvider:
    """
    Central registry for all LLM clients.
    """

    def __init__(self):
        rate_limiter = InMemoryRateLimiter(
            requests_per_second=1, check_every_n_seconds=0.1, max_bucket_size=5
        )
        self._models: Dict[str, BaseChatModel] = {
            "gpt": ChatOpenAI(
                model="gpt-4.1-nano",
                temperature=0.4,
                max_tokens=500,
                rate_limiter=rate_limiter,
            ),
            "gemini": ChatGoogleGenerativeAI(
                model="gemini-2.0-flash", temperature=0.3, rate_limiter=rate_limiter
            ),
        }

    def get(self, name: str) -> BaseChatModel:
        """
        Get LLM by name.
        """
        if name not in self._models:
            logger.error(f"LLM not found")
            raise ValueError(
                f"LLM '{name}' not found. Available: {list(self._models.keys())}"
            )
        return self._models[name]

    def all(self) -> Dict[str, BaseChatModel]:
        """
        Return all registered LLMs.
        """
        return self._models
