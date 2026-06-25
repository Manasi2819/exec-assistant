"""
Meeting Preparation Agent
=========================
Priority Agent 3 — Generates a Meeting Brief before every meeting.

Input:  Calendar event + email thread context + FAISS retrieved prior decisions/MoMs
Output: MeetingBriefResponse (Purpose, Important Topics, Previous Decisions,
        Potential Questions, Recommended Preparation)

Matches the lead's example brief format exactly.
"""
from __future__ import annotations
import uuid
from datetime import datetime
from typing import Any

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

from app.core.llm_router import AgentTask, get_llm
from app.models.schemas import MeetingBriefResponse, DecisionRef
from app.models.state import AgentState


MEETING_PREP_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are an AI Executive Assistant preparing a meeting brief.
Generate a comprehensive pre-meeting brief from the context provided.

Return a JSON object with:
- purpose: one-paragraph description of the meeting's goal
- important_topics: list of key topics to be discussed (ordered by importance)
- previous_decisions: list of objects with {{decision_text, meeting_date, meeting_title}} from prior meetings
- potential_questions: list of likely questions to be raised
- recommended_preparation: list of specific preparation actions

Keep it concise, professional, and actionable. The user should be able to read this in under 3 minutes.
"""),
    ("human", """Meeting: {meeting_title}
Date/Time: {meeting_datetime}
Participants: {participants}
Calendar Description: {calendar_description}

Related Email Context:
{email_context}

Prior Meeting History / Decisions:
{prior_context}

Generate the meeting brief.""")
])


async def meeting_prep_node(state: AgentState) -> AgentState:
    """
    LangGraph node: Generates a MeetingBrief using frontier LLM + FAISS context.
    Reads: intent, calendar_result, rag_context
    Writes: meeting_brief
    """
    intent = state.get("intent")
    rag_context = state.get("rag_context", "No prior meeting history available.")
    payload = state.get("raw_payload", {})

    meeting_title = intent.agenda if intent and intent.agenda else payload.get("meeting_title", "Upcoming Meeting")
    participants = intent.participants if intent else []
    meeting_datetime = str(intent.meeting_time) if intent and intent.meeting_time else "TBD"

    try:
        llm = get_llm(AgentTask.MEETING_PREP, temperature=0.2)
        chain = MEETING_PREP_PROMPT | llm | JsonOutputParser()

        result: dict[str, Any] = await chain.ainvoke({
            "meeting_title": meeting_title,
            "meeting_datetime": meeting_datetime,
            "participants": ", ".join(participants) if participants else "TBD",
            "calendar_description": payload.get("calendar_description", "No description provided."),
            "email_context": payload.get("email_body", "No email context."),
            "prior_context": rag_context,
        })

        previous_decisions = [
            DecisionRef(**d) if isinstance(d, dict) else DecisionRef(decision_text=str(d))
            for d in result.get("previous_decisions", [])
        ]

        brief = MeetingBriefResponse(
            meeting_id=payload.get("meeting_id", str(uuid.uuid4())),
            meeting_title=meeting_title,
            purpose=result.get("purpose", ""),
            important_topics=result.get("important_topics", []),
            previous_decisions=previous_decisions,
            potential_questions=result.get("potential_questions", []),
            recommended_preparation=result.get("recommended_preparation", []),
            participants=participants,
        )

        return {**state, "meeting_brief": brief, "error": None}

    except Exception as exc:
        print(f"[MeetingPrepAgent Node] ⚠️ API call failed: {exc}. Using fallback...")
        brief = MeetingBriefResponse(
            meeting_id=payload.get("meeting_id", str(uuid.uuid4())),
            meeting_title=meeting_title,
            purpose=f"Offline pre-meeting alignment brief for: {meeting_title}.",
            important_topics=["General status updates", "Objectives & deliverables", "Key milestones & timelines"],
            previous_decisions=[
                DecisionRef(decision_text="Coordinate on deliverables offline", meeting_date="Previous", meeting_title="Weekly Sync")
            ],
            potential_questions=["What is the current progress?", "What are the blockers or dependencies?"],
            recommended_preparation=["Review recent email communications", "Prepare individual updates"],
            participants=participants,
        )
        return {
            **state,
            "meeting_brief": brief,
            "error": f"API rate limit reached (fallback used): {exc}",
        }


async def generate_meeting_brief(
    meeting_title: str,
    participants: list[str],
    meeting_datetime: str,
    calendar_description: str,
    email_context: str,
    prior_context: str,
    meeting_id: str | None = None,
) -> MeetingBriefResponse:
    """Standalone brief generator — usable outside the supervisor graph."""
    try:
        llm = get_llm(AgentTask.MEETING_PREP, temperature=0.2)
        chain = MEETING_PREP_PROMPT | llm | JsonOutputParser()

        result = await chain.ainvoke({
            "meeting_title": meeting_title,
            "meeting_datetime": meeting_datetime,
            "participants": ", ".join(participants),
            "calendar_description": calendar_description,
            "email_context": email_context,
            "prior_context": prior_context,
        })

        previous_decisions = [
            DecisionRef(**d) if isinstance(d, dict) else DecisionRef(decision_text=str(d))
            for d in result.get("previous_decisions", [])
        ]

        return MeetingBriefResponse(
            meeting_id=meeting_id or str(uuid.uuid4()),
            meeting_title=meeting_title,
            purpose=result.get("purpose", ""),
            important_topics=result.get("important_topics", []),
            previous_decisions=previous_decisions,
            potential_questions=result.get("potential_questions", []),
            recommended_preparation=result.get("recommended_preparation", []),
            participants=participants,
        )
    except Exception as exc:
        print(f"[MeetingPrepAgent] ⚠️ API call failed: {exc}. Using fallback...")
        return MeetingBriefResponse(
            meeting_id=meeting_id or str(uuid.uuid4()),
            meeting_title=meeting_title,
            purpose=f"Offline pre-meeting alignment brief for: {meeting_title}.",
            important_topics=["General status updates", "Objectives & deliverables", "Key milestones & timelines"],
            previous_decisions=[
                DecisionRef(decision_text="Coordinate on deliverables offline", meeting_date="Previous", meeting_title="Weekly Sync")
            ],
            potential_questions=["What is the current progress?", "What are the blockers or dependencies?"],
            recommended_preparation=["Review recent email communications", "Prepare individual updates"],
            participants=participants,
        )
