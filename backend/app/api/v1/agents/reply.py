"""Reply Agent API routes — POST /api/v1/agents/reply/draft"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from app.models.schemas import ReplyDraftRequest, ReplyDraftResponse, DraftApprovalRequest
from app.agents.reply_agent import draft_reply
import uuid

router = APIRouter()

# In-memory store for drafts (replace with DB in production)
_drafts: dict[str, ReplyDraftResponse] = {}


class EnrichedReplyRequest(BaseModel):
    """Enhanced reply request with email intelligence context."""
    email_id: str
    thread_context: list[str] = []
    user_name: str = "Executive"
    # Optional enriched context from email intelligence pipeline
    email_type: Optional[str] = None
    sender: Optional[str] = None
    subject: Optional[str] = None
    sender_relationship: Optional[str] = None
    priority_level: Optional[str] = None
    attendee_requested: Optional[bool] = False
    delegate_name: Optional[str] = None
    thread_history: Optional[str] = None
    rag_context: Optional[str] = None


@router.post("/draft", response_model=ReplyDraftResponse)
async def create_draft(request: Request, body: EnrichedReplyRequest):
    """
    Draft a context-aware reply for the given email.
    Uses email type, sender relationship, and attendee status to generate
    a tailored reply. Returns pending draft awaiting human approval.
    """
    email_body = "\n".join(body.thread_context)

    draft = await draft_reply(
        sender=body.sender or "",
        subject=body.subject or f"Re: email {body.email_id}",
        email_body=email_body,
        user_name=body.user_name,
        rag_context=body.rag_context or "",
        email_type=body.email_type or "fyi",
        sender_relationship=body.sender_relationship or "unknown",
        priority_level=body.priority_level or "medium",
        attendee_requested=body.attendee_requested or False,
        delegate_name=body.delegate_name or "",
        thread_history=body.thread_history or "",
    )
    _drafts[draft.draft_id] = draft
    return draft


@router.post("/{draft_id}/approve", response_model=ReplyDraftResponse)
async def approve_draft(draft_id: str, body: DraftApprovalRequest):
    """Approve, edit, or reject a draft reply."""
    draft = _drafts.get(draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    if body.action == "approve":
        draft.approval_status = "approved"
    elif body.action == "reject":
        draft.approval_status = "rejected"
    elif body.action == "edit":
        if body.edited_body:
            draft.body = body.edited_body
        draft.approval_status = "edited"

    _drafts[draft_id] = draft
    return draft


@router.get("/{draft_id}", response_model=ReplyDraftResponse)
async def get_draft(draft_id: str):
    draft = _drafts.get(draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    return draft
