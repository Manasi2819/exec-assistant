"""Meetings resource routes — Calendar Intelligence Agent."""
from __future__ import annotations
import copy
import uuid
from datetime import datetime, timedelta
from typing import Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

# ─────────────────────────────────────────────────────────────
# In-memory mutable store (resets on server restart — Phase 1)
# ─────────────────────────────────────────────────────────────

_MEETINGS: dict[str, dict] = {
    "m1": {
        "id": "m1",
        "title": "Q3 Dashboard Review",
        "start_time": "2026-06-24T15:00:00Z",
        "date": "2026-06-24",
        "time": "3:00 PM",
        "duration_min": 60,
        "participants": ["James", "Ken", "Utkarsh"],
        "optional_participants": [],
        "brief_status": "ready",
        "source": "google_calendar",
        "agenda_items": ["Roadmap progress review", "KPI dashboard walkthrough", "Q3 blockers and risks"],
        "previous_meetings": ["Q2 review concluded with 3 action items: mobile redesign, QA budget, and hiring plan"],
        "color": "primary",
        "location": "Conference Room A",
        "meeting_link": "https://meet.google.com/abc-defg-hij",
        "priority": "high",
        "description": "Quarterly review of the Q3 dashboard KPIs and roadmap execution status.",
        "organizer_notes": "Prepare updated KPI slides before the meeting.",
        "conflict": False,
        "delegated": False,
        "delegated_to": None,
        "col": 3,
        "row": 7,
    },
    "m2": {
        "id": "m2",
        "title": "Sprint Planning — Week 26",
        "start_time": "2026-06-26T10:00:00Z",
        "date": "2026-06-26",
        "time": "10:00 AM",
        "duration_min": 90,
        "participants": ["Utkarsh", "Dev Team", "QA Lead"],
        "optional_participants": ["Product Manager"],
        "brief_status": "pending",
        "source": "teams",
        "agenda_items": ["Sprint 26 backlog review", "Story point estimation", "Dependency mapping"],
        "previous_meetings": ["Sprint 25 retrospective: velocity increased by 12%, 2 unresolved blockers carried over"],
        "color": "secondary",
        "location": "Teams Meeting",
        "meeting_link": "https://teams.microsoft.com/l/meetup-join/xyz",
        "priority": "medium",
        "description": "Weekly sprint planning to align development priorities for sprint 26.",
        "organizer_notes": "",
        "conflict": True,
        "delegated": False,
        "delegated_to": None,
        "col": 4,
        "row": 2,
    },
    "m3": {
        "id": "m3",
        "title": "1:1 with Manager",
        "start_time": "2026-06-27T14:00:00Z",
        "date": "2026-06-27",
        "time": "2:00 PM",
        "duration_min": 30,
        "participants": ["Manager", "Utkarsh"],
        "optional_participants": [],
        "brief_status": "pending",
        "source": "google_calendar",
        "agenda_items": ["Career development check-in", "OKR alignment", "Escalations review"],
        "previous_meetings": [],
        "color": "warning",
        "location": "Manager's Office",
        "meeting_link": "",
        "priority": "high",
        "description": "Regular 1:1 meeting for career development and OKR alignment.",
        "organizer_notes": "Review Q2 OKR scores before the meeting.",
        "conflict": True,
        "delegated": False,
        "delegated_to": None,
        "col": 5,
        "row": 6,
    },
    "m4": {
        "id": "m4",
        "title": "CFO Strategic Briefing",
        "start_time": "2026-06-26T10:30:00Z",
        "date": "2026-06-26",
        "time": "10:30 AM",
        "duration_min": 60,
        "participants": ["CFO", "Finance Lead", "Utkarsh"],
        "optional_participants": [],
        "brief_status": "pending",
        "source": "outlook",
        "agenda_items": ["Q3 budget approval", "Headcount planning", "Risk assessment"],
        "previous_meetings": ["Q2 CFO review: approved $2M for infrastructure scaling"],
        "color": "tertiary",
        "location": "Executive Board Room",
        "meeting_link": "",
        "priority": "critical",
        "description": "Strategic financial briefing with CFO for Q3 planning.",
        "organizer_notes": "Bring updated P&L projections and headcount model.",
        "conflict": True,
        "delegated": False,
        "delegated_to": None,
        "col": 4,
        "row": 3,
    },
}

