"""
AgentState — The shared LangGraph state object.
Passed between all nodes in the supervisor graph and checkpointed after every node.
"""
from __future__ import annotations
from typing import Any, Literal, Optional, TypedDict

from app.models.schemas import (
    ExtractedIntent,
    CalendarProcessResponse,
    MeetingBriefResponse,
    ReplyDraftResponse,
    TranscriptExtractionResult,
    MoMResponse,
    ActionItemExtracted,
    EmailIntelligenceResult,
)


class AgentState(TypedDict, total=False):
    # ── Identity / routing ────────────────────────────────────
    tenant_id: str
    user_id: str
    trace_id: str                   # propagated through all downstream calls and logs
    trigger_type: Literal[
        "email", "calendar_event", "transcript_ready",
        "scheduled_reminder", "user_query"
    ]
    raw_payload: dict[str, Any]

    # ── Email pipeline ────────────────────────────────────────
    email_id: Optional[str]
    email_category: Optional[str]
    email_priority: Optional[str]
    email_confidence: Optional[float]
    intent: Optional[ExtractedIntent]

    # ── Full Email Intelligence pipeline output ───────────────
    email_intelligence: Optional[EmailIntelligenceResult]

    # ── Calendar pipeline ─────────────────────────────────────
    calendar_result: Optional[CalendarProcessResponse]

    # ── Meeting preparation ───────────────────────────────────
    meeting_brief: Optional[MeetingBriefResponse]

    # ── Reply draft ───────────────────────────────────────────
    reply_draft: Optional[ReplyDraftResponse]

    # ── Transcript pipeline ───────────────────────────────────
    transcript_result: Optional[TranscriptExtractionResult]

    # ── MoM pipeline ─────────────────────────────────────────
    mom: Optional[MoMResponse]

    # ── Action items ──────────────────────────────────────────
    action_items: list[ActionItemExtracted]

    # ── Human approval gate ───────────────────────────────────
    requires_human_approval: bool
    approval_status: Optional[Literal["pending", "approved", "rejected", "edited"]]

    # ── Error handling ────────────────────────────────────────
    error: Optional[str]
    retry_count: int

    # ── RAG context ───────────────────────────────────────────
    rag_context: Optional[str]
