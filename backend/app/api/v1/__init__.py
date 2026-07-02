"""API v1 router — wires all route modules."""
from fastapi import APIRouter

from app.api.v1.agents import email as email_agent_routes
from app.api.v1.agents import reply as reply_agent_routes
from app.api.v1.agents import meeting_prep as meeting_prep_routes
from app.api.v1.agents import transcript as transcript_routes
from app.api.v1 import action_items, emails, meetings, rag, phase2

router = APIRouter()

# Agent routes (Phase 1)
router.include_router(email_agent_routes.router, prefix="/agents/email", tags=["Agents — Email"])
router.include_router(reply_agent_routes.router, prefix="/agents/reply", tags=["Agents — Reply"])
router.include_router(meeting_prep_routes.router, prefix="/agents/meeting-prep", tags=["Agents — Meeting Prep"])
router.include_router(transcript_routes.router, prefix="/agents/transcript", tags=["Agents — Transcript"])

# Resource routes
router.include_router(emails.router, prefix="/emails", tags=["Emails"])
router.include_router(meetings.router, prefix="/meetings", tags=["Meetings", "Calendar Intelligence"])
router.include_router(action_items.router, prefix="/action-items", tags=["Action Items"])
router.include_router(rag.router, prefix="/rag", tags=["RAG / Knowledge"])

# Phase 2 routes
router.include_router(phase2.router, prefix="", tags=["Phase 2"])
