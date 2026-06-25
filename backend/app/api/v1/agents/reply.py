"""Reply Agent API routes — POST /api/v1/agents/reply/draft"""
from fastapi import APIRouter, HTTPException, Request
from app.models.schemas import ReplyDraftRequest, ReplyDraftResponse, DraftApprovalRequest
from app.agents.reply_agent import draft_reply
import uuid

router = APIRouter()

# In-memory store for drafts (replace with DB in production)
_drafts: dict[str, ReplyDraftResponse] = {}


@router.post("/draft", response_model=ReplyDraftResponse)
async def create_draft(request: Request, body: ReplyDraftRequest):
    """Draft a reply for the given email. Returns pending draft awaiting human approval."""
    draft = await draft_reply(
        sender="",
        subject=f"Re: email {body.email_id}",
        email_body="\n".join(body.thread_context),
        user_name=body.user_name,
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
