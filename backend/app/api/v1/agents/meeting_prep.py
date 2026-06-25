"""Meeting Prep Agent API routes — POST /api/v1/agents/meeting-prep/generate"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from app.models.schemas import MeetingBriefResponse
from app.agents.meeting_prep_agent import generate_meeting_brief
from app.memory.faiss_index import retrieve_context
import uuid

router = APIRouter()


class MeetingPrepRequest(BaseModel):
    meeting_id: str | None = None
    meeting_title: str
    participants: list[str] = []
    meeting_datetime: str
    calendar_description: str = ""
    email_context: str = ""
    tenant_id: str = "default"


@router.post("/generate", response_model=MeetingBriefResponse)
async def generate_brief(request: Request, body: MeetingPrepRequest):
    """Generate a pre-meeting brief using meeting context + FAISS-retrieved prior decisions."""
    try:
        # Retrieve prior context from FAISS
        prior_context = await retrieve_context(
            query=f"{body.meeting_title} {body.calendar_description}",
            tenant_id=body.tenant_id,
            top_k=5,
        )

        brief = await generate_meeting_brief(
            meeting_title=body.meeting_title,
            participants=body.participants,
            meeting_datetime=body.meeting_datetime,
            calendar_description=body.calendar_description,
            email_context=body.email_context,
            prior_context=prior_context,
            meeting_id=body.meeting_id,
        )
        return brief

    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/{meeting_id}/brief", response_model=MeetingBriefResponse)
async def get_brief(meeting_id: str):
    """Placeholder — will return brief from DB in Phase 2."""
    raise HTTPException(status_code=404, detail="Brief not yet generated for this meeting")
