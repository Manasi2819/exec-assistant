"""
Email Reply Agent
=================
Priority Agent 4 — Drafts contextual email replies.
ALWAYS requires human Approve / Edit / Reject before sending.

Never sends autonomously — the graph pauses at the human_approval_gate node.
"""
from __future__ import annotations
import uuid
from typing import Any

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from app.core.llm_router import AgentTask, get_llm
from app.models.schemas import ReplyDraftResponse
from app.models.state import AgentState


REPLY_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are an AI Executive Assistant drafting a professional email reply.

Write a concise, professional reply to the email below.
- Use the sender's name in the greeting
- Keep it short (2-4 sentences typically)
- Be direct and actionable
- Sign off with the user's name: {user_name}

Only write the email body — no subject line needed.
"""),
    ("human", """Incoming Email:
From: {sender}
Subject: {subject}

{email_body}

Context from prior conversations:
{rag_context}

Draft a professional reply.""")
])


async def reply_draft_node(state: AgentState) -> AgentState:
    """
    LangGraph node: Drafts a reply. Sets requires_human_approval = True.
    The graph MUST pause at human_approval_gate before any send action.
    Reads: raw_payload, rag_context
    Writes: reply_draft, requires_human_approval
    """
    payload = state.get("raw_payload", {})
    rag_context = state.get("rag_context", "")
    email_body = payload.get("body", "")
    subject = payload.get("subject", "")
    user_name = payload.get("user_name", "User")
    sender = payload.get("sender", "")

    try:
        llm = get_llm(AgentTask.REPLY_DRAFT, temperature=0.3)
        chain = REPLY_PROMPT | llm | StrOutputParser()

        body: str = await chain.ainvoke({
            "sender": sender,
            "subject": subject,
            "email_body": email_body,
            "rag_context": rag_context or "No prior context.",
            "user_name": user_name,
        })

        draft = ReplyDraftResponse(
            draft_id=str(uuid.uuid4()),
            subject=f"Re: {subject}",
            body=body.strip(),
            confidence=0.85,
            approval_status="pending",
        )

        return {
            **state,
            "reply_draft": draft,
            "requires_human_approval": True,
            "approval_status": "pending",
            "error": None,
        }

    except Exception as exc:
        print(f"[ReplyAgent Node] ⚠️ API call failed: {exc}. Using fallback...")
        email_lower = email_body.lower()
        subj_lower = subject.lower()
        
        if "schedule" in email_lower or "schedule" in subj_lower or "meeting" in email_lower or "meet" in email_lower or "availability" in email_lower:
            body = (
                f"Hi,\n\n"
                f"Thank you for reaching out. I would be happy to meet. "
                f"I'll check my availability and follow up shortly with a few potential times for us to connect.\n\n"
                f"Best regards,\n"
                f"{user_name}"
            )
        elif "report" in email_lower or "brief" in email_lower or "document" in email_lower or "files" in email_lower or "attached" in email_lower:
            body = (
                f"Hi,\n\n"
                f"Thank you for sharing these documents. I will review the materials shortly "
                f"and get back to you with my detailed feedback as soon as possible.\n\n"
                f"Best regards,\n"
                f"{user_name}"
            )
        elif "urgent" in email_lower or "asap" in email_lower or "important" in email_lower:
            body = (
                f"Hi,\n\n"
                f"Thanks for flagging this. I have received your message and will prioritize "
                f"reviewing it. I will get back to you shortly.\n\n"
                f"Best regards,\n"
                f"{user_name}"
            )
        else:
            body = (
                f"Hi,\n\n"
                f"Thank you for your email. I have received it and will look into this. "
                f"I'll follow up with you as soon as I have an update.\n\n"
                f"Best regards,\n"
                f"{user_name}"
            )
            
        draft = ReplyDraftResponse(
            draft_id=str(uuid.uuid4()),
            subject=f"Re: {subject}",
            body=body.strip(),
            confidence=0.5,
            approval_status="pending",
        )
        return {
            **state,
            "reply_draft": draft,
            "requires_human_approval": True,
            "approval_status": "pending",
            "error": f"API rate limit reached (fallback used): {exc}",
        }


async def draft_reply(
    sender: str,
    subject: str,
    email_body: str,
    user_name: str = "User",
    rag_context: str = "",
) -> ReplyDraftResponse:
    """Standalone reply drafter — usable outside the supervisor graph."""
    try:
        llm = get_llm(AgentTask.REPLY_DRAFT, temperature=0.3)
        chain = REPLY_PROMPT | llm | StrOutputParser()

        body = await chain.ainvoke({
            "sender": sender,
            "subject": subject,
            "email_body": email_body,
            "rag_context": rag_context or "No prior context.",
            "user_name": user_name,
        })
        confidence = 0.85
    except Exception as exc:
        print(f"[ReplyAgent] ⚠️ API call failed: {exc}. Generating offline fallback draft...")
        email_lower = email_body.lower()
        subj_lower = subject.lower()
        confidence = 0.5
        
        if "schedule" in email_lower or "schedule" in subj_lower or "meeting" in email_lower or "meet" in email_lower or "availability" in email_lower:
            body = (
                f"Hi,\n\n"
                f"Thank you for reaching out. I would be happy to meet. "
                f"I'll check my availability and follow up shortly with a few potential times for us to connect next week.\n\n"
                f"Best regards,\n"
                f"{user_name}"
            )
        elif "report" in email_lower or "brief" in email_lower or "document" in email_lower or "files" in email_lower or "attached" in email_lower:
            body = (
                f"Hi,\n\n"
                f"Thank you for sharing these documents. I will review the materials shortly "
                f"and get back to you with my detailed feedback as soon as possible.\n\n"
                f"Best regards,\n"
                f"{user_name}"
            )
        elif "urgent" in email_lower or "asap" in email_lower or "important" in email_lower:
            body = (
                f"Hi,\n\n"
                f"Thanks for flagging this. I have received your message and will prioritize "
                f"reviewing it. I will get back to you shortly.\n\n"
                f"Best regards,\n"
                f"{user_name}"
            )
        else:
            body = (
                f"Hi,\n\n"
                f"Thank you for your email. I have received it and will look into this. "
                f"I'll follow up with you as soon as I have an update.\n\n"
                f"Best regards,\n"
                f"{user_name}"
            )

    return ReplyDraftResponse(
        draft_id=str(uuid.uuid4()),
        subject=f"Re: {subject}",
        body=body.strip(),
        confidence=confidence,
        approval_status="pending",
    )