# Active AI suggestions (mutable)
_SUGGESTIONS: list[dict] = [
    {
        "id": "s1",
        "meeting_id": "m2",
        "type": "reschedule",
        "title": "Move Sprint Planning to Thursday 2 PM",
        "rationale": "Sprint Planning conflicts with CFO Strategic Briefing (10:00–11:30 AM). Moving to Thursday eliminates the overlap and preserves high-priority finance meeting.",
        "impact": "Eliminates 60-min scheduling conflict · All 3 dev team members available Thursday",
        "priority": "high",
        "params": {"new_date": "2026-06-25", "new_time": "2:00 PM", "new_col": 3, "new_row": 6},
        "status": "active",
        "icon": "schedule",
        "badge_type": "conflict",
    },
    {
        "id": "s2",
        "meeting_id": "m1",
        "type": "brief_ready",
        "title": "Q3 Dashboard Review brief is ready",
        "rationale": "AI Meeting Brief has been prepared with 3 key prep items: updated KPI deck, risk register review, and Q2 action item status.",
        "impact": "3 prep items pending · Meeting in 2 days",
        "priority": "medium",
        "params": {},
        "status": "active",
        "icon": "auto_awesome",
        "badge_type": "success",
    },
    {
        "id": "s3",
        "meeting_id": "m3",
        "type": "delegate",
        "title": "Delegate 1:1 with Manager — Sarah Jenkins available",
        "rationale": "Your calendar shows back-to-back meetings on Friday. Sarah Jenkins (Senior PM) has 100% availability and full context on recent OKR progress.",
        "impact": "Frees 30 min on Friday · Sarah has attended last 3 similar meetings",
        "priority": "medium",
        "params": {"suggested_delegate": "Sarah Jenkins", "delegate_role": "Senior PM"},
        "status": "active",
        "icon": "person_add",
        "badge_type": "info",
    },
    {
        "id": "s4",
        "meeting_id": "m4",
        "type": "move_earlier",
        "title": "Move CFO Briefing 30 min earlier (10:00 → 9:30 AM)",
        "rationale": "CFO Strategic Briefing overlaps with Sprint Planning end time. Moving it 30 minutes earlier fully resolves the conflict while keeping all attendees available.",
        "impact": "Resolves conflict · CFO confirmed available from 9:30 AM",
        "priority": "high",
        "params": {"new_time": "9:30 AM", "new_row": 2},
        "status": "active",
        "icon": "arrow_upward",
        "badge_type": "conflict",
    },
    {
        "id": "s5",
        "meeting_id": "m3",
        "type": "shorten",
        "title": "Shorten 1:1 with Manager to 15 minutes",
        "rationale": "No escalation items flagged this week. A focused 15-minute check-in is sufficient based on your previous meeting pattern.",
        "impact": "Frees 15 min · Low agenda density detected",
        "priority": "low",
        "params": {"new_duration": 15},
        "status": "active",
        "icon": "timer",
        "badge_type": "info",
    },
]

# Team members for delegation
_TEAM_MEMBERS: list[dict] = [
    {"id": "t1", "name": "Sarah Jenkins", "role": "Senior Product Manager", "department": "Product", "availability": 95, "expertise": 88, "workload": 42, "reason": "Full OKR context, attended last 3 similar meetings, 95% availability this week"},
    {"id": "t2", "name": "Rahul Patel", "role": "Engineering Lead", "department": "Engineering", "availability": 78, "expertise": 72, "workload": 65, "reason": "Strong technical background, involved in same projects, 2 open slots on Friday"},
    {"id": "t3", "name": "Aisha Mohammed", "role": "Chief of Staff", "department": "Executive", "availability": 60, "expertise": 91, "workload": 70, "reason": "Highest executive context, can represent leadership perspective effectively"},
    {"id": "t4", "name": "Ken Watanabe", "role": "Product Director", "department": "Product", "availability": 82, "expertise": 85, "workload": 55, "reason": "Direct knowledge of Q3 roadmap, frequent collaborator with the manager"},
    {"id": "t5", "name": "Priya Sharma", "role": "Project Manager", "department": "PMO", "availability": 90, "expertise": 65, "workload": 38, "reason": "High availability, active on related project streams"},
]


# ─────────────────────────────────────────────────────────────
# Request/Response Schemas
# ─────────────────────────────────────────────────────────────

class MeetingPatch(BaseModel):
    title: str | None = None
    date: str | None = None
    time: str | None = None
    duration_min: int | None = None
    description: str | None = None
    agenda_text: str | None = None
    location: str | None = None
    meeting_link: str | None = None
    participants: list[str] | None = None
    optional_participants: list[str] | None = None
    organizer_notes: str | None = None
    priority: str | None = None


class DelegateRequest(BaseModel):
    delegate_name: str
    delegate_id: str | None = None
    delegation_notes: str | None = None
    transfer_ownership: bool = False


class RescheduleRequest(BaseModel):
    new_date: str
    new_time: str
    new_col: int | None = None
    new_row: int | None = None


