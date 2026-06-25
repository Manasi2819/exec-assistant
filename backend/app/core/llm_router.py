"""
LLM Router — Dual-provider model selection.

Priority:
  1. If OPENAI_API_KEY is set → use OpenAI GPT models (paid, highest accuracy)
  2. If GOOGLE_API_KEY is set → use Google Gemini models (free tier)
  3. If both are set → route per task: heavy synthesis → GPT-5, classification → Gemini Flash

Agent → Model mapping (both paid and free options):
  EMAIL_CLASSIFICATION    → GPT-4.1-mini  | gemini-2.0-flash
  INTENT_EXTRACTION       → GPT-4.1       | gemini-2.5-pro
  CALENDAR                → GPT-4.1-mini  | gemini-2.0-flash   (mostly deterministic)
  MEETING_PREP            → GPT-5         | gemini-2.5-pro
  REPLY_DRAFT             → GPT-4.1       | gemini-2.5-pro
  TRANSCRIPT              → GPT-5         | gemini-2.5-pro
  MOM                     → GPT-5         | gemini-2.5-pro
  FOLLOWUP                → GPT-4.1-mini  | gemini-2.0-flash
  TASK_TRACKING           → GPT-4.1-mini  | gemini-2.0-flash
  RAG_SYNTHESIS           → GPT-4.1       | gemini-2.5-pro
  NOTIFICATION            → None          (template-only, no LLM)
"""
from __future__ import annotations
from enum import Enum
from typing import Any

from langchain_core.language_models import BaseChatModel

from app.core.config import get_settings


class AgentTask(str, Enum):
    EMAIL_CLASSIFICATION = "email_classification"
    INTENT_EXTRACTION = "intent_extraction"
    CALENDAR = "calendar"
    MEETING_PREP = "meeting_prep"
    REPLY_DRAFT = "reply_draft"
    TRANSCRIPT = "transcript"
    MOM = "mom"
    FOLLOWUP = "followup"
    TASK_TRACKING = "task_tracking"
    RAG_SYNTHESIS = "rag_synthesis"


# Routing tables — OpenAI model names
_OPENAI_ROUTING: dict[AgentTask, str] = {
    AgentTask.EMAIL_CLASSIFICATION: "gpt-4.1-mini",
    AgentTask.INTENT_EXTRACTION:    "gpt-4.1",
    AgentTask.CALENDAR:             "gpt-4.1-mini",
    AgentTask.MEETING_PREP:         "gpt-4o",        # fallback if gpt-5 unavailable
    AgentTask.REPLY_DRAFT:          "gpt-4.1",
    AgentTask.TRANSCRIPT:           "gpt-4o",
    AgentTask.MOM:                  "gpt-4o",
    AgentTask.FOLLOWUP:             "gpt-4.1-mini",
    AgentTask.TASK_TRACKING:        "gpt-4.1-mini",
    AgentTask.RAG_SYNTHESIS:        "gpt-4.1",
}

# Routing tables — Google Gemini model names
_GEMINI_ROUTING: dict[AgentTask, str] = {
    AgentTask.EMAIL_CLASSIFICATION: "gemini-2.5-flash",
    AgentTask.INTENT_EXTRACTION:    "gemini-2.5-flash",
    AgentTask.CALENDAR:             "gemini-2.5-flash",
    AgentTask.MEETING_PREP:         "gemini-2.5-flash",
    AgentTask.REPLY_DRAFT:          "gemini-2.5-flash",
    AgentTask.TRANSCRIPT:           "gemini-2.5-flash",
    AgentTask.MOM:                  "gemini-2.5-flash",
    AgentTask.FOLLOWUP:             "gemini-2.5-flash",
    AgentTask.TASK_TRACKING:        "gemini-2.5-flash",
    AgentTask.RAG_SYNTHESIS:        "gemini-2.5-flash",
}


def get_llm(task: AgentTask, temperature: float = 0.0, **kwargs: Any) -> BaseChatModel:
    """
    Return the appropriate LangChain chat model for the given agent task.
    Prefers OpenAI if available, falls back to Gemini.
    Raises RuntimeError if neither API key is configured.
    """
    settings = get_settings()

    if not settings.has_any_llm:
        raise RuntimeError(
            "No LLM API key configured. Set OPENAI_API_KEY (paid) or "
            "GOOGLE_API_KEY (free) in your .env file."
        )

    if settings.has_openai:
        from langchain_openai import ChatOpenAI
        model_name = _OPENAI_ROUTING[task]
        return ChatOpenAI(
            model=model_name,
            api_key=settings.openai_api_key,
            temperature=temperature,
            **kwargs,
        )
    else:
        from langchain_google_genai import ChatGoogleGenerativeAI
        model_name = _GEMINI_ROUTING[task]
        return ChatGoogleGenerativeAI(
            model=model_name,
            google_api_key=settings.google_api_key,
            temperature=temperature,
            **kwargs,
        )


def get_active_provider() -> str:
    """Return which LLM provider is currently active."""
    settings = get_settings()
    if settings.has_openai:
        return "openai"
    elif settings.has_gemini:
        return "gemini"
    return "none"


def get_embedding_model():
    """Return a LangChain embedding model based on the active provider."""
    settings = get_settings()
    if settings.has_openai:
        from langchain_openai import OpenAIEmbeddings
        return OpenAIEmbeddings(
            model="text-embedding-3-large",
            api_key=settings.openai_api_key,
        )
    elif settings.has_gemini:
        from langchain_google_genai import GoogleGenerativeAIEmbeddings
        return GoogleGenerativeAIEmbeddings(
            model="models/gemini-embedding-2",
            google_api_key=settings.google_api_key,
        )
    raise RuntimeError("No LLM API key configured — cannot create embedding model.")
