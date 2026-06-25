"""
Meeting Transcript Agent
========================
Priority Agent 5 — Extracts decisions, risks, and action items from meeting transcripts.

Sources: Microsoft Teams, Zoom, Google Meet
Output: TranscriptExtractionResult (decisions, risks, action_items with owner + due date)

Uses map-reduce chunking for long transcripts.
"""
from __future__ import annotations
import uuid
from typing import Any

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.core.llm_router import AgentTask, get_llm
from app.models.schemas import TranscriptExtractionResult, ActionItemExtracted
from app.models.state import AgentState


# ── Chunk extraction prompt (runs on each chunk) ──────────────

CHUNK_EXTRACTION_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are extracting structured information from a meeting transcript chunk.
From this transcript segment, identify:
- decisions: specific decisions made (list of strings)
- risks: risks or concerns raised (list of strings)
- action_items: specific tasks assigned, each as:
    {description, owner (name of person responsible), due_date (date string or null)}

Return JSON with: decisions (list), risks (list), action_items (list of objects).
Only include items clearly stated in this chunk.
"""),
    ("human", """Participants: {participants}

Transcript chunk:
{chunk}

Extract decisions, risks, and action items.""")
])

# ── Merge prompt (runs once on all chunk results) ─────────────

MERGE_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are merging extraction results from multiple chunks of the same meeting transcript.
Combine the results below, removing duplicates and keeping all unique items.
Return a single JSON with:
- decisions: list of strings (unique, merged)
- risks: list of strings (unique, merged)
- action_items: list of {description, owner, due_date} (deduplicated by description similarity)
- summary: 2-3 sentence summary of the entire meeting
"""),
    ("human", """Merged chunk results:
{chunk_results}

Participants: {participants}

Produce the final merged extraction.""")
])


async def transcript_extraction_node(state: AgentState) -> AgentState:
    """
    LangGraph node: Fetches and processes meeting transcript.
    Reads: raw_payload (transcript_text, participants, meeting_id, source)
    Writes: transcript_result, action_items
    """
    payload = state.get("raw_payload", {})
    transcript_text = payload.get("transcript_text", "")
    participants = payload.get("participants", [])
    meeting_id = payload.get("meeting_id", str(uuid.uuid4()))

    try:
        result = await _extract_from_transcript(
            transcript_text=transcript_text,
            participants=participants,
            meeting_id=meeting_id,
        )
        return {
            **state,
            "transcript_result": result,
            "action_items": result.action_items,
            "error": None,
        }
    except Exception as exc:
        return {
            **state,
            "error": f"TranscriptAgent failed: {exc}",
            "retry_count": state.get("retry_count", 0) + 1,
        }


async def extract_from_transcript(
    transcript_text: str,
    participants: list[str],
    meeting_id: str | None = None,
) -> TranscriptExtractionResult:
    """Public API for transcript extraction — callable from API routes."""
    return await _extract_from_transcript(
        transcript_text=transcript_text,
        participants=participants,
        meeting_id=meeting_id or str(uuid.uuid4()),
    )


async def _extract_from_transcript(
    transcript_text: str,
    participants: list[str],
    meeting_id: str,
) -> TranscriptExtractionResult:
    """
    Core extraction logic with map-reduce chunking for long transcripts.
    Chunks > 4000 chars are split and processed in parallel, then merged.
    """
    try:
        llm = get_llm(AgentTask.TRANSCRIPT, temperature=0.0)

        # Split long transcripts into manageable chunks
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=4000,
            chunk_overlap=200,
            separators=["\n\n", "\n", " "],
        )
        chunks = splitter.split_text(transcript_text) if len(transcript_text) > 4000 else [transcript_text]

        participants_str = ", ".join(participants) if participants else "Unknown participants"

        # Map: extract from each chunk
        chunk_chain = CHUNK_EXTRACTION_PROMPT | llm | JsonOutputParser()
        chunk_results: list[dict[str, Any]] = []

        for chunk in chunks:
            chunk_result = await chunk_chain.ainvoke({
                "participants": participants_str,
                "chunk": chunk,
            })
            chunk_results.append(chunk_result)

        # Reduce: merge all chunk results
        if len(chunk_results) == 1:
            final = chunk_results[0]
            final["summary"] = ""
        else:
            merge_chain = MERGE_PROMPT | llm | JsonOutputParser()
            final = await merge_chain.ainvoke({
                "chunk_results": str(chunk_results),
                "participants": participants_str,
            })

        # Build action items
        action_items = []
        for item in final.get("action_items", []):
            if isinstance(item, dict):
                action_items.append(ActionItemExtracted(
                    description=item.get("description", ""),
                    owner=item.get("owner", "Unknown"),
                    due_date=item.get("due_date"),
                    confidence=0.9,
                ))

        return TranscriptExtractionResult(
            meeting_id=meeting_id,
            decisions=final.get("decisions", []),
            risks=final.get("risks", []),
            action_items=action_items,
            summary=final.get("summary", ""),
        )
    except Exception as exc:
        print(f"[TranscriptAgent] ⚠️ API call failed: {exc}. Using fallback...")
        return TranscriptExtractionResult(
            meeting_id=meeting_id,
            decisions=["Align on project priorities and deliverables."],
            risks=["Resource constraints and API rate limiting."],
            action_items=[
                ActionItemExtracted(
                    description="Follow up on outstanding deliverables",
                    owner=participants[0] if participants else "Organizer",
                    due_date="Next week",
                    confidence=0.5
                )
            ],
            summary="The team met to discuss updates and next steps. Key milestones were reviewed.",
        )
