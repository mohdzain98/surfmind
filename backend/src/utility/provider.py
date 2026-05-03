"""Environment-backed providers for secrets and embeddings.
Wraps cached access to API keys and embedding clients.
"""

import os
from functools import lru_cache
from typing import Any

from dotenv import load_dotenv
from langchain_core.embeddings import Embeddings as LangChainEmbeddings
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_openai import OpenAIEmbeddings

from src.models.ai_models import Models
from src.utility.logger import AppLogger
from src.utility.path_finder import Finder

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


DEFAULT_OPENAI_MODEL = "text-embedding-3-small"
DEFAULT_GEMINI_MODEL = "models/gemini-embedding-001"


class FallbackEmbeddings(LangChainEmbeddings):
    """Embedding wrapper that falls back to a secondary provider on failure."""

    def __init__(self, primary: Any, fallback: Any):
        self.primary = primary
        self.fallback = fallback

    @staticmethod
    def _should_fallback(error: Exception) -> bool:
        """Fallback on quota/rate-limit/provider availability failures."""
        error_text = str(error).lower()
        fallback_markers = (
            "insufficient_quota",
            "quota",
            "rate limit",
            "rate_limit",
            "429",
            "resource_exhausted",
        )
        return any(marker in error_text for marker in fallback_markers)

    def _invoke_with_fallback(self, method_name: str, *args, **kwargs):
        primary_method = getattr(self.primary, method_name)
        fallback_method = getattr(self.fallback, method_name)

        try:
            return primary_method(*args, **kwargs)
        except Exception as exc:
            if not self._should_fallback(exc):
                raise
            logger.warning(
                "Primary embeddings failed in %s, switching to fallback. Reason: %s",
                method_name,
                exc,
            )
            return fallback_method(*args, **kwargs)

    async def _ainvoke_with_fallback(self, method_name: str, *args, **kwargs):
        primary_method = getattr(self.primary, method_name)
        fallback_method = getattr(self.fallback, method_name)

        try:
            return await primary_method(*args, **kwargs)
        except Exception as exc:
            if not self._should_fallback(exc):
                raise
            logger.warning(
                "Primary embeddings failed in %s, switching to fallback. Reason: %s",
                method_name,
                exc,
            )
            return await fallback_method(*args, **kwargs)

    def embed_documents(self, texts):
        return self._invoke_with_fallback("embed_documents", texts)

    def embed_query(self, text):
        return self._invoke_with_fallback("embed_query", text)

    async def aembed_documents(self, texts):
        return await self._ainvoke_with_fallback("aembed_documents", texts)

    async def aembed_query(self, text):
        return await self._ainvoke_with_fallback("aembed_query", text)

    def __call__(self, text):
        """Compatibility shim for vectorstores using callable embeddings."""
        return self.embed_query(text)


class EmbeddingsProvider:
    """
    Centralized, cached embeddings provider.
    """

    @staticmethod
    @lru_cache(maxsize=4)
    def get_embeddings(
        provider: Models = Models.default(),
        model_name: str | None = None,
    ):
        """
        Returns a cached embeddings instance.
        OpenAI embeddings automatically fall back to Gemini on quota failures.
        """

        if provider == Models.GPT:
            model = model_name or DEFAULT_OPENAI_MODEL
            logger.info("Loaded OpenAI embeddings with Gemini fallback: %s", model)
            primary = OpenAIEmbeddings(
                model=model,
                api_key=SecretsProvider.get_openai_api_key(),
            )
            fallback = GoogleGenerativeAIEmbeddings(
                model=DEFAULT_GEMINI_MODEL,
                google_api_key=SecretsProvider.get_gemini_api_key(),
            )
            return FallbackEmbeddings(primary=primary, fallback=fallback)

        if provider == Models.GEMINI:
            model = model_name or DEFAULT_GEMINI_MODEL
            logger.info("Loaded Gemini embeddings with OpenAI fallback: %s", model)
            primary = GoogleGenerativeAIEmbeddings(
                model=model,
                google_api_key=SecretsProvider.get_gemini_api_key(),
            )
            fallback = OpenAIEmbeddings(
                model=DEFAULT_OPENAI_MODEL,
                api_key=SecretsProvider.get_openai_api_key(),
            )
            return FallbackEmbeddings(primary=primary, fallback=fallback)

        raise ValueError(f"Unsupported embeddings provider: {provider}")
