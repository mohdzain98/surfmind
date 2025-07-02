import os
import yaml
from langchain.prompts.chat import (
    ChatPromptTemplate,
    SystemMessagePromptTemplate,
)
from langchain_core.prompts import PromptTemplate
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI


class Utility:

    @staticmethod
    def load_prompts(filepath="prompts.yml"):
        base_path = os.path.dirname(__file__)  # folder where utils.py is
        full_path = os.path.join(base_path, filepath)
        with open(full_path, "r") as f:
            return yaml.safe_load(f)

    @staticmethod
    def llm():
        llm_gpt = ChatOpenAI(model="gpt-4.1-nano", temperature=0.4, max_tokens=500)
        llm_gemini = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash",
            temperature=0.3,
        )
        return llm_gpt, llm_gemini

    def history_prompt():
        prompts = Utility.load_prompts()
        template_S = prompts["prompt"]["history"]["system"]
        system_message_prompt = SystemMessagePromptTemplate.from_template(template_S)

        template = prompts["prompt"]["history"]["user"]
        prompt = ChatPromptTemplate.from_messages([system_message_prompt, template])

        return prompt

    def bookmark_prompt():
        prompts = Utility.load_prompts()
        template_S = prompts["prompt"]["bookmark"]["system"]
        system_message_prompt = SystemMessagePromptTemplate.from_template(template_S)

        template = prompts["prompt"]["bookmark"]["user"]
        prompt = ChatPromptTemplate.from_messages([system_message_prompt, template])

        return prompt

    def parser_prompt(parser, flag):
        if flag == "history":
            promptParser = PromptTemplate(
                template="Extract date and url from the given content.\n{format_instructions}\n{content}\n.",
                input_variables=["content"],
                partial_variables={
                    "format_instructions": parser.get_format_instructions()
                },
            )
        else:
            promptParser = PromptTemplate(
                template="Extract url from the given content.\n{format_instructions}\n{content}\n.",
                input_variables=["content"],
                partial_variables={
                    "format_instructions": parser.get_format_instructions()
                },
            )
        return promptParser
