"""Core retrieval orchestration for SurfMind RAG flows.
Provides synchronous and streaming pipelines for search.
Includes a mock streamer to test UI progress handling.
"""

import time
from concurrent.futures import ThreadPoolExecutor
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

    def _build_parent_documents(
        self, history: List[dict[str, str]], flag: str
    ) -> List[Document]:
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
                        "source": item.get("url", ""),
                        "date": item.get("date", ""),
                        "title": item.get("title", ""),
                        "domain": item.get("domain", ""),
                        "folder": item.get("folder", ""),
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
        if not final_docs:
            logger.warning("No relevant data found after post processing")
            return self._empty_response("No relevant data found")
        res = SearchResponse(
            success=True,
            result=result,
            format=finalOutput,
            model=model,
            docs=final_docs,
        )
        return res

    def stream_rag(
        self, data: SearchRequest, history: List[dict[str, str]]
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

        validated_docs = self.post_processing.post_process(
            ques=ques, docs=retrieved_parents
        )
        yield self._stream_event(
            "post_processing",
            {"validated_docs": len(validated_docs)},
        )
        if len(validated_docs) == 0:
            res = self._empty_response(
                message="Nothing macthed in the bookmarks related to the query"
            )
            yield self._stream_event("final", res.dict())
            return

        top_doc: dict = validated_docs[0]
        context = top_doc.get("content", "")
        source = top_doc.get("metadata", {}).get("source", "")
        date = top_doc.get("metadata", {}).get("date", None)

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

        # final_docs = self.post_processing.post_process(
        #     ques=ques, url=source, docs=retrieved_parents
        # )
        # yield self._stream_event(
        #     "post_processing",
        #     {"validated_docs": len(final_docs)},
        # )

        # if not final_docs:
        #     logger.warning("No relevant data found after post processing")
        #     res = self._empty_response("No relevant data found")
        #     yield self._stream_event("final", res.model_dump())
        #     return

        res = SearchResponse(
            success=True,
            result=result,
            format=final_output,
            model=model,
            docs=validated_docs,
        )
        yield self._stream_event("final", res.model_dump())

    def stream_combined_rag(
        self, data: SearchRequest, history: List[dict], bookmarks: List[dict]
    ) -> Generator[Dict[str, Any], None, None]:
        """Stream combined history+bookmark search progress via SSE.
        Runs retrieval independently on each corpus so both sources are
        guaranteed representation (k results each), then interleaves them
        before post-processing.
        """
        ques = data.query
        history_docs = self._build_parent_documents(history=history, flag="history")
        bookmark_docs = self._build_parent_documents(history=bookmarks, flag="bookmark")

        if not history_docs and not bookmark_docs:
            res = self._empty_response("No data found for combined search")
            yield self._stream_event("final", res.dict())
            return

        # Retrieve independently so each corpus gets its own k=3 slots,
        # preventing history from crowding out bookmarks.
        def _safe_retrieve(docs):
            if not docs:
                return []
            try:
                return self.rag.retrieve_parents(query=ques, parent_docs=docs)
            except Exception as exc:
                logger.warning("Retrieval failed for corpus: %s", exc)
                return []

        with ThreadPoolExecutor(max_workers=2) as executor:
            hist_future = executor.submit(_safe_retrieve, history_docs)
            bm_future = executor.submit(_safe_retrieve, bookmark_docs)
            history_parents = hist_future.result()
            bookmark_parents = bm_future.result()

        total_retrieved = len(history_parents) + len(bookmark_parents)
        yield self._stream_event("retrieved_parents", {"count": total_retrieved})

        if not history_parents and not bookmark_parents:
            res = self._empty_response("No relevant data found")
            yield self._stream_event("final", res.dict())
            return

        # Post-process each source independently and sequentially.
        # Bookmark content is sparse (title only), so judging it alongside
        # richer history results causes the LLM to unfairly drop bookmarks.
        # Separate evaluation gives each source a fair relevance check.
        # Sequential (not parallel) to avoid simultaneous LLM calls hitting
        # rate limits — each corpus is ≤3 docs so the latency cost is small.
        def _safe_post_process(docs):
            if not docs:
                return []
            try:
                return self.post_processing.post_process(ques=ques, docs=docs)
            except Exception as exc:
                logger.warning("Post-processing failed for corpus: %s", exc)
                return []

        validated_history = _safe_post_process(history_parents)
        validated_bookmarks = _safe_post_process(bookmark_parents)

        # Merge: history results first, then bookmarks (Popup.js re-splits by metadata.type)
        validated_docs = validated_history + validated_bookmarks
        yield self._stream_event(
            "post_processing", {"validated_docs": len(validated_docs)}
        )

        if not validated_docs:
            res = self._empty_response("No relevant data found after filtering")
            yield self._stream_event("final", res.dict())
            return

        top_doc: dict = validated_docs[0]
        context = top_doc.get("content", "")
        source = top_doc.get("metadata", {}).get("source", "")
        date = top_doc.get("metadata", {}).get("date", None)

        result, model = self.llm_rag.safe_invoke_llm_response(
            context=context, date=date, url=source, flag="combined"
        )
        yield self._stream_event("llm_response", {"text": result, "model": model})

        pchain = self.llm_rag.structure(flag="combined")
        final_output = pchain.invoke({"content": result})
        yield self._stream_event("output_parser", {"format": final_output})

        res = SearchResponse(
            success=True,
            result=result,
            format=final_output,
            model=model,
            docs=validated_docs,
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
