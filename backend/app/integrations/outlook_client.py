"""
Outlook / Microsoft 365 Integration Client
==========================================
Handles Outlook email ingestion via MS Graph API webhook + delta query fallback.
Also handles email sending and Teams calendar events.

OAuth setup (one-time):
  1. Azure Portal → App registrations → New registration
  2. Add permissions: Mail.Read, Mail.Send, Calendars.ReadWrite,
     OnlineMeetings.ReadWrite, CallRecords.Read.All
  3. Set MICROSOFT_CLIENT_ID + MICROSOFT_CLIENT_SECRET in .env
  4. User hits /api/v1/integrations/outlook/connect → OAuth flow
"""
from __future__ import annotations
from typing import Any
import httpx
from app.core.config import get_settings

GRAPH_API_BASE = "https://graph.microsoft.com/v1.0"
MS_AUTH_BASE = "https://login.microsoftonline.com"
OUTLOOK_SCOPES = [
    "Mail.Read", "Mail.Send", "Calendars.ReadWrite",
    "OnlineMeetings.ReadWrite", "CallRecords.Read.All",
    "offline_access", "User.Read",
]


class OutlookClient:
    def __init__(self, access_token: str):
        self.access_token = access_token
        self._headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

    async def list_messages(self, top: int = 20, filter_str: str = "isRead eq false") -> list[dict]:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{GRAPH_API_BASE}/me/messages",
                headers=self._headers,
                params={"$top": top, "$filter": filter_str, "$orderby": "receivedDateTime desc"},
            )
            resp.raise_for_status()
            return resp.json().get("value", [])

    async def get_message(self, message_id: str) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{GRAPH_API_BASE}/me/messages/{message_id}",
                headers=self._headers,
            )
            resp.raise_for_status()
            return resp.json()

    async def send_message(self, to: str, subject: str, body: str) -> bool:
        payload = {
            "message": {
                "subject": subject,
                "body": {"contentType": "HTML", "content": body.replace("\n", "<br>")},
                "toRecipients": [{"emailAddress": {"address": to}}],
            }
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{GRAPH_API_BASE}/me/sendMail",
                headers=self._headers,
                json=payload,
            )
            return resp.status_code == 202

    async def delta_query(self, delta_token: str | None = None) -> dict[str, Any]:
        """
        Delta query for incremental email sync.
        Returns new/changed messages since last sync.
        delta_token: None for first call, use returned @odata.deltaLink for subsequent calls.
        """
        url = delta_token or f"{GRAPH_API_BASE}/me/messages/delta"
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, headers=self._headers)
            resp.raise_for_status()
            data = resp.json()
            return {
                "messages": data.get("value", []),
                "delta_link": data.get("@odata.deltaLink"),
                "next_link": data.get("@odata.nextLink"),
            }

    async def subscribe_webhook(self, notification_url: str) -> dict[str, Any]:
        """Register MS Graph webhook for new email notifications."""
        from datetime import datetime, timedelta
        expires = (datetime.utcnow() + timedelta(hours=4230)).strftime("%Y-%m-%dT%H:%M:%S.0000000Z")
        payload = {
            "changeType": "created",
            "notificationUrl": notification_url,
            "resource": "/me/messages",
            "expirationDateTime": expires,
            "clientState": "exec-ai-assistant",
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{GRAPH_API_BASE}/subscriptions",
                headers=self._headers,
                json=payload,
            )
            resp.raise_for_status()
            return resp.json()

    # ── Calendar ────────────────────────────────────────────────

    async def list_calendar_events(self, top: int = 10) -> list[dict]:
        from datetime import datetime, timedelta
        now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        end = (datetime.utcnow() + timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%SZ")
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{GRAPH_API_BASE}/me/calendarView",
                headers=self._headers,
                params={"startDateTime": now, "endDateTime": end, "$top": top},
            )
            resp.raise_for_status()
            return resp.json().get("value", [])

    async def create_event(
        self, subject: str, start: str, end: str, attendees: list[str],
        body: str = "", is_online: bool = True,
    ) -> dict[str, Any]:
        """Create an Outlook calendar event, optionally as Teams online meeting."""
        payload = {
            "subject": subject,
            "start": {"dateTime": start, "timeZone": "UTC"},
            "end": {"dateTime": end, "timeZone": "UTC"},
            "body": {"contentType": "HTML", "content": body},
            "attendees": [
                {"emailAddress": {"address": a}, "type": "required"} for a in attendees
            ],
            "isOnlineMeeting": is_online,
            "onlineMeetingProvider": "teamsForBusiness" if is_online else None,
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{GRAPH_API_BASE}/me/events",
                headers=self._headers,
                json={k: v for k, v in payload.items() if v is not None},
            )
            resp.raise_for_status()
            return resp.json()

    async def get_free_busy(
        self, emails: list[str], start: str, end: str
    ) -> list[dict[str, Any]]:
        """Get free/busy schedule for a list of attendees."""
        payload = {
            "schedules": emails,
            "startTime": {"dateTime": start, "timeZone": "UTC"},
            "endTime": {"dateTime": end, "timeZone": "UTC"},
            "availabilityViewInterval": 30,
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{GRAPH_API_BASE}/me/calendar/getSchedule",
                headers=self._headers,
                json=payload,
            )
            resp.raise_for_status()
            return resp.json().get("value", [])

    # ── Teams Transcripts ───────────────────────────────────────

    async def get_call_transcript(self, call_id: str) -> str:
        """Fetch transcript from a completed Teams call."""
        async with httpx.AsyncClient(timeout=60) as client:
            # Get transcript metadata
            resp = await client.get(
                f"{GRAPH_API_BASE}/communications/callRecords/{call_id}/transcripts",
                headers=self._headers,
            )
            resp.raise_for_status()
            transcripts = resp.json().get("value", [])
            if not transcripts:
                return ""

            # Fetch transcript content
            content_resp = await client.get(
                f"{GRAPH_API_BASE}/communications/callRecords/{call_id}/transcripts/{transcripts[0]['id']}/content",
                headers=self._headers,
            )
            content_resp.raise_for_status()
            return content_resp.text


def get_outlook_auth_url(state: str = "") -> str:
    settings = get_settings()
    from urllib.parse import urlencode
    params = {
        "client_id": settings.microsoft_client_id,
        "response_type": "code",
        "redirect_uri": settings.microsoft_redirect_uri,
        "scope": " ".join(OUTLOOK_SCOPES),
        "response_mode": "query",
        "state": state,
    }
    return f"{MS_AUTH_BASE}/{settings.microsoft_tenant_id}/oauth2/v2.0/authorize?{urlencode(params)}"


async def exchange_outlook_code(code: str) -> dict[str, Any]:
    settings = get_settings()
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{MS_AUTH_BASE}/{settings.microsoft_tenant_id}/oauth2/v2.0/token",
            data={
                "code": code,
                "client_id": settings.microsoft_client_id,
                "client_secret": settings.microsoft_client_secret,
                "redirect_uri": settings.microsoft_redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        resp.raise_for_status()
        return resp.json()
