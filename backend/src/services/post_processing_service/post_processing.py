import ast
from langchain_core.prompts import PromptTemplate
from src.services.llm_service.llm_provider import LLMProvider
from src.utility.utils import Utility
from src.utility.logger import AppLogger

logger = AppLogger.get_logger(__name__)


class PostProcessing:
    def __init__(self):
        self.llm_provider = LLMProvider()
        self.utility = Utility()

    def clean_docs(self, url, docs):
        cleaned_docs = []
        cleaned_docs.append(docs[0])  # Keep the main document
        for doc in docs:
            if doc.metadata["source"] != url:
                cleaned_docs.append(doc)
        return cleaned_docs

    def join_docs(self, docs):
        doc_strings = []
        document_list = []
        seen_sources = set()
        doc_number = 1  # For visible numbering in prompt

        index_map = {}  # Map visible number → document_list index

        for doc in docs:
            source = doc.metadata.get("source")

            if source in seen_sources:
                continue
            seen_sources.add(source)

            content = doc.page_content[:300].replace("\n", " ")

            # Store the mapping: visible_number => actual_index in document_list
            index_map[doc_number] = len(document_list)

            doc_strings.append(f'{doc_number}. "{content}"')
            document_list.append({"content": content, "metadata": doc.metadata})

            doc_number += 1

        joined_docs = "\n\n".join(doc_strings)
        return joined_docs, document_list, index_map

    def post_process(self, ques, url, docs):
        llms = self.llm_provider.all()
        llm_gemini = llms.get("gemini")
        llm_gpt = llms.get("gpt")
        cleaned_docs = self.clean_docs(url, docs)
        joined_docs, whole_doc, index_map = self.join_docs(cleaned_docs)
        prompts = self.utility.load_prompts()
        relevant_prompt = prompts["prompt"]["relevance"]
        relevance_prompt = PromptTemplate(
            input_variables=["query", "content_blocks"], template=relevant_prompt
        )
        try:
            ans = llm_gemini.invoke(
                relevance_prompt.invoke({"query": ques, "content_blocks": joined_docs})
            )
        except Exception as e:
            logger.warning(f"Gemini Failed in Post Processing, reason: {e}")
            ans = llm_gpt.invoke(
                relevance_prompt.invoke({"query": ques, "content_blocks": joined_docs})
            )
        try:
            irrelevant_indices = ast.literal_eval(ans.content.strip())
            if not isinstance(irrelevant_indices, list):
                irrelevant_indices = []
        except Exception as e:
            logger.error(f"Failed to parse LLM output: {ans.content}")
            irrelevant_indices = []
        filtered_docs = whole_doc  # Start with all documents
        if irrelevant_indices:
            irrelevant_indices = [
                index_map[i] for i in irrelevant_indices if i in index_map
            ]
            filtered_docs = [
                doc
                for idx, doc in enumerate(whole_doc)
                if idx not in irrelevant_indices
            ]
        return filtered_docs
