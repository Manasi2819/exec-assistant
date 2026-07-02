from __future__ import annotations
from datetime import datetime
from typing import Optional, Literal
from uuid import UUID

from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────
# Email Type Enum (18 types per spec)
# ─────────────────────────────────────────────────────────────

EmailType = Literal[
    "meeting_request", "follow_up", "action_required", "approval_request",
    "escalation", "client_query", "internal_update", "daily_project_update",
    "weekly_report", "fyi", "reminder", "invoice_finance", "hr_communication",
    "security_notification", "system_alert", "newsletter", "marketing_email", "spam",
]

PriorityLevel = Literal["urgent", "high", "medium", "low", "spam"]

OrgType = Literal[
    "internal", "client", "vendor", "partner", "recruiter",
    "government", "unknown", "personal_email",
]

DomainTrust = Literal["trusted", "known_client", "known_vendor", "personal", "unknown", "suspicious"]

RelationshipStrength = Literal[
    "ceo", "direct_manager", "client", "reporting_manager",
    "frequent_collaborator", "vendor", "unknown", "never_contacted",
]

NewSenderCategory = Literal[
    "potential_client", "business_opportunity", "recruiter", "partner",
    "vendor", "spam", "cold_marketing", "fraud_attempt", "unknown_but_important",
]


# ─────────────────────────────────────────────────────────────
# Email / Intent schemas
# ─────────────────────────────────────────────────────────────

class ExtractedIntent(BaseModel):
    """Structured output from the Intent Extraction Agent.
    Matches the JSON format specified in the lead's project brief.
    """
    type: Literal[
        "meeting_request", "follow_up", "action_required",
        "fyi", "escalation", "approval_request"
    ]
    meeting_time: Optional[datetime] = None
    meeting_time_raw_text: Optional[str] = None   # original phrase (e.g. "tomorrow at 3 PM")
    agenda: Optional[str] = None
    participants: list[str] = Field(default_factory=list)
    deadlines: list[str] = Field(default_factory=list)
    action_items: list[str] = Field(default_factory=list)
    required_preparation: list[str] = Field(default_factory=list)
    priority: Literal["low", "normal", "high", "urgent"] = "normal"
    confidence: float = Field(ge=0.0, le=1.0, default=1.0)


class SenderProfile(BaseModel):
    """Stage 4 — Sender trust & relationship analysis output."""
    org_type: OrgType = "unknown"
    domain: str = ""
    domain_trust: DomainTrust = "unknown"
    relationship_strength: RelationshipStrength = "unknown"
    is_new_sender: bool = False
    interaction_count: int = 0
    last_interaction_days_ago: int = 999
    new_sender_category: Optional[NewSenderCategory] = None
    trust_score: float = Field(ge=0.0, le=1.0, default=0.5)


class ExtractedEntities(BaseModel):
    """Stage 3 — Structured entities extracted from the email body."""
    meeting_date: Optional[str] = None
    meeting_time: Optional[str] = None
    meeting_link: Optional[str] = None
    agenda: Optional[str] = None
    participants: list[str] = Field(default_factory=list)
    location: Optional[str] = None
    preparation_required: list[str] = Field(default_factory=list)
    documents_to_review: list[str] = Field(default_factory=list)
    deadlines: list[str] = Field(default_factory=list)
    action_items: list[str] = Field(default_factory=list)
    approvals_required: list[str] = Field(default_factory=list)
    project_name: Optional[str] = None
    client_name: Optional[str] = None
    departments_involved: list[str] = Field(default_factory=list)
    risk_level: Optional[Literal["low", "medium", "high", "critical"]] = None
    # ── Attendee escalation (client requests executive specifically in meeting) ───
    attendee_requested: bool = False
    attendee_requested_by: Optional[str] = None
    attendee_meeting_time: Optional[str] = None
    delegate_suggestions: list[str] = Field(default_factory=list)


class EmailIntelligenceResult(BaseModel):
    """Single unified output from the full 6-stage email intelligence pipeline."""
    email_id: str
    email_type: EmailType = "fyi"
    sender_profile: SenderProfile = Field(default_factory=SenderProfile)
    entities: ExtractedEntities = Field(default_factory=ExtractedEntities)
    is_spam: bool = False
    spam_signals: list[str] = Field(default_factory=list)
    priority_level: PriorityLevel = "medium"
    priority_score: float = Field(ge=0.0, le=100.0, default=50.0)
    priority_reasoning: str = ""
    one_line_summary: str = ""
    confidence: float = Field(ge=0.0, le=1.0, default=0.8)
    thread_id: str = ""
    thread_group_key: Optional[str] = None


class EmailThread(BaseModel):
    """A grouped card for recurring daily/weekly project update threads."""
    thread_group_key: str
    project_name: str
    thread_subject_pattern: str
    email_count: int
    last_updated: datetime
    participant_list: list[str] = Field(default_factory=list)
    overall_status: Literal["on_track", "at_risk", "blocked", "completed"] = "on_track"
    completed_items: list[str] = Field(default_factory=list)
    pending_items: list[str] = Field(default_factory=list)
    blockers: list[str] = Field(default_factory=list)
    executive_summary: str = ""
    has_attendee_request: bool = False
    attendee_request_details: Optional[str] = None
    priority_level: PriorityLevel = "medium"
    email_ids: list[str] = Field(default_factory=list)