class CreateMeetingRequest(BaseModel):
    title: str
    date: str
    time: str
    duration_min: int = 60
    participants: list[str] = []
    optional_participants: list[str] = []
    location: str = ""
    meeting_link: str = ""
    description: str = ""
    agenda_items: list[str] = []
    priority: str = "medium"
    organizer_notes: str = ""


class ApproveSuggestionRequest(BaseModel):
    suggestion_id: str
    params: dict[str, Any] | None = None


# ─────────────────────────────────────────────────────────────
# Helper: compute grid position from time string
# ─────────────────────────────────────────────────────────────

HOUR_TO_ROW: dict[str, int] = {
    "8 AM": 0, "8:00 AM": 0, "8:30 AM": 0,
    "9 AM": 1, "9:00 AM": 1, "9:30 AM": 1,
    "10 AM": 2, "10:00 AM": 2, "10:30 AM": 3,
    "11 AM": 3, "11:00 AM": 3, "11:30 AM": 3,
    "12 PM": 4, "12:00 PM": 4,
    "1 PM": 5, "1:00 PM": 5,
    "2 PM": 6, "2:00 PM": 6, "2:30 PM": 6,
    "3 PM": 7, "3:00 PM": 7,
    "4 PM": 8, "4:00 PM": 8,
    "5 PM": 9, "5:00 PM": 9,
    "6 PM": 10, "6:00 PM": 10,
}

DATE_TO_COL: dict[str, int] = {
    "2026-06-21": 0, "2026-06-22": 1, "2026-06-23": 2,
    "2026-06-24": 3, "2026-06-25": 4, "2026-06-26": 5,
    "2026-06-27": 6,
}


def _time_to_row(time_str: str) -> int:
    return HOUR_TO_ROW.get(time_str, 2)


def _date_to_col(date_str: str) -> int:
    return DATE_TO_COL.get(date_str, 3)


def _get_meeting_copy(meeting_id: str) -> dict | None:
    m = _MEETINGS.get(meeting_id)
    if not m:
        return None
    return copy.deepcopy(m)


# ─────────────────────────────────────────────────────────────
# Routes — Read (static paths MUST come before /{meeting_id})
# ─────────────────────────────────────────────────────────────

@router.get("")
async def list_meetings():
    return list(_MEETINGS.values())


@router.get("/upcoming")
async def upcoming_meetings(window: str = "60min"):
    return list(_MEETINGS.values())


@router.get("/suggestions/all")
async def get_suggestions():
    return [s for s in _SUGGESTIONS if s["status"] == "active"]


@router.get("/conflicts/all")
async def get_conflicts():
    conflicts = []
    meetings = list(_MEETINGS.values())
    for i, a in enumerate(meetings):
        for b in meetings[i + 1:]:
            if a.get("col") == b.get("col") and a.get("row") == b.get("row"):
                conflicts.append({
                    "id": f"c_{a['id']}_{b['id']}",
                    "meeting_a_id": a["id"],
                    "meeting_a_title": a["title"],
                    "meeting_b_id": b["id"],
                    "meeting_b_title": b["title"],
                    "overlap_minutes": min(a["duration_min"], b["duration_min"]),
                    "suggested_resolution": f"Move {b['title']} to avoid overlap",
                    "resolution_type": "move_b",
                })
    return conflicts


@router.post("/suggestions/{suggestion_id}/dismiss")
async def dismiss_suggestion(suggestion_id: str):
    remaining = [s for s in _SUGGESTIONS if s["id"] != suggestion_id and s["status"] == "active"]
    return {"status": "dismissed", "remaining": len(remaining)}


@router.get("/{meeting_id}")
async def get_meeting(meeting_id: str):
    m = _MEETINGS.get(meeting_id)
    if not m:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return m


# ─────────────────────────────────────────────────────────────
# Routes — Create
# ─────────────────────────────────────────────────────────────

@router.post("")
async def create_meeting(body: CreateMeetingRequest):
    new_id = f"m{uuid.uuid4().hex[:6]}"
    col = _date_to_col(body.date)
    row = _time_to_row(body.time)
    meeting: dict[str, Any] = {
        "id": new_id,
        "title": body.title,
        "start_time": f"{body.date}T{body.time}:00Z",
        "date": body.date,
        "time": body.time,
        "duration_min": body.duration_min,
        "participants": body.participants,
        "optional_participants": body.optional_participants,
        "brief_status": "pending",
        "source": "manual",
        "agenda_items": body.agenda_items,
        "previous_meetings": [],
        "color": "primary",
        "location": body.location,
        "meeting_link": body.meeting_link,
        "priority": body.priority,
        "description": body.description,
        "organizer_notes": body.organizer_notes,
        "conflict": False,
        "delegated": False,
        "delegated_to": None,
        "col": col,
        "row": row,
    }
    return meeting


