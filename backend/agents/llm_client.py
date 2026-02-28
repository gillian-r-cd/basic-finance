"""
llm_client.py - Unified LLM call layer. Shared AsyncOpenAI singleton + call functions.
All LLM calls in the system go through this module.
Main functions:
  get_client() -> AsyncOpenAI singleton
  get_model() -> model name from env
  call_llm(messages, stream=False) -> raw text or async stream
Design ref: MVP2 section 2 (LLM call layer unification), design doc 10.3.
"""
import os
from openai import AsyncOpenAI

_client: AsyncOpenAI | None = None


def get_client() -> AsyncOpenAI:
    """Return the shared AsyncOpenAI singleton. Created on first call."""
    global _client
    if _client is None:
        _client = AsyncOpenAI(
            api_key=os.environ.get("OPENAI_API_KEY", "dummy"),
            base_url=os.environ.get("OPENAI_BASE_URL",
                                    "https://ark.cn-beijing.volces.com/api/v3"),
        )
    return _client


def get_model() -> str:
    """Return the LLM model name from environment."""
    return os.environ.get("MODEL_NAME", "ep-your-model")


async def call_llm(messages: list[dict], stream: bool = False):
    """
    Unified LLM call.
    - stream=False: returns the full response text (str).
    - stream=True: returns the raw async stream object for the caller
      to iterate over chunks.
    """
    client = get_client()
    model = get_model()

    if stream:
        return await client.chat.completions.create(
            model=model, messages=messages, stream=True
        )
    else:
        response = await client.chat.completions.create(
            model=model, messages=messages
        )
        return response.choices[0].message.content
