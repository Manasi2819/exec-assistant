"""Transcript Agent API routes — POST /api/v1/agents/transcript/ingest"""
from fastapi import APIRouter, HTTPException
from app.models.schemas import TranscriptIngestRequest, TranscriptExtractionResult
from app.agents.transcript_agent import extract_from_transcript
from app.memory.faiss_index import store_mom

router = APIRouter()


@router.post("/ingest", response_model=TranscriptExtractionResult)
async def ingest_transcript(body: TranscriptIngestRequest):
    """
    Process a meeting transcript from Teams/Zoom/Google Meet.
    Extracts decisions, risks, and action items with owner + due date attribution.
    """
    try:
        result = await extract_from_transcript(
            transcript_text=body.transcript_text,
            participants=body.participants,
            meeting_id=body.meeting_id,
        )
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
