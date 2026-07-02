"""Email Agent API routes.
POST /api/v1/agents/email/ingest   — Classify + extract intent (original pipeline)
POST /api/v1/agents/email/analyze  — Full 6-stage intelligence pipeline
"""
from __future__ import annotations
import uuid
from fastapi import APIRouter, HTTPException, Request

from app.models.schemas import (
    EmailIngestRequest, EmailIngestResponse, ErrorResponse, EmailIntelligenceResult
)
from app.agents.email_agent import classify_email
from app.agents.intent_agent import extract_intent
from app.agents.email_intelligence_agent import analyze_email_intelligence

router = APIRouter()


@router.post("/ingest", response_model=EmailIngestResponse)
async def ingest_email(request: Request, body: EmailIngestRequest):
    """
    Classify an inbound email and extract structured intent entities.
    Original pipeline — returns category, priority, confidence, intent.
    """
    trace_id = getattr(request.state, "trace_id", str(uuid.uuid4()))

    try:
        # Step 1: Classify
        classification = await classify_email(
            sender=body.sender,
            subject=body.subject,
            body=body.body,
        )

        category = classification.get("category", "fyi")
        priority = classification.get("priority", "normal")
        confidence = float(classification.get("confidence", 0.8))

        # Step 2: Extract intent (for meeting requests and action items)
        intent = None
        if category in ("meeting_request", "action_required", "follow_up", "approval_request"):
            raw_intent = await extract_intent(
                category=category,
                sender=body.sender,
                subject=body.subject,
                body=body.body,
            )
            from app.models.schemas import ExtractedIntent
            import dateparser
            meeting_time = None
            raw_time = raw_intent.get("meeting_time_raw_text")
            if raw_time:
                meeting_time = dateparser.parse(raw_time, settings={"PREFER_DATES_FROM": "future"})

            intent = ExtractedIntent(
                type=raw_intent.get("type", category),
                meeting_time=meeting_time,
                meeting_time_raw_text=raw_time,
                agenda=raw_intent.get("agenda"),
                participants=raw_intent.get("participants", []),
                deadlines=raw_intent.get("deadlines", []),
                action_items=raw_intent.get("action_items", []),
                required_preparation=raw_intent.get("required_preparation", []),
                priority=raw_intent.get("priority", priority),
            )

        return EmailIngestResponse(
            email_id=body.message_id,
            category=category,
            priority=priority,
            confidence=confidence,
            intent=intent,
            message="Email processed successfully",
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(
                error_code="EMAIL_AGENT_ERROR",
                message=str(exc),
                trace_id=trace_id,
                retryable=True,
            ).model_dump(),
        )


@router.post("/analyze", response_model=EmailIntelligenceResult)
async def analyze_email(request: Request, body: EmailIngestRequest):
    """
    Full 6-stage Email Intelligence Pipeline:
    Stage 1 — Email Parsing
    Stage 2 — 18-type classification
    Stage 3 — Intelligent entity extraction (meetings, deadlines, action items, attendee escalation)
    Stage 4 — Sender trust & relationship analysis
    Stage 5 — Spam detection (multi-signal)
    Stage 6 — Priority scoring (Urgent / High / Medium / Low / Spam)

    Returns a complete EmailIntelligenceResult with all fields populated.
    """
    trace_id = getattr(request.state, "trace_id", str(uuid.uuid4()))

    try:
        result = await analyze_email_intelligence(
            message_id=body.message_id,
            thread_id=body.thread_id,
            sender=body.sender,
            subject=body.subject,
            body=body.body,
            timestamp=body.received_at.isoformat() if body.received_at else "",
            cc=body.recipients,
        )
        return result

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(
                error_code="EMAIL_INTELLIGENCE_ERROR",
                message=str(exc),
                trace_id=trace_id,
                retryable=True,
            ).model_dump(),
        )
