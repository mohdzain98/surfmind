"""Environment-backed providers for secrets and embeddings.
Wraps cached access to API keys and embedding clients.
"""

import os
from functools import lru_cache
from typing import Literal
from dotenv import load_dotenv
from langchain_openai import OpenAIEmbeddings
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from src.utility.path_finder import Finder
from src.utility.logger import AppLogger

paths = Finder()
env_path = paths.get_directory(name="root") / ".env"
load_dotenv(dotenv_path=env_path)
logger = AppLogger.get_logger(__name__)


class SecretsProvider:
    """
    Centralized secrets loader with caching.
    Reads secrets from environment variables exactly once.
    """

    @staticmethod
    @lru_cache(maxsize=1)
    def get_openai_api_key() -> str:
        """Return the OpenAI API key from the environment.
        Uses caching to avoid repeated lookups.
        """
        key = os.getenv("OPENAI_API_KEY")

        if not key:
            raise RuntimeError("OPENAI_API_KEY is not set in environment variables")

        return key

    @staticmethod
    @lru_cache(maxsize=1)
    def get_gemini_api_key() -> str:
        """Return the Gemini API key from the environment.
        Uses caching to avoid repeated lookups.
        """
        key = os.getenv("GEMINI_API_KEY")

        if not key:
            raise RuntimeError("GEMINI_API_KEY is not set in environment variables")

        return key


EmbeddingProvider = Literal["openai", "gemini"]

DEFAULT_OPENAI_MODEL = "text-embedding-3-small"
DEFAULT_GEMINI_MODEL = "models/embedding-001"


class EmbeddingsProvider:
    """
    Centralized, cached embeddings provider.
    """

    @staticmethod
    @lru_cache(maxsize=4)
    def get_embeddings(
        provider: EmbeddingProvider = "openai",
        model_name: str | None = None,
    ):
        """
        Returns a cached embeddings instance.
        """

        if provider == "openai":
            model = model_name or DEFAULT_OPENAI_MODEL
            logger.info("Loaded OpenAI embeddings: %s", model)
            return OpenAIEmbeddings(
                model=model,
                api_key=SecretsProvider.get_openai_api_key(),
            )

        if provider == "gemini":
            model = model_name or DEFAULT_GEMINI_MODEL
            logger.info("Loaded Gemini embeddings: %s", model)
            return GoogleGenerativeAIEmbeddings(
                model=model,
                google_api_key=SecretsProvider.get_gemini_api_key(),
            )
