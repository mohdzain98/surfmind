from src.handlers.mappers import OpenAIExceptionMapper, GeminiExceptionMapper


class LLMExceptionHandler:

    def __init__(self):
        self._mappers = [
            OpenAIExceptionMapper(),
            GeminiExceptionMapper(),
        ]

    def map_exception(self, exc: Exception) -> dict:
        real_exc = exc.__cause__ or exc

        for mapper in self._mappers:
            if mapper.can_handle(real_exc):
                return mapper.map(real_exc)

        return {
            "message": "Unexpected AI error occurred.",
            "code": "UNKNOWN_ERROR",
        }


# singleton instance
llm_exc_handler = LLMExceptionHandler()
