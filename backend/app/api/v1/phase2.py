"""
Phase 2 API routes — MoM, Follow-Up, Task Tracking, Webhooks, Pipeline trigger
"""
from fastapi import APIRouter, HTTPException, Request, Header
from pydantic import BaseModel
from typing import Optional
import uuid

from app.models.schemas import (
    MoMResponse, TranscriptIngestRequest, TranscriptExtractionResult,
    ReplyDraftResponse, DraftApprovalRequest,
    ActionItemCreate, ActionItemUpdate, ActionItemResponse,
)
from app.agents.mom_agent import generate_mom
from app.agents.followup_agent import generate_post_meeting_followup, generate_action_item_reminder, generate_pending_response_chase
from app.agents.task_agent import scan_overdue_tasks, infer_completion, check_duplicate
from app.agents.transcript_agent import extract_from_transcript
from app.agents.supervisor import run_pipeline, resume_pipeline
from datetime import datetime

router = APIRouter()

# ── In-memory MoM store (replace with DB in full deployment) ──
_moms: dict[str, MoMResponse] = {}
_followup_drafts: dict[str, ReplyDraftResponse] = {}
_tasks: dict[str, dict] = {}


# ────────────────────────────────────────────────────────────
# MoM Routes
# ────────────────────────────────────────────────────────────

class MoMGenerateRequest(BaseModel):
    meeting_id: str
    meeting_title: str
    meeting_date: str
    attendees: list[str]
    transcript_text: str
    participants: list[str] = []
    source: str = "teams"


@router.post("/mom/generate", response_model=MoMResponse, tags=["MoM"])
async def generate_mom_endpoint(body: MoMGenerateRequest):
    """
    Generate Minutes of Meeting from a transcript.
    Step 1: Extract decisions/risks/action items from transcript.
    Step 2: Generate formal MoM narrative. Returns pending approval.
    """
    transcript_result = await extract_from_transcript(
        transcript_text=body.transcript_text,
        participants=body.participants or body.attendees,
        meeting_id=body.meeting_id,
    )
    mom = await generate_mom(
        transcript_result=transcript_result,
        meeting_title=body.meeting_title,
        meeting_date=body.meeting_date,
        attendees=body.attendees,
    )
    _moms[mom.mom_id] = mom
    return mom


@router.get("/mom/{mom_id}", response_model=MoMResponse, tags=["MoM"])
async def get_mom(mom_id: str):
    mom = _moms.get(mom_id)
    if not mom:
        raise HTTPException(404, "MoM not found")
    return mom


@router.post("/mom/{mom_id}/approve", response_model=MoMResponse, tags=["MoM"])
async def approve_mom(mom_id: str, body: DraftApprovalRequest):
    """Approve or reject a MoM. On approval, triggers follow-up draft."""
    mom = _moms.get(mom_id)
    if not mom:
        raise HTTPException(404, "MoM not found")
    if body.action == "approve":
        mom.approval_status = "approved"
    elif body.action == "reject":
        mom.approval_status = "sent"  # Use "sent" as rejected signal
    _moms[mom_id] = mom
    return mom


@router.get("/mom", response_model=list[MoMResponse], tags=["MoM"])
async def list_moms():
    return list(_moms.values())


# ────────────────────────────────────────────────────────────
# Follow-Up Routes
# ────────────────────────────────────────────────────────────

class FollowUpRequest(BaseModel):
    mom_id: str
    sender_name: str = "User"


class ActionReminderRequest(BaseModel):
    owner_name: str
    task_description: str
    due_date: str
    meeting_title: str


class ChaseRequest(BaseModel):
    subject: str
    recipient: str
    sent_date: str
    days_since: int


@router.post("/followup/post-meeting", response_model=ReplyDraftResponse, tags=["Follow-Up"])
async def generate_followup(body: FollowUpRequest):
    """Generate a post-meeting follow-up email from an approved MoM."""
    mom = _moms.get(body.mom_id)
    if not mom:
        raise HTTPException(404, "MoM not found — approve a MoM first")
    if mom.approval_status != "approved":
        raise HTTPException(400, "MoM must be approved before generating follow-up")
    draft = await generate_post_meeting_followup(mom=mom, sender_name=body.sender_name)
    _followup_drafts[draft.draft_id] = draft
    return draft


