"""Core request/response and data models for the API.
Defines Pydantic schemas used across controllers and services.
"""

from pydantic import BaseModel, Field
from typing import Dict, Any, List


class Document:
    """Lightweight document container used by retrieval services.
    Stores page content and metadata for downstream processing.
    """

    def __init__(self, page_content, metadata):
        """Create a document with content and metadata.
        Keeps data minimal for retrieval and post-processing steps.
        """
        self.page_content = page_content
        self.metadata = metadata

    def __repr__(self):
        """Return a readable debug representation of the document.
        Helps trace content and metadata during development.
        """
        return f"Document(page_content={self.page_content}, metadata={self.metadata})"


class Ans_history(BaseModel):
    """Structured output schema for history responses.
    Captures the date and URL extracted from content.
    """

    date: str = Field(description="The date of the context")
    url: str = Field(description="the url of the context")


class Ans_bookmark(BaseModel):
    """Structured output schema for bookmark responses.
    Captures the URL extracted from content.
    """

    url: str = Field(description="the url of the context")


class HistoryItem(BaseModel):
    """Schema for a single history record in client payloads.
    Contains URL, content, and optional date.
    """

    url: str
    content: str
    date: str | None = None


class DataRequest(BaseModel):
    """Request schema for saving user data to cache.
    Includes user identity, flag type, and history items.
    """

    user_id: str = Field(alias="userId")
    flag: str = Field(default="history")
    data: List[HistoryItem]


class SearchRequest(BaseModel):
    """Request schema for initiating a search query.
    Includes user identity, query text, and content flag.
    """

    user_id: str = Field(alias="userId")
    query: str
    flag: str


class SearchResponse(BaseModel):
    """Response schema for search results.
    Includes raw result text, structured output, and matched docs.
    """

    success: bool
    result: str
    format: dict | None = None
    model: str | None = None
    docs: list
