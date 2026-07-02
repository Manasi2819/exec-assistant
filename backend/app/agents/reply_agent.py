"""
Email Reply Agent
=================
Priority Agent 4 — Drafts contextual, intelligence-aware email replies.
ALWAYS requires human Approve / Edit / Reject before sending.

Never sends autonomously — the graph pauses at the human_approval_gate node.

Enhanced in Phase 2:
- Context-aware prompting using email type and sender relationship
- Understands attendee escalation (meeting delegation vs acceptance)
- Uses thread history for continuity
- Entity-aware (meeting times, deadlines, approval items)
"""
from __future__ import annotations
import uuid
from typing import Any

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from app.core.llm_router import AgentTask, get_llm
from app.models.schemas import ReplyDraftResponse
from app.models.state import AgentState


# ── Context-aware reply prompt ────────────────────────────────────────────────

REPLY_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are an AI Executive Assistant drafting a professional email reply on behalf of the executive.

EMAIL CONTEXT:
- Email Type: {email_type}
- Sender Relationship: {sender_relationship}
- Priority Level: {priority_level}
- Attendee Requested: {attendee_requested}
- Delegate Name (if delegating): {delegate_name}

REPLY GUIDELINES based on email type:
- escalation / urgent: Acknowledge urgency, confirm immediate action, state next step clearly
- approval_request: Confirm approval or request more info — be decisive
- meeting_request: Confirm attendance or propose alternative times
- daily_project_update / weekly_report: Brief acknowledgment of key items, note any blockers you'll address
- follow_up: Give a concrete answer or clear timeline
- action_required: Confirm the action you'll take and when
- client_query: Professional, client-friendly tone; resolve the query or escalate
- invoice_finance: Confirm receipt and approval process
- hr_communication: Acknowledge and confirm any required actions

STYLE:
- Use the sender's first name in the greeting
- Keep it concise (2–4 sentences unless detail is needed)
- Be direct and actionable — executives don't write long emails
- If attendee_requested=true and delegate_name is set, write a professional delegation response naming {delegate_name}
- If attendee_requested=true and no delegate, confirm attendance
- Sign off with: {user_name}

Write ONLY the email body — no subject line.
"""),
    ("human", """Incoming Email:
From: {sender}
Subject: {subject}

{email_body}

Thread History:
{thread_history}

Context from knowledge base:
{rag_context}