@router.post("/followup/action-reminder", response_model=ReplyDraftResponse, tags=["Follow-Up"])
async def action_reminder(body: ActionReminderRequest):
    draft = await generate_action_item_reminder(**body.model_dump())
    _followup_drafts[draft.draft_id] = draft
    return draft


@router.post("/followup/chase", response_model=ReplyDraftResponse, tags=["Follow-Up"])
async def chase_pending(body: ChaseRequest):
    draft = await generate_pending_response_chase(**body.model_dump())
    _followup_drafts[draft.draft_id] = draft
    return draft


# ────────────────────────────────────────────────────────────
# Task Tracking Routes (enhanced)
# ────────────────────────────────────────────────────────────

class TaskBulkRequest(BaseModel):
    tasks: list[dict]


class CompletionInferRequest(BaseModel):
    context: str
    open_task_ids: list[str] = []


class DedupRequest(BaseModel):
    description: str
    existing_task_ids: list[str] = []


@router.post("/tasks/scan-overdue", tags=["Tasks"])
async def scan_overdue(body: TaskBulkRequest):
    """Flag overdue tasks based on current date vs due_date."""
    updated = await scan_overdue_tasks(body.tasks)
    return {"tasks": updated, "overdue_count": sum(1 for t in updated if t.get("status") == "overdue")}


@router.post("/tasks/infer-completion", tags=["Tasks"])
async def infer_task_completion(body: CompletionInferRequest):
    """Analyze email/transcript text to infer which tasks are completed."""
    open_tasks = [_tasks[tid] for tid in body.open_task_ids if tid in _tasks]
    result = await infer_completion(context=body.context, open_tasks=open_tasks)
    return result


@router.post("/tasks/check-duplicate", tags=["Tasks"])
async def check_task_duplicate(body: DedupRequest):
    """Check if a new action item description is a duplicate of existing ones."""
    existing = [_tasks[tid] for tid in body.existing_task_ids if tid in _tasks]
    result = await check_duplicate(new_item_description=body.description, existing_items=existing)
    return result


# ────────────────────────────────────────────────────────────
# Pipeline Trigger (orchestrator entry point)
# ────────────────────────────────────────────────────────────

class PipelineTriggerRequest(BaseModel):
    trigger_type: str  # email | transcript_ready | scheduled_reminder | user_query
    payload: dict
    thread_id: Optional[str] = None


class PipelineResumeRequest(BaseModel):
    approval_status: str  # approved | rejected | edited
    edited_body: Optional[str] = None


@router.post("/pipeline/trigger", tags=["Pipeline"])
async def trigger_pipeline(body: PipelineTriggerRequest):
    """
    Trigger the full LangGraph agent pipeline.
    Returns the final state including all agent outputs.
    """
    try:
        state = await run_pipeline(
            trigger_type=body.trigger_type,
            payload=body.payload,
            thread_id=body.thread_id,
        )
        return {
            "thread_id": body.thread_id,
            "trigger_type": body.trigger_type,
            "email_category": state.get("email_category"),
            "email_priority": state.get("email_priority"),
            "intent": state.get("intent").model_dump() if state.get("intent") else None,
            "calendar_result": state.get("calendar_result").model_dump() if state.get("calendar_result") else None,
            "reply_draft": state.get("reply_draft").model_dump() if state.get("reply_draft") else None,
            "meeting_brief": state.get("meeting_brief").model_dump() if state.get("meeting_brief") else None,
            "transcript_result": state.get("transcript_result").model_dump() if state.get("transcript_result") else None,
            "mom": state.get("mom").model_dump() if state.get("mom") else None,
            "requires_human_approval": state.get("requires_human_approval", False),
            "approval_status": state.get("approval_status"),
            "error": state.get("error"),
        }
    except Exception as exc:
        raise HTTPException(500, detail=str(exc))


