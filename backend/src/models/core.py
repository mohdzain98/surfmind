from pydantic import BaseModel, Field
from typing import Dict, Any, List


class Document:
    def __init__(self, page_content, metadata):
        self.page_content = page_content
        self.metadata = metadata

    def __repr__(self):
        return f"Document(page_content={self.page_content}, metadata={self.metadata})"


class Ans_history(BaseModel):
    date: str = Field(description="The date of the context")
    url: str = Field(description="the url of the context")


class Ans_bookmark(BaseModel):
    url: str = Field(description="the url of the context")


class HistoryItem(BaseModel):
    url: str
    content: str
    date: str | None = None


class DataRequest(BaseModel):
    user_id: str = Field(alias="userId")
    flag: str = Field(default="history")
    data: List[HistoryItem]


class SearchRequest(BaseModel):
    user_id: str = Field(alias="userId")
    query: str
    flag: str


class SearchResponse(BaseModel):
    success: bool
    result: str
    format: dict | None = None
    model: str | None = None
    docs: list
