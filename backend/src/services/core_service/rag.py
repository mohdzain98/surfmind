"""
Hybrid RAG implementation for SurfMind (FREE version)

- Parent documents = full history pages
- Child documents = chunks for retrieval
- Hybrid retrieval = BM25 + FAISS
- Explicit parent mapping (no deprecated retrievers)
"""

import re
import difflib
from termcolor import cprint
from collections import defaultdict
from typing import List, Tuple, Optional, Any, Dict, Set

from langchain_core.documents import Document
from langchain_core.runnables import Runnable
from src.models.core import Ans_bookmark, Ans_history
from langchain_core.runnables import RunnablePassthrough
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.output_parsers import JsonOutputParser, StrOutputParser
from langchain_community.retrievers import BM25Retriever
from langchain_community.vectorstores import FAISS

from src.services.llm_service.llm_provider import LLMProvider
from src.services.llm_service.prompt_builder import Prompts
from src.utility.provider import EmbeddingsProvider as ef
from src.utility.logger import AppLogger

logger = AppLogger.get_logger(__name__)


class HybridRAGService:

    def __init__(
        self,
        chunk_size: int = 300,
        chunk_overlap: int = 50,
        bm25_k: int = 3,
        faiss_k: int = 3,
    ):
        self.llm_provider = LLMProvider()
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.bm25_k = bm25_k
        self.faiss_k = faiss_k
        try:
            self.embeddings = ef.get_embeddings("gemini")
        except Exception:
            logger.warning("Gemini embeddings unavailable, falling back to OpenAI")
            self.embeddings = ef.get_embeddings("openai")

        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
        )

    # -------------------------------------------------
    # Document preparation
    # -------------------------------------------------
    def _build_child_documents(
        self, parent_docs: List[Document]
    ) -> Tuple[List[Document], List[Document]]:
        """
        Split parent documents into child chunks.
        Each child keeps reference to its parent via parent_id.
        """
        child_docs: List[Document] = []
        for parent_id, doc in enumerate(parent_docs):
            chunks = self.splitter.split_text(doc.page_content)

            for chunk in chunks:
                child_docs.append(
                    Document(
                        page_content=chunk,
                        metadata={
                            **doc.metadata,
                            "parent_id": parent_id,
                        },
                    )
                )

        if not child_docs:
            logger.error("No child documents created")
            raise ValueError("No child documents created from input data")

        return child_docs, parent_docs

    def _build_vocabulary(self, child_docs) -> Set[str]:
        vocab = set()
        for doc in child_docs:
            tokens = re.findall(r"[a-z0-9]+", doc.page_content.lower())
            vocab.update(tokens)
        return vocab

    def simple_tokenizer(self, text: str) -> List[str]:
        """
        Lightweight tokenizer for BM25.
        - lowercase
        - removes punctuation
        - splits on whitespace
        """
        text = text.lower()
        text = re.sub(r"[^a-z0-9]+", " ", text)
        return text.split()

    def expand_query_typo_tolerant(
        self,
        query: str,
        vocabulary: set[str],
        cutoff: float = 0.8,
    ) -> str:
        """
        Expands query with closest vocabulary matches.
        """
        expanded_terms = []
        tokens = query.lower().split()

        for token in tokens:
            expanded_terms.append(token)

            matches = difflib.get_close_matches(
                token,
                vocabulary,
                n=1,
                cutoff=cutoff,
            )
            if matches and matches[0] != token:
                expanded_terms.append(matches[0])

        return " ".join(expanded_terms)

    def _bm25_is_weak(self, bm25_hits: list[Document], query: str) -> bool:
        query_tokens = set(query.lower().split())

        for doc in bm25_hits:
            text = doc.page_content.lower()
            if any(tok in text for tok in query_tokens):
                return False
        return True

    # -------------------------------------------------
    # Retriever builders
    # -------------------------------------------------
    def _build_bm25_retriever(self, child_docs: List[Document]) -> BM25Retriever:
        bm25 = BM25Retriever.from_documents(
            child_docs, preprocess_func=self.simple_tokenizer
        )
        bm25.k = self.bm25_k
        return bm25

    def _build_faiss_retriever(self, child_docs: List[Document]):
        vectorstore = FAISS.from_documents(child_docs, self.embeddings)
        return vectorstore.as_retriever(
            search_type="similarity_score_threshold",
            search_kwargs={"score_threshold": 0.5, "k": self.faiss_k},
        )

    # -------------------------------------------------
    # Hybrid retrieval
    # -------------------------------------------------
    def retrieve_parents(
        self,
        query: str,
        parent_docs: List[Document],
    ) -> List[Document]:
        """
        Main hybrid retrieval entrypoint.
        Returns parent-level documents.
        """
        # Step 1: build child docs
        child_docs, parents = self._build_child_documents(parent_docs)

        # Step 1.1: Build vocab once per request and expand query
        vocabulary = self._build_vocabulary(child_docs)
        expanded_query = self.expand_query_typo_tolerant(query, vocabulary)

        # Step 2: build retrievers
        bm25 = self._build_bm25_retriever(child_docs)
        faiss = self._build_faiss_retriever(child_docs)

        # Step 3: retrieve child docs
        bm25_hits = bm25.invoke(expanded_query)
        faiss_hits = faiss.invoke(query)

        cprint("\nbm25hits", "yellow")
        print(bm25_hits)
        cprint("\nfaisshits", "yellow")
        print(faiss_hits)

        # Step 4: merge + map back to parents
        return self._map_to_parents(
            query=query,
            bm25_hits=bm25_hits,
            faiss_hits=faiss_hits,
            parents=parents,
        )

    # -------------------------------------------------
    # Parent mapping
    # -------------------------------------------------
    def _map_to_parents(
        self,
        query: str,
        bm25_hits: List[Document],
        faiss_hits: List[Document],
        parents: List[Document],
    ) -> List[Document]:
        # """
        # Merge BM25 + FAISS results and return unique parent documents.
        # """
        # seen: Set[int] = set()
        # results: List[Document] = []

        # # Order matters: BM25 first (keywords), FAISS next (semantics)
        # for doc in bm25_hits + faiss_hits:
        #     parent_id = doc.metadata.get("parent_id")
        #     if parent_id is None:
        #         continue

        #     if parent_id not in seen:
        #         seen.add(parent_id)
        #         results.append(parents[parent_id])
        # return results
        """
        Map retrieved child docs back to parents with proper ranking.
        Only parents that appear in bm25_hits or faiss_hits are returned.
        """

        scores: Dict[int, float] = defaultdict(float)

        bm25_weak = self._bm25_is_weak(bm25_hits, query)

        # 1️⃣ FAISS hits (semantic signal – stronger when BM25 is weak)
        for rank, doc in enumerate(faiss_hits):
            pid = doc.metadata.get("parent_id")
            if pid is not None:
                scores[pid] += 3.0 / (rank + 1)

        # 2️⃣ BM25 hits (keyword signal)
        for rank, doc in enumerate(bm25_hits):
            pid = doc.metadata.get("parent_id")
            if pid is not None:
                scores[pid] += (1.0 if bm25_weak else 2.5) / (rank + 1)

        # 🚨 SAFETY CHECK
        if not scores:
            return []

        # 3️⃣ Sort parents by score DESC
        ranked_parent_ids = sorted(
            scores.keys(),
            key=lambda pid: scores[pid],
            reverse=True,
        )

        return [parents[pid] for pid in ranked_parent_ids]