class EmailIngestRequest(BaseModel):
    """Raw email payload sent to POST /api/v1/agents/email/ingest"""
    message_id: str
    thread_id: str
    sender: str
    recipients: list[str]
    subject: str
    body: str
    received_at: datetime
    source: Literal["gmail", "outlook"] = "gmail"
    tenant_id: Optional[str] = None
    user_id: Optional[str] = None


class EmailIngestResponse(BaseModel):
    email_id: str
    category: str
    priority: str
    confidence: float
    intent: Optional[ExtractedIntent] = None
    intelligence: Optional[EmailIntelligenceResult] = None
    message: str = "Email processed successfully"


# ─────────────────────────────────────────────────────────────
# Calendar schemas
# ─────────────────────────────────────────────────────────────

class CalendarSlot(BaseModel):
    start: datetime
    end: datetime
    available: bool
    conflict_reason: Optional[str] = None


class CalendarProcessRequest(BaseModel):
    intent: ExtractedIntent
    organizer_user_id: str
    preferred_duration_minutes: int = 60
    calendar_sources: list[Literal["google", "outlook", "teams"]] = Field(
        default_factory=lambda: ["google", "outlook", "teams"]
    )


class CalendarProcessResponse(BaseModel):
    event_id: Optional[str] = None
    proposed_slots: list[CalendarSlot] = Field(default_factory=list)
    conflict_detected: bool = False
    conflict_explanation: Optional[str] = None
    reminder_scheduled: bool = False
    status: Literal["created", "proposed", "conflict"] = "proposed"


# ─────────────────────────────────────────────────────────────
# Meeting Preparation schemas
# ─────────────────────────────────────────────────────────────

class DecisionRef(BaseModel):
    decision_text: str
    meeting_date: Optional[str] = None
    meeting_title: Optional[str] = None


class MeetingBriefResponse(BaseModel):
    """Pre-meeting brief — matches the lead's example output format."""
    meeting_id: str
    meeting_title: str
    purpose: str
    important_topics: list[str] = Field(default_factory=list)
    previous_decisions: list[DecisionRef] = Field(default_factory=list)
    potential_questions: list[str] = Field(default_factory=list)
    recommended_preparation: list[str] = Field(default_factory=list)
    participants: list[str] = Field(default_factory=list)
    generated_at: datetime = Field(default_factory=datetime.utcnow)


# ─────────────────────────────────────────────────────────────
# Reply Draft schemas
# ─────────────────────────────────────────────────────────────

class ReplyDraftRequest(BaseModel):
    email_id: str
    thread_context: list[str] = Field(default_factory=list)
    user_name: str = "User"


class ReplyDraftResponse(BaseModel):
    draft_id: str
    subject: str
    body: str
    confidence: float = Field(ge=0.0, le=1.0)
    approval_status: Literal["pending", "approved", "rejected", "edited"] = "pending"


class DraftApprovalRequest(BaseModel):
    action: Literal["approve", "reject", "edit"]
    edited_body: Optional[str] = None  # only required when action == "edit"


# ─────────────────────────────────────────────────────────────
# Transcript / MoM schemas
# ─────────────────────────────────────────────────────────────

class ActionItemExtracted(BaseModel):
    description: str
    owner: str
    due_date: Optional[str] = None
    confidence: float = Field(ge=0.0, le=1.0, default=1.0)


class TranscriptIngestRequest(BaseModel):
    meeting_id: str
    transcript_text: str
    source: Literal["teams", "zoom", "google_meet"]
    participants: list[str] = Field(default_factory=list)


class TranscriptExtractionResult(BaseModel):
    meeting_id: str
    decisions: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    action_items: list[ActionItemExtracted] = Field(default_factory=list)
    summary: str = ""


class MoMResponse(BaseModel):
    mom_id: str
    meeting_title: str
    meeting_date: str
    attendees: list[str]
    discussion_summary: str
    decisions: list[str]
    action_items: list[ActionItemExtracted]
    approval_status: Literal["pending", "approved", "sent"] = "pending"
    generated_at: datetime = Field(default_factory=datetime.utcnow)


# ─────────────────────────────────────────────────────────────
# Action Item schemas
# ─────────────────────────────────────────────────────────────

class ActionItemCreate(BaseModel):
    description: str
    owner_name: str
    due_date: Optional[str] = None
    source_meeting_id: Optional[str] = None
    source_email_id: Optional[str] = None
    priority: Literal["low", "normal", "high", "urgent"] = "normal"


class ActionItemUpdate(BaseModel):
    status: Optional[Literal["pending", "in_progress", "done", "blocked", "overdue"]] = None
    due_date: Optional[str] = None


class ActionItemResponse(BaseModel):
    id: str
    description: str
    owner_name: str
    due_date: Optional[str]
    status: Literal["pending", "in_progress", "done", "blocked", "overdue"]
    priority: str
    source_meeting_id: Optional[str]
    source_email_id: Optional[str]
    created_at: datetime


# ─────────────────────────────────────────────────────────────
# RAG Query schema
# ─────────────────────────────────────────────────────────────

class RAGQueryRequest(BaseModel):
    query: str
    filters: dict = Field(default_factory=dict)
    top_k: int = Field(default=5, ge=1, le=20)


class RAGQueryResponse(BaseModel):
    answer: str
    sources: list[dict] = Field(default_factory=list)
    query: str


# ─────────────────────────────────────────────────────────────
# Common error response
# ─────────────────────────────────────────────────────────────

class ErrorResponse(BaseModel):
    error_code: str
    message: str
    trace_id: str
    retryable: bool = False
