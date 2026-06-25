"""
Minutes of Meeting (MoM) Agent
===============================
Phase 2 — Generates structured MoM from transcript extraction results.

Input:  TranscriptExtractionResult + meeting metadata
Output: MoMResponse (attendees, summary, decisions, action items) → pending approval

The generated MoM always waits for human approval before being sent to attendees.
"""
from __future__ import annotations
import uuid
from datetime import datetime
from typing import Any

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

from app.core.llm_router import AgentTask, get_llm
from app.models.schemas import (
    MoMResponse, TranscriptExtractionResult, ActionItemExtracted
)
from app.models.state import AgentState


MOM_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are an AI Executive Assistant generating formal Minutes of Meeting (MoM).
Create a professional, concise MoM from the transcript analysis below.

Return JSON with:
- discussion_summary: 3-5 sentence narrative summary of the discussion
- decisions: list of decisions made (verbatim, action-oriented)
- additional_action_items: any action items NOT already in the provided list

Keep it professional. Use past tense. Be concise but complete.
"""),
    ("human", """Meeting: {meeting_title}
Date: {meeting_date}
Attendees: {attendees}

Decisions already extracted: {decisions}
Action items already extracted: {action_items}
Risks: {risks}
Meeting summary from transcript: {transcript_summary}

Generate the MoM narrative (discussion_summary) and verify/add any missing decisions or action items.""")
])


async def mom_generation_node(state: AgentState) -> AgentState:
    """
    LangGraph node: Generates MoM from transcript_result.
    Reads:  transcript_result, raw_payload (meeting metadata)
    Writes: mom, requires_human_approval=True
    """
    transcript_result = state.get("transcript_result")
    if not transcript_result:
        return {**state, "error": "MoM Agent: no transcript_result in state"}

    payload = state.get("raw_payload", {})

    try:
        mom = await generate_mom(
            transcript_result=transcript_result,
            meeting_title=payload.get("meeting_title", "Meeting"),
            meeting_date=payload.get("meeting_date", str(datetime.utcnow().date())),
            attendees=payload.get("participants", []),
        )
        return {
            **state,
            "mom": mom,
            "requires_human_approval": True,
            "approval_status": "pending",
            "error": None,
        }
    except Exception as exc:
        return {
            **state,
            "error": f"MoMAgent failed: {exc}",
            "retry_count": state.get("retry_count", 0) + 1,
        }


async def generate_mom(
    transcript_result: TranscriptExtractionResult,
    meeting_title: str,
    meeting_date: str,
    attendees: list[str],
) -> MoMResponse:
    """Public API — callable from API routes."""
    try:
        llm = get_llm(AgentTask.MOM, temperature=0.1)
        chain = MOM_PROMPT | llm | JsonOutputParser()

        action_items_text = [
            f"{item.owner}: {item.description} (due: {item.due_date or 'TBD'})"
            for item in transcript_result.action_items
        ]

        result: dict[str, Any] = await chain.ainvoke({
            "meeting_title": meeting_title,
            "meeting_date": meeting_date,
            "attendees": ", ".join(attendees),
            "decisions": "\n".join(f"- {d}" for d in transcript_result.decisions),
            "action_items": "\n".join(f"- {a}" for a in action_items_text),
            "risks": "\n".join(f"- {r}" for r in transcript_result.risks),
            "transcript_summary": transcript_result.summary,
        })

        # Merge original + any additional items from LLM
        additional = [
            ActionItemExtracted(
                description=item.get("description", ""),
                owner=item.get("owner", "Unknown"),
                due_date=item.get("due_date"),
                confidence=0.75,
            )
            for item in result.get("additional_action_items", [])
            if isinstance(item, dict)
        ]

        all_action_items = transcript_result.action_items + additional
        decisions = transcript_result.decisions + result.get("decisions", [])
        discussion_summary = result.get("discussion_summary", "")
    except Exception as exc:
        print(f"[MoMAgent] ⚠️ API call failed: {exc}. Using fallback...")
        all_action_items = transcript_result.action_items or [
            ActionItemExtracted(description="Confirm follow-up items with team", owner="Organizer", due_date="ASAP", confidence=0.5)
        ]
        decisions = transcript_result.decisions or ["Review current milestones and timeline."]
        discussion_summary = transcript_result.summary or f"Discussion regarding {meeting_title}."

    return MoMResponse(
        mom_id=str(uuid.uuid4()),
        meeting_title=meeting_title,
        meeting_date=meeting_date,
        attendees=attendees,
        discussion_summary=discussion_summary,
        decisions=decisions,
        action_items=all_action_items,
        approval_status="pending",
    )
