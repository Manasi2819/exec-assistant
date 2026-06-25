"""
Google Calendar Integration Client
====================================
Handles Google Calendar free/busy queries, event CRUD, and push channel notifications.
"""
from __future__ import annotations
from typing import Any
import httpx

GCAL_API_BASE = "https://www.googleapis.com/calendar/v3"


class GoogleCalendarClient:
    def __init__(self, access_token: str):
        self.access_token = access_token
        self._headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}

    async def list_events(self, calendar_id: str = "primary", time_min: str = None, time_max: str = None, max_results: int = 10) -> list[dict]:
        from datetime import datetime
        params = {
            "orderBy": "startTime", "singleEvents": True,
            "timeMin": time_min or datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "maxResults": max_results,
        }
        if time_max:
            params["timeMax"] = time_max
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(f"{GCAL_API_BASE}/calendars/{calendar_id}/events", headers=self._headers, params=params)
            resp.raise_for_status()
            return resp.json().get("items", [])

    async def create_event(self, calendar_id: str = "primary", event: dict = None) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(f"{GCAL_API_BASE}/calendars/{calendar_id}/events", headers=self._headers, json=event or {})
            resp.raise_for_status()
            return resp.json()

    async def delete_event(self, calendar_id: str, event_id: str) -> bool:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.delete(f"{GCAL_API_BASE}/calendars/{calendar_id}/events/{event_id}", headers=self._headers)
            return resp.status_code == 204

    async def get_free_busy(self, items: list[str], time_min: str, time_max: str) -> dict[str, Any]:
        """Query free/busy for a list of calendar IDs or email addresses."""
        payload = {
            "timeMin": time_min, "timeMax": time_max,
            "items": [{"id": item} for item in items],
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(f"{GCAL_API_BASE}/freeBusy", headers=self._headers, json=payload)
            resp.raise_for_status()
            return resp.json()

    async def watch_calendar(self, calendar_id: str = "primary", webhook_url: str = None, channel_id: str = None) -> dict[str, Any]:
        """Set up push notifications for calendar changes."""
        import uuid
        payload = {
            "id": channel_id or str(uuid.uuid4()),
            "type": "web_hook",
            "address": webhook_url,
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(f"{GCAL_API_BASE}/calendars/{calendar_id}/events/watch", headers=self._headers, json=payload)
            resp.raise_for_status()
            return resp.json()

    async def stop_channel(self, channel_id: str, resource_id: str) -> bool:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(f"{GCAL_API_BASE}/channels/stop", headers=self._headers, json={"id": channel_id, "resourceId": resource_id})
            return resp.status_code == 204
