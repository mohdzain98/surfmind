"""
Core API routes that mirror the legacy Flask endpoints.
"""

import os
import json
import redis
from typing import Any, Dict
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.responses import StreamingResponse

from src.models.core import DataRequest, SearchRequest, SearchResponse
from src.services.core_service.main import Retrieval, CoreRetrieval
from src.utility.logger import AppLogger

logger = AppLogger.get_logger(__name__)

load_dotenv()

redis_host = os.getenv("REDIS_HOST")
redis_port = os.getenv("REDIS_PORT")

redis_client = redis.Redis(
    host=redis_host,
    port=int(redis_port) if redis_port else None,
    db=0,
    decode_responses=True,
)

router = APIRouter(prefix="/api", tags=["Core"])


@router.post("/save-data", response_model=Dict[str, Any])
def save_data(payload: DataRequest):
    """Persist user history/bookmark data to Redis with a short TTL.
    Uses the payload user_id and flag to build a stable Redis key.
    """
    try:
        redis_key = f"user:{payload.user_id}:{payload.flag}"
        redis_client.set(redis_key, payload.json(), ex=3600)

        return {"success": True, "message": "Data saved successfully"}

    except Exception as exc:
        logger.error(f"Error saving data: {exc}", "red")
        raise HTTPException(status_code=500, detail="Failed to save user data")


@router.post("/search")
def search(
    payload: SearchRequest,
    service: CoreRetrieval = Depends(Retrieval.get_retrieval_service),
) -> SearchResponse:
    """Run a non-streaming RAG search against the cached user data.
    Loads the stored history for the given user/flag key from Redis.
    """
    redis_key = f"user:{payload.user_id}:{payload.flag}"
    user_data = redis_client.get(redis_key)
    history: dict = json.loads(user_data)
    try:
        history_data = history.get("data", [])
        return service.invoke_rag(data=payload, history=history_data)
    except Exception as exc:
        logger.error(exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc


@router.post("/search-stream")
def search_stream(
    payload: SearchRequest,
    service: CoreRetrieval = Depends(Retrieval.get_retrieval_service),
):
    """Stream RAG search progress and results via Server-Sent Events.
    Reads user data from Redis and yields stepwise progress payloads.
    Emits a final event with the full response or an error event.
    """
    redis_key = f"user:{payload.user_id}:{payload.flag}"
    user_data = redis_client.get(redis_key)
    history: dict = json.loads(user_data) if user_data else {}

    def event_stream():
        try:
            history_data = history.get("data", [])
            for event in service.stream_rag(data=payload, history=history_data):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as exc:
            logger.error(exc)
            error_event = {"step": "error", "data": {"message": str(exc)}}
            yield f"data: {json.dumps(error_event)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
