from openai import RateLimitError, AuthenticationError
from src.handlers.mappers.base_mapper import BaseExceptionMapper


class OpenAIExceptionMapper(BaseExceptionMapper):

    def can_handle(self, exc: Exception) -> bool:
        return isinstance(
            exc,
            (
                RateLimitError,
                AuthenticationError,
            ),
        )

    def map(self, exc: Exception) -> dict:
        if isinstance(exc, RateLimitError):
            return {
                "message": "AI service is temporarily busy.",
                "code": "RATE_LIMIT",
            }

        if isinstance(exc, AuthenticationError):
            return {
                "message": "OpenAI authentication failed.",
                "code": "AUTH_ERROR",
            }

        return {
            "message": "OpenAI error occurred.",
            "code": "OPENAI_ERROR",
        }