# ─────────────────────────────────────────────────────────────
# Routes — Update
# ─────────────────────────────────────────────────────────────

@router.patch("/{meeting_id}")
async def update_meeting(meeting_id: str, body: MeetingPatch):
    m = _get_meeting_copy(meeting_id)
    if not m:
        raise HTTPException(status_code=404, detail="Meeting not found")

    patch = body.model_dump(exclude_none=True)

    # Update agenda_items from agenda_text if provided
    if "agenda_text" in patch:
        m["agenda_items"] = [line.strip() for line in patch.pop("agenda_text").split("\n") if line.strip()]

    # Recompute grid position if date/time changed
    if "date" in patch:
        m["col"] = _date_to_col(patch["date"])
    if "time" in patch:
        m["row"] = _time_to_row(patch["time"])

    m.update(patch)
    return m


@router.post("/{meeting_id}/reschedule")
async def reschedule_meeting(meeting_id: str, body: RescheduleRequest):
    m = _get_meeting_copy(meeting_id)
    if not m:
        raise HTTPException(status_code=404, detail="Meeting not found")

    m["date"] = body.new_date
    m["time"] = body.new_time
    m["start_time"] = f"{body.new_date}T{body.new_time}:00Z"
    m["col"] = body.new_col if body.new_col is not None else _date_to_col(body.new_date)
    m["row"] = body.new_row if body.new_row is not None else _time_to_row(body.new_time)
    m["conflict"] = False  # Moving resolves the conflict
    return m


# ─────────────────────────────────────────────────────────────
# Routes — Delegate
# ─────────────────────────────────────────────────────────────

@router.post("/{meeting_id}/delegate")
async def delegate_meeting(meeting_id: str, body: DelegateRequest):
    m = _get_meeting_copy(meeting_id)
    if not m:
        raise HTTPException(status_code=404, detail="Meeting not found")

    m["delegated"] = True
    m["delegated_to"] = body.delegate_name
    m["delegation_notes"] = body.delegation_notes or ""
    m["conflict"] = False  # Delegation removes executive from conflict

    return {
        "status": "delegated",
        "meeting_id": meeting_id,
        "delegated_to": body.delegate_name,
        "notifications_sent": [body.delegate_name, "Meeting Organizer"],
        "message": f"Meeting delegated to {body.delegate_name}. Organizer and delegate have been notified.",
    }






@router.post("/{meeting_id}/approve-suggestion")
async def approve_suggestion(meeting_id: str, body: ApproveSuggestionRequest):
    # Find the suggestion without mutating
    suggestion = next((s for s in _SUGGESTIONS if s["id"] == body.suggestion_id), None)
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")

    params = body.params or suggestion.get("params", {})
    s_type = suggestion["type"]
    m = _get_meeting_copy(meeting_id)

    result: dict[str, Any] = {"status": "approved", "suggestion_id": body.suggestion_id}

    if s_type == "reschedule" and m:
        m["date"] = params.get("new_date", m["date"])
        m["time"] = params.get("new_time", m["time"])
        m["col"] = params.get("new_col", _date_to_col(m["date"]))
        m["row"] = params.get("new_row", _time_to_row(m["time"]))
        m["conflict"] = False
        result["updated_meeting"] = m

    elif s_type == "move_earlier" and m:
        new_time = params.get("new_time", m["time"])
        new_row = params.get("new_row", _time_to_row(new_time))
        m["time"] = new_time
        m["row"] = new_row
        m["conflict"] = False
        result["updated_meeting"] = m

    elif s_type == "shorten" and m:
        m["duration_min"] = params.get("new_duration", m["duration_min"])
        result["updated_meeting"] = m

    elif s_type == "delegate" and m:
        delegate_name = params.get("suggested_delegate", "Delegate")
        m["delegated"] = True
        m["delegated_to"] = delegate_name
        m["conflict"] = False
        result["updated_meeting"] = m

    # Mark suggestion as approved in the response list (without mutating global list)
    result["remaining_suggestions"] = [s for s in _SUGGESTIONS if s["id"] != body.suggestion_id and s["status"] == "active"]

    return result





# ─────────────────────────────────────────────────────────────
# Routes — Delegate Recommendations
# ─────────────────────────────────────────────────────────────

@router.get("/{meeting_id}/delegates")
async def get_delegate_recommendations(meeting_id: str):
    m = _MEETINGS.get(meeting_id)
    if not m:
        raise HTTPException(status_code=404, detail="Meeting not found")

    # Sort by composite score: availability (40%) + expertise (35%) + inverse workload (25%)
    scored = sorted(
        _TEAM_MEMBERS,
        key=lambda t: t["availability"] * 0.4 + t["expertise"] * 0.35 + (100 - t["workload"]) * 0.25,
        reverse=True,
    )
    return scored

