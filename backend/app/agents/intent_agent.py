"""
Intent Detection / Entity Extraction Agent
==========================================
Priority Agent 1 (Part 2) — Extracts structured entities from classified emails.

Output format matches the lead's project brief example:
{
  "type": "Meeting Request",
  "meeting_time": "Tomorrow 3 PM",
  "agenda": "Q3 Performance Dashboard Review",
  "required_preparation": ["Review metrics", "Review dashboard"]
}
"""
from __future__ import annotations
import uuid
from typing import Any, Optional

import dateparser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

from app.core.llm_router import AgentTask, get_llm
from app.models.schemas import ExtractedIntent
from app.models.state import AgentState


EXTRACTION_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are an expert information extractor for an AI Executive Assistant.
Extract structured information from the email below.

Return a JSON object with these fields:
- type: the email category (meeting_request | follow_up | action_required | fyi | escalation | approval_request)
- meeting_time_raw_text: the exact time phrase from the email (e.g. "tomorrow at 3 PM"), or null
- agenda: the meeting topic or main subject, or null
- participants: list of people mentioned by name or email
- deadlines: list of deadline phrases mentioned
- action_items: list of specific tasks/actions mentioned
- required_preparation: list of preparation items (e.g. "Review dashboard", "Check metrics")
- priority: low | normal | high | urgent

Be precise. Only include fields that are actually present in the email.
"""),
    ("human", """Email Category: {category}

From: {sender}
Subject: {subject}

{body}

Extract all structured entities.""")
])


async def intent_extraction_node(state: AgentState) -> AgentState:
    """
    LangGraph node: Extracts structured intent from the classified email.
    Reads: raw_payload, email_category
    Writes: intent (ExtractedIntent)
    """
    payload = state.get("raw_payload", {})
    category = state.get("email_category", "fyi")
    sender = payload.get("sender", "")
    subject = payload.get("subject", "")
    body = payload.get("body", "")

    try:
        llm = get_llm(AgentTask.INTENT_EXTRACTION, temperature=0.0)
        chain = EXTRACTION_PROMPT | llm | JsonOutputParser()

        result: dict[str, Any] = await chain.ainvoke({
            "category": category,
            "sender": sender,
            "subject": subject,
            "body": body,
        })

        # Normalize meeting_time if present
        meeting_time = None
        raw_time = result.get("meeting_time_raw_text")
        if raw_time:
            parsed = dateparser.parse(raw_time, settings={"PREFER_DATES_FROM": "future"})
            meeting_time = parsed

        intent = ExtractedIntent(
            type=result.get("type", category),
            meeting_time=meeting_time,
            meeting_time_raw_text=raw_time,
            agenda=result.get("agenda"),
            participants=result.get("participants", []),
            deadlines=result.get("deadlines", []),
            action_items=result.get("action_items", []),
            required_preparation=result.get("required_preparation", []),
            priority=result.get("priority", "normal"),
            confidence=0.9,
        )

        return {**state, "intent": intent, "error": None}

    except Exception as exc:
        print(f"[IntentAgent Node] ⚠️ API call failed: {exc}. Using fallback...")
        # Fallback offline extraction
        cleaned_subj = subject.replace("Re:", "").replace("Fwd:", "").strip()
        intent = ExtractedIntent(
            type=category,
            meeting_time=None,
            meeting_time_raw_text=None,
            agenda=cleaned_subj or "Email interaction",
            participants=[sender] if sender else [],
            deadlines=[],
            action_items=[],
            required_preparation=[],
            priority="normal",
            confidence=0.5,
        )
        return {
            **state,
            "intent": intent,
            "error": f"API rate limit reached (fallback used): {exc}",
        }


async def extract_intent(
    category: str,
    sender: str,
    subject: str,
    body: str,
) -> dict[str, Any]:
    """Standalone entity extraction — usable outside the supervisor graph."""
    try:
        llm = get_llm(AgentTask.INTENT_EXTRACTION, temperature=0.0)
        chain = EXTRACTION_PROMPT | llm | JsonOutputParser()
        return await chain.ainvoke({
            "category": category,
            "sender": sender,
            "subject": subject,
            "body": body,
        })
    except Exception as exc:
        print(f"[IntentAgent] ⚠️ API call failed: {exc}. Using fallback...")
        cleaned_subj = subject.replace("Re:", "").replace("Fwd:", "").strip()
        return {
            "type": category,
            "meeting_time_raw_text": None,
            "agenda": cleaned_subj or "Email interaction",
            "participants": [sender] if sender else [],
            "deadlines": [],
            "action_items": [],
            "required_preparation": [],
            "priority": "normal",
        }
