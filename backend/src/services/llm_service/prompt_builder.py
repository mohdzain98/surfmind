"""Prompt builder utilities for history and bookmark tasks.
Generates chat prompts and parser prompts for the LLM pipeline.
"""

from langchain_core.prompts import (
    ChatPromptTemplate,
    SystemMessagePromptTemplate,
    PromptTemplate,
)
from src.utility.utils import Utility


class Prompts:
    """Build prompt templates for response generation and parsing.
    Loads configured templates and assembles chat prompts.
    """

    def __init__(self):
        """Initialize prompt helper with shared utilities.
        Uses the Utility loader for configuration access.
        """
        self.utility = Utility()

    def history_prompt(
        self,
    ):
        """Build the history response prompt template.
        Returns a chat prompt ready for invocation.
        """
        prompts = self.utility.load_prompts()
        template_S = prompts["prompt"]["history"]["system"]
        system_message_prompt = SystemMessagePromptTemplate.from_template(template_S)

        template = prompts["prompt"]["history"]["user"]
        prompt = ChatPromptTemplate.from_messages([system_message_prompt, template])

        return prompt

    def bookmark_prompt(
        self,
    ):
        """Build the bookmark response prompt template.
        Returns a chat prompt ready for invocation.
        """
        prompts = self.utility.load_prompts()
        template_S = prompts["prompt"]["bookmark"]["system"]
        system_message_prompt = SystemMessagePromptTemplate.from_template(template_S)

        template = prompts["prompt"]["bookmark"]["user"]
        prompt = ChatPromptTemplate.from_messages([system_message_prompt, template])

        return prompt

    def parser_prompt(self, parser, flag):
        """Create a parser prompt for structured output extraction.
        Returns a PromptTemplate configured with format instructions.
        """
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
