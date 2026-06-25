"""
Email Intelligence Agent
========================
Priority Agent 1 — Classifies inbound emails into 6 categories
and triggers entity extraction via Intent Agent.

Categories:
  - Meeting Request
  - Follow-up
  - Action Required
  - FYI
  - Escalation
  - Approval Request
"""
from __future__ import annotations
import uuid
from typing import Any

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field

from app.core.llm_router import AgentTask, get_llm
from app.models.state import AgentState


# ── Classification output schema ──────────────────────────────

class EmailClassification(BaseModel):
    category: str = Field(
        description="One of: meeting_request, follow_up, action_required, fyi, escalation, approval_request"
    )
    priority: str = Field(description="One of: low, normal, high, urgent")
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str = Field(description="One-sentence explanation of classification")


# ── Prompt ────────────────────────────────────────────────────

CLASSIFICATION_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are an expert email classifier for an AI Executive Assistant.
Classify the given email into exactly one of these 6 categories:

1. meeting_request   — The sender is proposing, requesting, or inviting to a meeting
2. follow_up         — Checking on a previously discussed topic, deliverable, or action
3. action_required   — Something specific must be done by the recipient
4. fyi               — Informational only; no action required
5. escalation        — Urgent issue needing immediate attention or escalation
6. approval_request  — Asking for approval, sign-off, or decision

Also determine priority: low, normal, high, urgent.
Respond in JSON with keys: category, priority, confidence (0.0-1.0), reasoning.
"""),
    ("human", """From: {sender}
Subject: {subject}

{body}

Classify this email.""")
])


# ── Agent node ────────────────────────────────────────────────

async def email_classification_node(state: AgentState) -> AgentState:
    """
    LangGraph node: Ingest and classify the email in state['raw_payload'].
    Writes: email_id, email_category, email_priority, email_confidence.
    """
    payload = state.get("raw_payload", {})
    trace_id = state.get("trace_id", str(uuid.uuid4()))
    sender = payload.get("sender", "unknown")
    subject = payload.get("subject", "")
    body = payload.get("body", "")

    try:
        llm = get_llm(AgentTask.EMAIL_CLASSIFICATION, temperature=0.0)
        chain = CLASSIFICATION_PROMPT | llm | JsonOutputParser()

        result: dict[str, Any] = await chain.ainvoke({
            "sender": sender,
            "subject": subject,
            "body": body,
        })

        return {
            **state,
            "email_id": payload.get("message_id", str(uuid.uuid4())),
            "email_category": result.get("category", "fyi"),
            "email_priority": result.get("priority", "normal"),
            "email_confidence": float(result.get("confidence", 0.8)),
            "error": None,
        }

    except Exception as exc:
        print(f"[EmailAgent Node] ⚠️ API call failed: {exc}. Using fallback...")
        text_lower = f"{subject} {body}".lower()
        if any(w in text_lower for w in ["schedule", "meet", "meeting", "zoom", "invite", "calendar", "availability"]):
            cat, prio = "meeting_request", "normal"
        elif any(w in text_lower for w in ["follow-up", "checking in", "status update", "any updates", "following up"]):
            cat, prio = "follow_up", "normal"
        elif any(w in text_lower for w in ["urgent", "asap", "immediate", "critical"]):
            cat, prio = "escalation", "urgent"
        elif any(w in text_lower for w in ["approve", "sign-off", "approval", "review and approve"]):
            cat, prio = "approval_request", "normal"
        elif any(w in text_lower for w in ["todo", "action required", "please do", "need to"]):
            cat, prio = "action_required", "normal"
        else:
            cat, prio = "fyi", "low"

        return {
            **state,
            "email_id": payload.get("message_id", str(uuid.uuid4())),
            "email_category": cat,
            "email_priority": prio,
            "email_confidence": 0.5,
            "error": f"API call failed, fallback used: {exc}",
        }


# ── Standalone helper (for direct API call) ───────────────────

async def classify_email(
    sender: str,
    subject: str,
    body: str,
) -> dict[str, Any]:
    """Classify a single email — usable outside the LangGraph supervisor."""
    try:
        llm = get_llm(AgentTask.EMAIL_CLASSIFICATION, temperature=0.0)
        chain = CLASSIFICATION_PROMPT | llm | JsonOutputParser()
        return await chain.ainvoke({
            "sender": sender,
            "subject": subject,
            "body": body,
        })
    except Exception as exc:
        print(f"[EmailAgent] ⚠️ API call failed: {exc}. Using fallback...")
        text_lower = f"{subject} {body}".lower()
        if any(w in text_lower for w in ["schedule", "meet", "meeting", "zoom", "invite", "calendar", "availability"]):
            cat, prio = "meeting_request", "normal"
        elif any(w in text_lower for w in ["follow-up", "checking in", "status update", "any updates", "following up"]):
            cat, prio = "follow_up", "normal"
        elif any(w in text_lower for w in ["urgent", "asap", "immediate", "critical"]):
            cat, prio = "escalation", "urgent"
        elif any(w in text_lower for w in ["approve", "sign-off", "approval", "review and approve"]):
            cat, prio = "approval_request", "normal"
        elif any(w in text_lower for w in ["todo", "action required", "please do", "need to"]):
            cat, prio = "action_required", "normal"
        else:
            cat, prio = "fyi", "low"

        return {
            "category": cat,
            "priority": prio,
            "confidence": 0.5,
            "reasoning": f"Fallback classification used due to API error: {exc}"
        }
