from enum import Enum


class Models(str, Enum):
    """
    Enum representing supported LLM providers.
    Provides helper methods to retrieve the default and alternative model.
    """

    GPT = "gpt"
    GEMINI = "gemini"

    @classmethod
    def default(cls) -> "Models":
        """Return the default model provider."""
        return cls.GPT

    @classmethod
    def other(cls) -> "Models":
        """Return the alternative model provider."""
        return cls.GEMINI


class Embeddings(str, Enum):
    """
    Enum representing supported Embeddings providers.
    """

    GPT = "text-embedding-3-small"
    GEMINI = "models/gemini-embedding-001"

    @classmethod
    def default(cls) -> "Models":
        """Return the default model provider."""
        return cls.GPT

    @classmethod
    def other(cls) -> "Models":
        """Return the alternative model provider."""
        return cls.GEMINI
