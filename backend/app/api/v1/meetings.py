"""Meetings resource routes."""
from fastapi import APIRouter
router = APIRouter()

MOCK_MEETINGS = [
    {
        "id": "m1",
        "title": "Q3 Dashboard Review",
        "start_time": "2026-06-25T15:00:00Z",
        "time": "3:00 PM",
        "duration_min": 60,
        "participants": ["James", "Ken", "Utkarsh"],
        "brief_status": "ready",
        "source": "google_calendar",
        "agenda_items": ["Roadmap progress review", "KPI dashboard walkthrough", "Q3 blockers and risks"],
        "previous_meetings": ["Q2 review concluded with 3 action items: mobile redesign, QA budget, and hiring plan"],
        "color": "primary",
    },
    {
        "id": "m2",
        "title": "Sprint Planning — Week 26",
        "start_time": "2026-06-26T10:00:00Z",
        "time": "10:00 AM",
        "duration_min": 90,
        "participants": ["Utkarsh", "Dev Team", "QA Lead"],
        "brief_status": "pending",
        "source": "teams",
        "agenda_items": ["Sprint 26 backlog review", "Story point estimation", "Dependency mapping"],
        "previous_meetings": ["Sprint 25 retrospective: velocity increased by 12%, 2 unresolved blockers carried over"],
        "color": "secondary",
    },
    {
        "id": "m3",
        "title": "1:1 with Manager",
        "start_time": "2026-06-27T14:00:00Z",
        "time": "2:00 PM",
        "duration_min": 30,
        "participants": ["Manager", "Utkarsh"],
        "brief_status": "pending",
        "source": "google_calendar",
        "agenda_items": ["Career development check-in", "OKR alignment", "Escalations review"],
        "previous_meetings": [],
        "color": "warning",
        "conflict": True,
    },
]


@router.get("")
async def list_meetings():
    return MOCK_MEETINGS

@router.get("/upcoming")
async def upcoming_meetings(window: str = "60min"):
    return MOCK_MEETINGS

@router.get("/{meeting_id}")
async def get_meeting(meeting_id: str):
    for m in MOCK_MEETINGS:
        if m["id"] == meeting_id:
            return m
    return {"error": "Not found"}
