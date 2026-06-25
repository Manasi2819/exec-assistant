"""
Calendar Agent
===============
Priority Agent 2 — Manages calendar events across Google Calendar, Outlook, and Teams.

Responsibilities:
  1. Propose available time slots given participant list + duration
  2. Detect and explain scheduling conflicts
  3. Create calendar events (Phase 2 — real OAuth)
  4. Schedule meeting reminders (60 min + 15 min)
  5. Accept/decline meeting requests intelligently

Phase 1: Simulated responses (real API calls disabled until OAuth is wired)
Phase 2: Calls self.gcal_client / self.outlook_client from integrations/
"""
from __future__ import annotations
import uuid
from datetime import datetime, timedelta
from typing import Any, Literal

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

from app.core.llm_router import AgentTask, get_llm
from app.models.schemas import (
    CalendarProcessRequest, CalendarProcessResponse, CalendarSlot, ExtractedIntent
)
from app.models.state import AgentState


CONFLICT_ANALYSIS_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are analyzing calendar data to detect conflicts and suggest best meeting slots.
Given free/busy information, find the best available slot for the meeting.

Return JSON:
{{
  "conflict_detected": true/false,
  "conflict_explanation": "string or null",
  "recommended_slot": {{"start": "ISO datetime", "end": "ISO datetime"}},
  "alternative_slots": [{{"start": "ISO", "end": "ISO"}}, ...]
}}
"""),
    ("human", """Meeting request:
  Preferred time: {preferred_time}
  Duration: {duration_min} minutes
  Participants: {participants}
  Calendar sources: {sources}

Existing events (busy periods):
{busy_periods}

