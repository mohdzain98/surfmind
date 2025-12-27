from langchain_core.prompts import (
    ChatPromptTemplate,
    SystemMessagePromptTemplate,
    PromptTemplate,
)
from src.utility.utils import Utility


class Prompts:
    def __init__(self):
        self.utility = Utility()

    def history_prompt(
        self,
    ):
        prompts = self.utility.load_prompts()
        template_S = prompts["prompt"]["history"]["system"]
        system_message_prompt = SystemMessagePromptTemplate.from_template(template_S)

        template = prompts["prompt"]["history"]["user"]
        prompt = ChatPromptTemplate.from_messages([system_message_prompt, template])

        return prompt

    def bookmark_prompt(
        self,
    ):
        prompts = self.utility.load_prompts()
        template_S = prompts["prompt"]["bookmark"]["system"]
        system_message_prompt = SystemMessagePromptTemplate.from_template(template_S)

        template = prompts["prompt"]["bookmark"]["user"]
        prompt = ChatPromptTemplate.from_messages([system_message_prompt, template])

        return prompt

    def parser_prompt(self, parser, flag):
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
