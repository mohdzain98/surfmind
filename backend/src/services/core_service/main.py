"""Core retrieval orchestration for SurfMind RAG flows.
Provides synchronous and streaming pipelines for search.
Includes a mock streamer to test UI progress handling.
"""

import time
from typing import List, Dict, Any, Generator
from src.services.llm_service.llm_provider import LLMProvider
from src.models.core import Document, SearchRequest, SearchResponse
from src.services.post_processing_service.post_processing import PostProcessing
from src.services.core_service.rag import HybridRAGService, LLMRag
from src.utility.logger import AppLogger

logger = AppLogger.get_logger(__name__)


class CoreRetrieval:
    """Coordinate retrieval, LLM calls, parsing, and post-processing.
    Builds documents from user data and delegates retrieval to RAG services.
    """

    def __init__(self):
        """Initialize shared service dependencies for the RAG pipeline.
        Wires up LLM provider, post-processing, and retriever components.
        """
        self.llm_client = LLMProvider()
        self.post_processing = PostProcessing()
        self.rag = HybridRAGService()
        self.llm_rag = LLMRag()

    def _build_parent_documents(self, history: List[dict], flag: str) -> List[Document]:
        """Convert raw history items into parent Document objects.
        Maps fields to metadata used by retrieval and post-processing.
        Returns a list of parent-level documents for chunking.
        """
        docs: List[Document] = []
        for item in history:
            docs.append(
                Document(
                    page_content=item.get("content", ""),
                    metadata={
                        "source": item.get("url"),
                        "date": item.get("date", "Unknown"),
                        "title": item.get("title", ""),
                        "type": flag,
                    },
                )
            )

        return docs

    def _empty_response(self, message: str) -> SearchResponse:
        """Create a standardized empty SearchResponse with a message.
        Used when no history or no relevant data is found.
        """
        return SearchResponse(
            success=False,
            result=message,
            format=None,
            model=None,
            docs=[],
        )

    def _stream_event(self, step: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Wrap streaming payloads in a consistent step envelope.
        Keeps the SSE payload format stable for UI consumption.
        Returns a JSON-serializable dictionary.
        """
        return {"step": step, "data": data}

    def invoke_rag(self, data: SearchRequest, history: List[dict]) -> SearchResponse:
        """Run the full RAG pipeline and return a final response.
        Returns a SearchResponse ready for API consumption.
        """
        ques = data.query
        flag = data.flag
        parent_docs = self._build_parent_documents(history=history, flag=flag)
        if not parent_docs:
            logger.warning("No history data found")
            return self._empty_response("No history data found")

        # List of combined docs from bm25 and faiss
        retrieved_parents = self.rag.retrieve_parents(
            query=ques,
            parent_docs=parent_docs,
        )
        if not retrieved_parents:
            logger.warning("No relevant data found")
            return self._empty_response("No relevant data found")

        top_doc = retrieved_parents[0]
        context = top_doc.page_content
        source = top_doc.metadata.get("source")
        date = top_doc.metadata.get("date")

        result, model = self.llm_rag.safe_invoke_llm_response(
            context=context, date=date, url=source, flag=flag
        )
        pchain = self.llm_rag.structure(flag=flag)
        finalOutput = pchain.invoke({"content": result})
        final_docs = self.post_processing.post_process(
            ques=ques, url=source, docs=retrieved_parents
        )
        res = SearchResponse(
            success=True,
            result=result,
            format=finalOutput,
            model=model,
            docs=final_docs,
        )
        return res

    def stream_rag(
        self, data: SearchRequest, history: List[dict]
    ) -> Generator[Dict[str, Any], None, None]:
        """Stream progress events for each major RAG pipeline step.
        Enables SSE clients to show intermediate status updates.
        """
        ques = data.query
        flag = data.flag
        parent_docs = self._build_parent_documents(history=history, flag=flag)
        if not parent_docs:
            res = self._empty_response("No history data found")
            yield self._stream_event("final", res.dict())
            return

        retrieved_parents = self.rag.retrieve_parents(
            query=ques,
            parent_docs=parent_docs,
        )
        yield self._stream_event(
            "retrieved_parents",
            {"count": len(retrieved_parents)},
        )
        if not retrieved_parents:
            res = self._empty_response("No relevant data found")
            yield self._stream_event("final", res.dict())
            return

        top_doc = retrieved_parents[0]
        context = top_doc.page_content
        source = top_doc.metadata.get("source")
        date = top_doc.metadata.get("date")

        result, model = self.llm_rag.safe_invoke_llm_response(
            context=context, date=date, url=source, flag=flag
        )
        yield self._stream_event(
            "llm_response",
            {"text": result, "model": model},
        )

        pchain = self.llm_rag.structure(flag=flag)
        final_output = pchain.invoke({"content": result})
        yield self._stream_event(
            "output_parser",
            {"format": final_output},
        )

        final_docs = self.post_processing.post_process(
            ques=ques, url=source, docs=retrieved_parents
        )
        yield self._stream_event(
            "post_processing",
            {"validated_docs": len(final_docs)},
        )

        res = SearchResponse(
            success=True,
            result=result,
            format=final_output,
            model=model,
            docs=final_docs,
        )
        yield self._stream_event("final", res.model_dump())

    def mock_stream_rag(
        self,
        data,
        history,
    ) -> Generator[Dict[str, Any], None, None]:
        """Mock streaming RAG for UI testing without LLM dependencies.
        Keeps latency between steps to mimic real execution timing.
        """

        ques = data.query
        flag = data.flag

        # ----------------------------
        # Step 1: Pretend we built docs
        # ----------------------------
        time.sleep(2)
        yield self._stream_event(
            "retrieved_parents",
            {"count": 3},
        )

        # ----------------------------
        # Step 2: Stream fake LLM answer
        # ----------------------------
        time.sleep(2)
        fake_answer = (
            "The Lyapunov exponent measures how sensitive a dynamical system "
            "is to initial conditions. A positive exponent indicates chaos."
        )

        yield self._stream_event(
            "llm_response",
            {
                "text": fake_answer,
                "model": "mock-llm",
            },
        )

        # ----------------------------
        # Step 3: Fake structured output
        # ----------------------------
        time.sleep(2)

        if flag == "history":
            fake_format = {
                "date": "2025-07-01",
                "url": "https://math.libretexts.org/Lyapunov_Exponent",
            }
        else:
            fake_format = {
                "url": "https://math.libretexts.org/Lyapunov_Exponent",
            }

        yield self._stream_event(
            "output_parser",
            {"format": fake_format},
        )

        # ----------------------------
        # Step 4: Fake post processing
        # ----------------------------
        time.sleep(2)

        fake_docs = [
            {
                "content": "9.3: Lyapunov Exponent - Mathematics LibreTexts",
                "metadata": {
                    "source": "https://math.libretexts.org/Bookshelves/Scientific_Computing_Simulations_and_Modeling/Introduction_to_the_Modeling_and_Analysis_of_Complex_Systems_(Sayama)/09%3A_Chaos/9.03%3A_Lyapunov_Exponent",
                    "date": None,
                    "title": "",
                    "type": flag,
                },
            },
        ]

        yield self._stream_event(
            "post_processing",
            {"validated_docs": len(fake_docs)},
        )
        time.sleep(2)
        # ----------------------------
        # Step 5: Final response
        # ----------------------------
        res = SearchResponse(
            success=True,
            result=fake_answer,
            format=fake_format,
            model="mock-llm",
            docs=fake_docs,
        )

        yield self._stream_event(
            "final",
            res.model_dump(),
        )


class Retrieval:
    """Factory for providing a CoreRetrieval instance to FastAPI."""

    @staticmethod
    def get_retrieval_service() -> CoreRetrieval:
        """Create a new CoreRetrieval instance for request handling.
        Keeps dependency injection explicit and testable.
        Separates construction from API controller code.
        """
        return CoreRetrieval()