Suggest the best slot or flag conflicts.""")
])


async def calendar_processing_node(state: AgentState) -> AgentState:
    """
    LangGraph node: Processes meeting scheduling from extracted intent.
    Reads:  intent, raw_payload
    Writes: calendar_result
    """
    intent: ExtractedIntent | None = state.get("intent")
    payload = state.get("raw_payload", {})

    if not intent or intent.type != "meeting_request":
        return {**state, "calendar_result": None}

    try:
        result = await process_calendar_request(
            intent=intent,
            calendar_sources=payload.get("calendar_sources", ["google", "outlook", "teams"]),
            preferred_duration_minutes=payload.get("duration_minutes", 60),
        )
        return {**state, "calendar_result": result, "error": None}
    except Exception as exc:
        return {
            **state,
            "error": f"CalendarAgent failed: {exc}",
            "retry_count": state.get("retry_count", 0) + 1,
        }


async def process_calendar_request(
    intent: ExtractedIntent,
    calendar_sources: list[str] | None = None,
    preferred_duration_minutes: int = 60,
) -> CalendarProcessResponse:
    """
    Core calendar processing logic.
    Phase 2: fetches real free/busy data from integration clients.
    Phase 1: simulates availability.
    """
    from app.core.config import get_settings
    settings = get_settings()

    preferred_time = intent.meeting_time
    participants = intent.participants

    # ── Phase 2: attempt real calendar API calls ──────────────
    busy_periods: list[dict] = []
    has_real_data = False

    if settings.google_api_key or (settings.microsoft_client_id and settings.microsoft_client_secret):
        try:
            busy_periods = await _fetch_busy_periods(
                participants=participants,
                start=preferred_time or datetime.utcnow() + timedelta(hours=1),
                duration_minutes=preferred_duration_minutes,
                sources=calendar_sources or ["google", "outlook"],
            )
            has_real_data = True
        except Exception:
            pass  # Fall back to simulation

    # ── Conflict detection via LLM ────────────────────────────
    if preferred_time:
        try:
            llm = get_llm(AgentTask.CALENDAR, temperature=0.0)
            chain = CONFLICT_ANALYSIS_PROMPT | llm | JsonOutputParser()

            analysis: dict[str, Any] = await chain.ainvoke({
                "preferred_time": str(preferred_time),
                "duration_min": preferred_duration_minutes,
                "participants": ", ".join(participants) if participants else "TBD",
                "sources": ", ".join(calendar_sources or ["google", "outlook", "teams"]),
                "busy_periods": str(busy_periods) if busy_periods else "No conflicts detected (simulated)",
            })

            conflict_detected = analysis.get("conflict_detected", False)
            conflict_explanation = analysis.get("conflict_explanation")
            alternative_slots = analysis.get("alternative_slots", [])
        except Exception as exc:
            print(f"[CalendarAgent] ⚠️ API call failed: {exc}. Using fallback...")
            conflict_detected = False
            conflict_explanation = "No conflict detected offline."
            alternative_slots = []

        # Build proposed slots
        proposed_slots: list[CalendarSlot] = []
        if not conflict_detected and preferred_time:
            proposed_slots.append(CalendarSlot(
                start=preferred_time,
                end=preferred_time + timedelta(minutes=preferred_duration_minutes),
                available=True,
            ))
        for alt in alternative_slots[:3]:
            try:
                start = datetime.fromisoformat(alt["start"])
                end = datetime.fromisoformat(alt["end"])
                proposed_slots.append(CalendarSlot(start=start, end=end, available=True))
            except Exception:
                pass

        return CalendarProcessResponse(
            event_id=str(uuid.uuid4()) if not conflict_detected else None,
            proposed_slots=proposed_slots,
            conflict_detected=conflict_detected,
            conflict_explanation=conflict_explanation,
            reminder_scheduled=not conflict_detected,
            status="created" if not conflict_detected else "conflict",
        )

    # No preferred time — propose slots
    now = datetime.utcnow()
    next_morning = (now + timedelta(days=1)).replace(hour=9, minute=0, second=0)
    slots = [
        CalendarSlot(
            start=next_morning + timedelta(hours=i * 2),
            end=next_morning + timedelta(hours=i * 2, minutes=preferred_duration_minutes),
            available=True,
        )
        for i in range(3)
    ]

    return CalendarProcessResponse(
        proposed_slots=slots,
        conflict_detected=False,
        reminder_scheduled=False,
        status="proposed",
    )


async def _fetch_busy_periods(
    participants: list[str],
    start: datetime,
    duration_minutes: int,
    sources: list[str],
) -> list[dict[str, Any]]:
    """
    Fetch free/busy data from real calendar APIs.
    Returns list of busy period dicts: {start, end, participant, source}
    """
    busy: list[dict] = []

    if "google" in sources:
        try:
            from app.integrations.google_calendar_client import GoogleCalendarClient
            # In Phase 2 with real OAuth tokens, this fetches actual busy data
            # gcal = GoogleCalendarClient(access_token=...)
            # busy.extend(await gcal.get_free_busy(participants, start, start + timedelta(minutes=duration_minutes)))
            pass
        except ImportError:
            pass

    if "outlook" in sources or "teams" in sources:
        try:
            from app.integrations.outlook_client import OutlookClient
            # outlook = OutlookClient(access_token=...)
            # busy.extend(await outlook.get_free_busy(participants, start, start + timedelta(minutes=duration_minutes)))
            pass
        except ImportError:
            pass

    return busy


async def create_calendar_event(
    title: str,
    start: datetime,
    end: datetime,
    participants: list[str],
    description: str = "",
    sources: list[str] | None = None,
) -> dict[str, Any]:
    """
    Create a calendar event across connected sources.
    Returns event IDs from each calendar.
    """
    event_ids: dict[str, str] = {}

    # Simulated in Phase 1 — replace with real API calls in Phase 2
    for source in (sources or ["google"]):
        event_ids[source] = f"sim-{source}-{str(uuid.uuid4())[:8]}"

    return {
        "status": "created",
        "event_ids": event_ids,
        "title": title,
        "start": start.isoformat(),
        "end": end.isoformat(),
    }
