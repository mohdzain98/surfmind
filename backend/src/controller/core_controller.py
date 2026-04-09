"""
Core API routes.
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
from src.handlers.llm_exception_handler import llm_exc_handler
from src.handlers.redis_exception_handler import redis_exc_handler
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

router = APIRouter(prefix="/v1", tags=["Core"])


@router.post("/save-data", response_model=Dict[str, Any])
def save_data(payload: DataRequest):
    """Persist user history/bookmark data to Redis with a short TTL.
    For flag='combined', stores history and bookmarks under separate sub-keys.
    Uses the payload user_id and flag to build stable Redis keys.
    """
    try:
        redis_client.ping()

        if payload.flag == "combined":
            history_payload = {"data": [item.dict() for item in payload.data]}
            bookmark_payload = {"data": [item.dict() for item in payload.bookmarks]}
            redis_client.set(f"user:{payload.user_id}:ch", json.dumps(history_payload), ex=3600)
            redis_client.set(f"user:{payload.user_id}:cb", json.dumps(bookmark_payload), ex=3600)
        else:
            redis_key = f"user:{payload.user_id}:{payload.flag}"
            redis_client.set(redis_key, payload.json(), ex=3600)

        return {"success": True, "message": "Data saved successfully"}

    except redis.ConnectionError as e:
        logger.error(f"Failed to connect to Redis: {e}")
        raise HTTPException(
            status_code=500,
            detail={"success": False, "message": redis_exc_handler.map_exception(e)},
        ) from e

    except Exception as exc:
        logger.error(f"Error saving data: {exc}", "red")
        raise HTTPException(
            status_code=500,
            detail={"success": False, "message": redis_exc_handler.map_exception(exc)},
        )


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
            detail={
                "success": False,
                "message": llm_exc_handler.map_exception(exc),
            },
        ) from exc


@router.post("/search-stream")
def search_stream(
    payload: SearchRequest,
    service: CoreRetrieval = Depends(Retrieval.get_retrieval_service),
):
    """Stream RAG search progress and results via Server-Sent Events.
    For flag='combined', loads history and bookmarks from separate Redis sub-keys.
    Reads user data from Redis and yields stepwise progress payloads.
    Emits a final event with the full response or an error event.
    """
    if payload.flag == "combined":
        history_raw = redis_client.get(f"user:{payload.user_id}:ch")
        bookmark_raw = redis_client.get(f"user:{payload.user_id}:cb")
        history_data = json.loads(history_raw).get("data", []) if history_raw else []
        bookmark_data = json.loads(bookmark_raw).get("data", []) if bookmark_raw else []
    else:
        redis_key = f"user:{payload.user_id}:{payload.flag}"
        user_data = redis_client.get(redis_key)
        history_data = json.loads(user_data).get("data", []) if user_data else []
        bookmark_data = []

    def event_stream():
        try:
            if payload.flag == "combined":
                gen = service.stream_combined_rag(
                    data=payload, history=history_data, bookmarks=bookmark_data
                )
            else:
                gen = service.stream_rag(data=payload, history=history_data)
            for event in gen:
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as exc:
            logger.error(exc)
            error_event = {
                "step": "error",
                "data": {"message": llm_exc_handler.map_exception(exc=exc)},
            }
            yield f"data: {json.dumps(error_event)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