@router.post("/pipeline/{thread_id}/resume", tags=["Pipeline"])
async def resume_pipeline_endpoint(thread_id: str, body: PipelineResumeRequest):
    """Resume a paused pipeline after human approval decision."""
    try:
        decision = {"approval_status": body.approval_status}
        if body.edited_body:
            decision["reply_draft_update"] = {"body": body.edited_body}
        state = await resume_pipeline(thread_id=thread_id, human_decision=decision)
        return {"thread_id": thread_id, "status": "resumed", "approval_status": state.get("approval_status")}
    except Exception as exc:
        raise HTTPException(500, detail=str(exc))


# ────────────────────────────────────────────────────────────
# Webhooks (Integrations inbound)
# ────────────────────────────────────────────────────────────

@router.post("/webhooks/gmail", tags=["Webhooks"])
async def gmail_webhook(request: Request):
    """Handle Gmail Pub/Sub push notifications."""
    import base64, json as _json
    body = await request.json()
    message = body.get("message", {})
    data = base64.b64decode(message.get("data", "")).decode()
    notification = _json.loads(data)
    history_id = notification.get("historyId")
    # Trigger email pipeline
    await run_pipeline("email", {"history_id": history_id, "source": "gmail"})
    return {"status": "ok"}


@router.post("/webhooks/outlook", tags=["Webhooks"])
async def outlook_webhook(request: Request, validation_token: str | None = None):
    """Handle MS Graph subscription webhook. Also handles validation handshake."""
    if validation_token:
        # MS Graph sends this to verify the webhook endpoint
        from fastapi.responses import PlainTextResponse
        return PlainTextResponse(content=validation_token)
    body = await request.json()
    for notification in body.get("value", []):
        resource = notification.get("resource", "")
        await run_pipeline("email", {"resource": resource, "source": "outlook"})
    return {"status": "ok"}


@router.post("/webhooks/zoom", tags=["Webhooks"])
async def zoom_webhook(request: Request, authorization: str = Header(None)):
    """Handle Zoom recording.completed webhook."""
    from app.integrations.zoom_client import verify_zoom_webhook, parse_vtt_transcript
    from app.core.config import get_settings
    settings = get_settings()
    body_bytes = await request.body()
    headers = dict(request.headers)
    timestamp = headers.get("x-zm-request-timestamp", "0")
    signature = headers.get("x-zm-signature", "")
    if settings.zoom_webhook_secret_token and not verify_zoom_webhook(body_bytes, signature, timestamp, settings.zoom_webhook_secret_token):
        raise HTTPException(401, "Invalid Zoom webhook signature")
    payload = await request.json()
    if payload.get("event") == "recording.completed":
        meeting = payload.get("payload", {}).get("object", {})
        meeting_id = str(meeting.get("id", ""))
        topic = meeting.get("topic", "Zoom Meeting")
        await run_pipeline("transcript_ready", {"meeting_id": meeting_id, "meeting_title": topic, "source": "zoom"})
    return {"status": "ok"}


@router.post("/webhooks/slack", tags=["Webhooks"])
async def slack_webhook(request: Request):
    """Handle Slack interactive button presses (approve/edit/reject)."""
    from urllib.parse import parse_qs
    from app.integrations.slack_client import verify_slack_signature
    from app.core.config import get_settings
    settings = get_settings()
    body_bytes = await request.body()
    headers = dict(request.headers)
    timestamp = headers.get("x-slack-request-timestamp", "0")
    signature = headers.get("x-slack-signature", "")
    if settings.slack_signing_secret and not verify_slack_signature(body_bytes, timestamp, signature, settings.slack_signing_secret):
        raise HTTPException(401, "Invalid Slack signature")
    form = parse_qs(body_bytes.decode())
    payload_str = form.get("payload", ["{}"])[0]
    import json as _json
    payload = _json.loads(payload_str)
    actions = payload.get("actions", [])
    for action in actions:
        action_id = action.get("action_id", "")
        draft_id = action.get("value", "")
        if "approve" in action_id:
            await resume_pipeline(draft_id, {"approval_status": "approved"})
        elif "reject" in action_id:
            await resume_pipeline(draft_id, {"approval_status": "rejected"})
    return {"status": "ok"}
