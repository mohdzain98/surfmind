"""Core request/response and data models for the API.
Defines Pydantic schemas used across controllers and services.
"""

from pydantic import BaseModel, Field
from typing import List, Optional


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


class Ans_combined(BaseModel):
    """Structured output schema for combined history+bookmark responses.
    Captures the URL, optional date, and source type.
    """

    url: str = Field(description="the url of the context")
    date: Optional[str] = Field(default=None, description="the date of the context if available")
    source_type: str = Field(description="the source type: history or bookmark")


class HistoryItem(BaseModel):
    """Schema for a single history record in client payloads.
    Contains URL, content, and optional date.
    """

    url: str
    content: str
    date: str | int | None = None
    domain: str = None
    folder: str = None
    title: str = None


class DataRequest(BaseModel):
    """Request schema for saving user data to cache.
    Includes user identity, flag type, and history items.
    For flag="combined", bookmarks field carries the bookmark items.
    """

    user_id: str = Field(alias="userId")
    flag: str = Field(default="history")
    data: List[HistoryItem]
    bookmarks: List[HistoryItem] = []


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