class LLMRag:
    def __init__(self):
        self.rag = HybridRAGService()
        self.prompts = Prompts()
        self.llm_provider = LLMProvider()
        self.base_llm = self.llm_provider.get("gemini")

    def _llm_response(self, llm, flag: str = "history") -> Runnable:
        prompt_history = self.prompts.history_prompt()
        prompt_bookmark = self.prompts.bookmark_prompt()
        if flag == "history":
            chain = (
                {
                    "context": RunnablePassthrough(),
                    "url": RunnablePassthrough(),
                    "date": RunnablePassthrough(),
                }
                | prompt_history
                | llm
                | StrOutputParser()
            )
        elif flag == "bookmark":
            chain = (
                {"context": RunnablePassthrough(), "url": RunnablePassthrough()}
                | prompt_bookmark
                | llm
                | StrOutputParser()
            )
        else:
            logger.error(f"unknown flag")
            raise ValueError(f"Unknown flag '{flag}'")
        return chain

    def structure(self, flag: str = "history") -> Runnable:
        if flag == "history":
            parser = JsonOutputParser(pydantic_object=Ans_history)
        elif flag == "bookmark":
            parser = JsonOutputParser(pydantic_object=Ans_bookmark)
        else:
            raise ValueError(f"Unknown flag '{flag}'")
        promptParser = self.prompts.parser_prompt(parser, flag)
        model_with_retry = self.base_llm.with_retry(
            stop_after_attempt=6,
            wait_exponential_jitter=True,
        )
        pchain = promptParser | model_with_retry | parser
        return pchain

    def _invoke_chain(
        self, context: str, date: Optional[str], url: str, flag: str, chain: Runnable
    ) -> str:
        if flag == "history":
            return chain.invoke({"context": context, "date": date, "url": url})
        return chain.invoke({"context": context, "url": url})

    def safe_invoke_llm_response(
        self, context: str, date: Optional[str], url: str, flag: str = "history"
    ) -> Tuple[Any, str]:
        try:
            chain = self._llm_response(llm=self.base_llm, flag=flag)
            result = self._invoke_chain(
                context=context, date=date, url=url, flag=flag, chain=chain
            )
            return result, "gemini"
        except Exception as exc:
            logger.warning("Primary LLM failed, falling back to GPT: %s", exc)
            try:
                llm_gpt = self.llm_provider.get(name="gpt")
                chain = self._llm_response(llm=llm_gpt, flag=flag)
                result = self._invoke_chain(
                    context=context, date=date, url=url, flag=flag, chain=chain
                )
                return result, "gpt"
            except Exception as e:
                logger.error("Both LLM failed")
                raise RuntimeError("All LLM providers failed") from e
