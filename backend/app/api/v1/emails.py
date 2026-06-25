"""Stub routes for emails and meetings."""
from fastapi import APIRouter
from datetime import datetime
import uuid

router = APIRouter()

MOCK_EMAILS = [
    {
        "id": "e1",
        "sender": "sarah@company.com",
        "senderName": "Sarah Jenkins (Legal)",
        "subject": "Q4 Budget Reallocation Request — Approval Needed",
        "preview": "I need your formal approval to shift $50k from T&E to Digital Ad Spend before the Friday board meeting.",
        "body": "Hi,\n\nI hope this finds you well. We've completed our Q4 planning review and identified an opportunity to reallocate $50k from Travel & Entertainment to Digital Ad Spend, which our data shows will yield a 3x ROI.\n\nI need your formal approval before we submit the updated budget to the board on Friday. No major risks flagged — the T&E reduction is offset by lower conference attendance this quarter.\n\nPlease confirm at your earliest convenience.\n\nBest,\nSarah Jenkins\nLegal & Finance",
        "category": "approval_request",
        "priority": "high",
        "confidence": 0.97,
        "time": "10:42 AM",
        "received_at": "2026-06-25T10:42:00Z",
    },
    {
        "id": "e2",
        "sender": "cto@company.com",
        "senderName": "CTO Office",
        "subject": "Board Meeting — Please Confirm Attendance",
        "preview": "Please confirm your attendance for the board meeting on Friday at 2 PM. We need to discuss Q3 results.",
        "body": "Hi,\n\nPlease confirm your attendance for the board meeting on Friday at 2 PM. We need to discuss Q3 results, the new product roadmap, and the proposed headcount changes.\n\nA pre-read deck will be circulated by Wednesday. Please review slides 4–7 which require your sign-off.\n\nRegards,\nCTO Office",
        "category": "meeting_request",
        "priority": "high",
        "confidence": 0.95,
        "time": "Yesterday",
        "received_at": "2026-06-24T15:00:00Z",
    },
    {
        "id": "e3",
        "sender": "hr@company.com",
        "senderName": "HR Department",
        "subject": "Updated Holiday Schedule & Policy Changes 2026",
        "preview": "Please review the updated corporate holiday schedule and revised remote work policy for the upcoming quarter.",
        "body": "Hi Team,\n\nPlease review the updated corporate holiday schedule for Q3/Q4 2026. Key changes:\n- August 15 now a company-wide holiday\n- Remote work policy updated: max 3 days/week from home\n- Mental health days: 2 additional paid days added\n\nNo action required unless you have scheduling conflicts to flag.\n\nHR Team",
        "category": "fyi",
        "priority": "low",
        "confidence": 0.98,
        "time": "2 days ago",
        "received_at": "2026-06-23T09:00:00Z",
    },
]

@router.get("")
async def list_emails(category: str | None = None):
    if category:
        return [e for e in MOCK_EMAILS if e["category"] == category]
    return MOCK_EMAILS

@router.get("/{email_id}")
async def get_email(email_id: str):
    for e in MOCK_EMAILS:
        if e["id"] == email_id:
            return e
    return {"error": "Not found"}