Draft a professional reply.""")
])


# ── LangGraph node ────────────────────────────────────────────────────────────

async def reply_draft_node(state: AgentState) -> AgentState:
    """
    LangGraph node: Drafts a context-aware reply. Sets requires_human_approval = True.
    The graph MUST pause at human_approval_gate before any send action.
    Reads: raw_payload, rag_context, email_intelligence (if available), intent
    Writes: reply_draft, requires_human_approval
    """
    payload = state.get("raw_payload", {})
    rag_context = state.get("rag_context", "")
    email_body = payload.get("body", "")
    subject = payload.get("subject", "")
    user_name = payload.get("user_name", "Executive")
    sender = payload.get("sender", "")

    # Pull enriched context from email intelligence if available
    intelligence = state.get("email_intelligence")
    intent = state.get("intent")

    email_type = "fyi"
    sender_relationship = "unknown"
    priority_level = "medium"
    attendee_requested = False
    delegate_name = ""
    thread_history = payload.get("thread_history", "No prior thread history.")

    if intelligence:
        email_type = intelligence.email_type
        sender_relationship = intelligence.sender_profile.relationship_strength
        priority_level = intelligence.priority_level
        attendee_requested = intelligence.entities.attendee_requested
        delegate_name = payload.get("delegate_name", "")
    elif intent:
        email_type = intent.type
        priority_level = intent.priority

    try:
        llm = get_llm(AgentTask.REPLY_DRAFT, temperature=0.3)
        chain = REPLY_PROMPT | llm | StrOutputParser()

        body: str = await chain.ainvoke({
            "sender": sender,
            "subject": subject,
            "email_body": email_body,
            "email_type": email_type,
            "sender_relationship": sender_relationship.replace("_", " "),
            "priority_level": priority_level,
            "attendee_requested": str(attendee_requested),
            "delegate_name": delegate_name,
            "thread_history": thread_history or "No prior thread history.",
            "rag_context": rag_context or "No prior context.",
            "user_name": user_name,
        })

        draft = ReplyDraftResponse(
            draft_id=str(uuid.uuid4()),
            subject=f"Re: {subject}",
            body=body.strip(),
            confidence=0.88,
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
        body = _offline_fallback_draft(email_body, subject, email_type, user_name, attendee_requested, delegate_name)

        draft = ReplyDraftResponse(
            draft_id=str(uuid.uuid4()),
            subject=f"Re: {subject}",
            body=body.strip(),
            confidence=0.55,
            approval_status="pending",
        )
        return {
            **state,
            "reply_draft": draft,
            "requires_human_approval": True,
            "approval_status": "pending",
            "error": f"API limit reached (fallback used): {exc}",
        }


# ── Standalone helper ─────────────────────────────────────────────────────────

async def draft_reply(
    sender: str,
    subject: str,
    email_body: str,
    user_name: str = "Executive",
    rag_context: str = "",
    email_type: str = "fyi",
    sender_relationship: str = "unknown",
    priority_level: str = "medium",
    attendee_requested: bool = False,
    delegate_name: str = "",
    thread_history: str = "",
) -> ReplyDraftResponse:
    """Standalone reply drafter — usable outside the supervisor graph."""
    try:
        llm = get_llm(AgentTask.REPLY_DRAFT, temperature=0.3)
        chain = REPLY_PROMPT | llm | StrOutputParser()

        body = await chain.ainvoke({
            "sender": sender,
            "subject": subject,
            "email_body": email_body,
            "email_type": email_type,
            "sender_relationship": sender_relationship.replace("_", " "),
            "priority_level": priority_level,
            "attendee_requested": str(attendee_requested),
            "delegate_name": delegate_name,
            "thread_history": thread_history or "No prior thread history.",
            "rag_context": rag_context or "No prior context.",
            "user_name": user_name,
        })
        confidence = 0.88

    except Exception as exc:
        print(f"[ReplyAgent] ⚠️ API call failed: {exc}. Generating offline fallback draft...")
        body = _offline_fallback_draft(email_body, subject, email_type, user_name, attendee_requested, delegate_name)
        confidence = 0.55

    return ReplyDraftResponse(
        draft_id=str(uuid.uuid4()),
        subject=f"Re: {subject}",
        body=body.strip(),
        confidence=confidence,
        approval_status="pending",
    )


def _offline_fallback_draft(
    email_body: str,
    subject: str,
    email_type: str,
    user_name: str,
    attendee_requested: bool = False,
    delegate_name: str = "",
) -> str:
    """Offline keyword-based fallback when LLM is unavailable."""
    text = f"{subject} {email_body}".lower()

    if attendee_requested:
        if delegate_name:
            return (
                f"Hi,\n\n"
                f"Thank you for the invitation. I won't be able to attend personally, "
                f"but I've arranged for {delegate_name} to represent me at the meeting. "
                f"They have been fully briefed and have full authority to discuss and decide on all agenda items.\n\n"
                f"Please don't hesitate to reach out if you need anything further.\n\n"
                f"Best regards,\n{user_name}"
            )
        else:
            return (
                f"Hi,\n\n"
                f"Thank you for the invitation. I've reviewed the meeting details and "
                f"will confirm my attendance. Please send the calendar invite to my email.\n\n"
                f"Best regards,\n{user_name}"
            )

    if email_type in ("escalation",) or any(w in text for w in ["urgent", "critical", "asap", "immediate"]):
        return (
            f"Hi,\n\n"
            f"Thank you for flagging this. I've reviewed the situation and am treating it as a top priority. "
            f"I'll coordinate with the relevant teams immediately and will provide a formal update within the hour.\n\n"
            f"Best regards,\n{user_name}"
        )

    if email_type == "approval_request" or any(w in text for w in ["approve", "approval", "sign-off"]):
        return (
            f"Hi,\n\n"
            f"Thank you for the submission. I've reviewed the details and approve this request. "
            f"Please proceed as planned and keep me informed of next steps.\n\n"
            f"Best regards,\n{user_name}"
        )

    if email_type == "meeting_request" or any(w in text for w in ["meet", "schedule", "attendance", "zoom", "calendar"]):
        return (
            f"Hi,\n\n"
            f"Thank you for the invitation. I've noted the meeting details and will confirm attendance. "
            f"Please send the calendar invite and any pre-read materials in advance.\n\n"
            f"Best regards,\n{user_name}"
        )

    if email_type in ("daily_project_update", "weekly_report"):
        return (
            f"Hi,\n\n"
            f"Thank you for the update. I've reviewed the progress and am tracking the blockers noted. "
            f"Please continue as planned and escalate immediately if any blocker extends beyond the expected timeline.\n\n"
            f"Best regards,\n{user_name}"
        )

    if email_type == "invoice_finance" or any(w in text for w in ["invoice", "payment", "wire transfer"]):
        return (
            f"Hi,\n\n"
            f"Thank you for sharing this. I've reviewed the invoice details and approve processing. "
            f"Please proceed with the payment as outlined.\n\n"
            f"Best regards,\n{user_name}"
        )

    if email_type == "follow_up" or any(w in text for w in ["following up", "checking in", "any updates"]):
        return (
            f"Hi,\n\n"
            f"Thank you for following up. I've noted your request and will get back to you with "
            f"a definitive answer by end of day.\n\n"
            f"Best regards,\n{user_name}"
        )

    # Generic fallback
    return (
        f"Hi,\n\n"
        f"Thank you for your email. I've received and reviewed your message "
        f"and will follow up with you shortly.\n\n"
        f"Best regards,\n{user_name}"
    )
