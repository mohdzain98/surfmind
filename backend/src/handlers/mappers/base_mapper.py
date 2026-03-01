class BaseExceptionMapper:
    def can_handle(self, exc: Exception) -> bool:
        raise NotImplementedError

    def map(self, exc: Exception) -> dict:
        raise NotImplementedError
