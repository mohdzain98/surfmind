from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain.text_splitter import CharacterTextSplitter
from langchain.retrievers import ParentDocumentRetriever
from langchain.storage import InMemoryStore
from langchain_core.output_parsers import StrOutputParser, JsonOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain_openai import OpenAIEmbeddings
from langchain_core.pydantic_v1 import BaseModel, Field
import ast
from langchain_core.prompts import PromptTemplate
from utils import Utility

embedding_function = OpenAIEmbeddings()


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


class Core:
    def __init__(self, llm):
        self.llm = llm

    def makeDocs(self, docs):
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=400, chunk_overlap=100
        )
        docs = text_splitter.split_documents(docs)
        db = FAISS.from_documents(docs, embedding_function)
        parent_splitter = CharacterTextSplitter(
            separator="\n\n", chunk_size=1000, chunk_overlap=100
        )
        child_splitter = CharacterTextSplitter(
            separator="\n", chunk_size=400, chunk_overlap=50
        )

        store = InMemoryStore()
        par_doc_retriever = ParentDocumentRetriever(
            vectorstore=db,
            docstore=store,
            child_splitter=child_splitter,
            parent_splitter=parent_splitter,
        )
        par_doc_retriever.add_documents(docs)

        return par_doc_retriever, db

    def makeDocs_other(self, db, ques):
        retriever = retriever = db.as_retriever(
            search_type="similarity_score_threshold",
            search_kwargs={"score_threshold": 0.5, "k": 3},
        )
        docs_other = retriever.invoke(ques)
        return docs_other

    def LLMResponse(self, flag="history"):
        prompt_history = Utility.history_prompt()
        prompt_bookmark = Utility.bookmark_prompt()
        if flag == "history":
            chain = (
                {
                    "context": RunnablePassthrough(),
                    "url": RunnablePassthrough(),
                    "date": RunnablePassthrough(),
                }
                | prompt_history
                | self.llm
                | StrOutputParser()
            )
        else:
            chain = (
                {"context": RunnablePassthrough(), "url": RunnablePassthrough()}
                | prompt_bookmark
                | self.llm
                | StrOutputParser()
            )
        return chain

    def structure(self, flag="history"):
        if flag == "history":
            parser = JsonOutputParser(pydantic_object=Ans_history)
        else:
            parser = JsonOutputParser(pydantic_object=Ans_bookmark)
        promptParser = Utility.parser_prompt(parser, flag)
        pchain = promptParser | self.llm | parser
        return pchain

    def safe_invoke_llm_response(self, core, context, date, url, flag="history"):
        try:
            chain = core.LLMResponse()
            if flag == "history":
                result = chain.invoke({"context": context, "date": date, "url": url})
            else:
                result = chain.invoke({"context": context, "url": url})
            return result, "Gemini"
        except Exception as e:
            print("Gemini failed, falling back to GPT:", e)
            llm_gpt, _ = Utility.llm()
            core_fallback = Core(llm_gpt)
            chain = core_fallback.LLMResponse()
            if flag == "history":
                result = chain.invoke({"context": context, "date": date, "url": url})
            else:
                result = chain.invoke({"context": context, "url": url})
            return result, "GPT"


class PostProcessing:
    def __init__(self):
        pass

    def clean_docs(self, url, docs, docs_other):
        cleaned_docs = []
        cleaned_docs.append(docs[0])  # Keep the main document
        for doc in docs_other:
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

    def post_process(self, ques, url, docs, docs_other):
        llm_gpt, llm_gemini = Utility.llm()
        cleaned_docs = self.clean_docs(url, docs, docs_other)
        joined_docs, whole_doc, index_map = self.join_docs(cleaned_docs)
        prompts = Utility.load_prompts()
        relevant_prompt = prompts["prompt"]["relevance"]
        relevance_prompt = PromptTemplate(
            input_variables=["query", "content_blocks"], template=relevant_prompt
        )
        try:
            ans = llm_gemini.invoke(
                relevance_prompt.invoke({"query": ques, "content_blocks": joined_docs})
            )
        except Exception as e:
            ans = llm_gpt.invoke(
                relevance_prompt.invoke({"query": ques, "content_blocks": joined_docs})
            )
        try:
            irrelevant_indices = ast.literal_eval(ans.content.strip())
            if not isinstance(irrelevant_indices, list):
                irrelevant_indices = []
        except Exception as e:
            print(f"Failed to parse LLM output: {ans.content}")
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
