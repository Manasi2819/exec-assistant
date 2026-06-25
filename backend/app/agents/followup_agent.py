"""
Follow-Up Agent
================
Phase 2 — Drafts and schedules follow-up emails after meetings.

Three follow-up types:
  1. Action item reminders  — sent to action item owners (pre-deadline)
  2. Post-meeting follow-up — summary email to all attendees post-MoM approval
  3. Pending response chase — follows up on unanswered email threads

All drafts require human Approve / Edit / Reject before sending.
"""
from __future__ import annotations
import uuid
from typing import Any, Literal

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from app.core.llm_router import AgentTask, get_llm
from app.models.schemas import MoMResponse, ActionItemExtracted, ReplyDraftResponse
from app.models.state import AgentState


# ── Post-meeting follow-up prompt ─────────────────────────────

FOLLOWUP_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are an AI Executive Assistant drafting a post-meeting follow-up email.
Write a professional, concise follow-up to send to all meeting attendees.

Include:
- Brief thank-you and meeting reference
- 2-3 key decisions made
- Each person's action items with due dates
- Clear next steps

Keep it under 200 words. Use bullet points. Sign off with the sender's name.
"""),
    ("human", """Meeting: {meeting_title} ({meeting_date})
Attendees: {attendees}
Sender: {sender_name}

Decisions:
{decisions}

Action Items:
{action_items}

Write the follow-up email body.""")
])

# ── Action item reminder prompt ────────────────────────────────

REMINDER_PROMPT = ChatPromptTemplate.from_messages([
    ("system", "You are an AI Executive Assistant writing a friendly but professional action item reminder. Keep it brief (2-3 sentences). Don't be pushy."),
    ("human", """Remind {owner_name} about their action item:
Task: {task_description}
Due: {due_date}
Meeting context: {meeting_title}

Write a short reminder email body.""")
])

# ── Pending response chase prompt ─────────────────────────────

CHASE_PROMPT = ChatPromptTemplate.from_messages([
    ("system", "You are an AI Executive Assistant writing a polite follow-up on an unanswered email. Keep it short, 2-3 sentences max."),
    ("human", """Original email subject: {subject}
Sent to: {recipient}
Original sent date: {sent_date}
Days since sent: {days_since}

Write a polite follow-up body.""")
])


async def followup_generation_node(state: AgentState) -> AgentState:
    """
    LangGraph node: Drafts post-meeting follow-up from approved MoM.
    Reads:  mom, raw_payload (sender_name)
    Writes: reply_draft, requires_human_approval=True
    """
    mom = state.get("mom")
    if not mom:
        return {**state, "error": "FollowUpAgent: no MoM in state"}

    payload = state.get("raw_payload", {})

    try:
        draft = await generate_post_meeting_followup(
            mom=mom,
            sender_name=payload.get("sender_name", "User"),
        )
        return {
            **state,
            "reply_draft": draft,
            "requires_human_approval": True,
            "approval_status": "pending",
            "error": None,
        }
    except Exception as exc:
        return {
            **state,
            "error": f"FollowUpAgent failed: {exc}",
            "retry_count": state.get("retry_count", 0) + 1,
        }


async def generate_post_meeting_followup(
    mom: MoMResponse,
    sender_name: str = "User",
) -> ReplyDraftResponse:
    """Generate post-meeting follow-up email from an approved MoM."""
    action_items_text = "\n".join(
        f"  • {item.owner}: {item.description} (due: {item.due_date or 'TBD'})"
        for item in mom.action_items
    )

    try:
        llm = get_llm(AgentTask.FOLLOWUP, temperature=0.2)
        chain = FOLLOWUP_PROMPT | llm | StrOutputParser()

        body = await chain.ainvoke({
            "meeting_title": mom.meeting_title,
            "meeting_date": mom.meeting_date,
            "attendees": ", ".join(mom.attendees),
            "sender_name": sender_name,
            "decisions": "\n".join(f"  • {d}" for d in mom.decisions),
            "action_items": action_items_text,
        })
    except Exception as exc:
        print(f"[FollowUpAgent] ⚠️ API call failed in generate_post_meeting_followup: {exc}. Using fallback...")
        body = (
            f"Dear team,\n\n"
            f"Thank you for attending the meeting regarding: {mom.meeting_title}.\n\n"
            f"Decisions made:\n"
            + "\n".join(f"  • {d}" for d in mom.decisions) + "\n\n"
            f"Action items:\n"
            + action_items_text + "\n\n"
            f"Best regards,\n"
            f"{sender_name}"
        )

    return ReplyDraftResponse(
        draft_id=str(uuid.uuid4()),
        subject=f"Follow-up: {mom.meeting_title} — {mom.meeting_date}",
        body=body.strip(),
        confidence=0.9,
        approval_status="pending",
    )


async def generate_action_item_reminder(
    owner_name: str,
    task_description: str,
    due_date: str,
    meeting_title: str,
) -> ReplyDraftResponse:
    """Generate an action item reminder email for a specific owner."""
    try:
        llm = get_llm(AgentTask.FOLLOWUP, temperature=0.1)
        chain = REMINDER_PROMPT | llm | StrOutputParser()

        body = await chain.ainvoke({
            "owner_name": owner_name,
            "task_description": task_description,
            "due_date": due_date,
            "meeting_title": meeting_title,
        })
    except Exception as exc:
        print(f"[FollowUpAgent] ⚠️ API call failed in generate_action_item_reminder: {exc}. Using fallback...")
        body = (
            f"Hi {owner_name},\n\n"
            f"This is a quick reminder regarding the action item assigned to you from the meeting: {meeting_title}.\n\n"
            f"Task: {task_description}\n"
            f"Due date: {due_date}\n\n"
            f"Please let me know if you need any assistance or have any updates on this task.\n\n"
            f"Best regards,\n"
            f"Executive Assistant"
        )

    return ReplyDraftResponse(
        draft_id=str(uuid.uuid4()),
        subject=f"Action Item Reminder: {task_description[:50]}",
        body=body.strip(),
        confidence=0.85,
        approval_status="pending",
    )


async def generate_pending_response_chase(
    subject: str,
    recipient: str,
    sent_date: str,
    days_since: int,
) -> ReplyDraftResponse:
    """Generate a polite follow-up for an unanswered email thread."""
    try:
        llm = get_llm(AgentTask.FOLLOWUP, temperature=0.2)
        chain = CHASE_PROMPT | llm | StrOutputParser()

        body = await chain.ainvoke({
            "subject": subject,
            "recipient": recipient,
            "sent_date": sent_date,
            "days_since": str(days_since),
        })
    except Exception as exc:
        print(f"[FollowUpAgent] ⚠️ API call failed in generate_pending_response_chase: {exc}. Using fallback...")
        body = (
            f"Hi {recipient},\n\n"
            f"I hope you're having a good week. I'm following up on the email sent on {sent_date} regarding '{subject}'.\n\n"
            f"Please let me know if you have any updates or if we need to align on next steps.\n\n"
            f"Best regards,\n"
            f"Executive Assistant"
        )

    return ReplyDraftResponse(
        draft_id=str(uuid.uuid4()),
        subject=f"Following up: {subject}",
        body=body.strip(),
        confidence=0.8,
        approval_status="pending",
    )
