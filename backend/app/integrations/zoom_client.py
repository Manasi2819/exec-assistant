"""
Zoom Integration Client
========================
Handles Zoom recording webhooks and Cloud Recording transcript fetching.

Webhook event: recording.completed → triggers transcript ingestion pipeline
"""
from __future__ import annotations
import hashlib, hmac
from typing import Any
import httpx

ZOOM_API_BASE = "https://api.zoom.us/v2"
ZOOM_OAUTH_TOKEN_URL = "https://zoom.us/oauth/token"


class ZoomClient:
    def __init__(self, access_token: str):
        self.access_token = access_token
        self._headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}

    async def get_recording(self, meeting_id: str) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(f"{ZOOM_API_BASE}/meetings/{meeting_id}/recordings", headers=self._headers)
            resp.raise_for_status()
            return resp.json()

    async def download_transcript(self, download_url: str) -> str:
        """Download VTT transcript file from Zoom Cloud Recording."""
        async with httpx.AsyncClient(timeout=60, headers=self._headers) as client:
            resp = await client.get(download_url)
            resp.raise_for_status()
            return resp.text

    async def list_recordings(self, from_date: str, to_date: str) -> list[dict]:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{ZOOM_API_BASE}/users/me/recordings",
                headers=self._headers,
                params={"from": from_date, "to": to_date},
            )
            resp.raise_for_status()
            return resp.json().get("meetings", [])


def verify_zoom_webhook(body: bytes, signature: str, timestamp: str, secret_token: str) -> bool:
    """Verify Zoom webhook signature to prevent spoofing."""
    message = f"v0:{timestamp}:{body.decode()}"
    expected = "v0=" + hmac.new(secret_token.encode(), message.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def parse_vtt_transcript(vtt_content: str) -> str:
    """Convert VTT format to plain text for the transcript agent."""
    lines = []
    for line in vtt_content.split("\n"):
        line = line.strip()
        if not line or line.startswith("WEBVTT") or "-->" in line or line.isdigit():
            continue
        lines.append(line)
    return "\n".join(lines)


async def exchange_zoom_code(code: str) -> dict[str, Any]:
    from app.core.config import get_settings
    settings = get_settings()
    import base64
    credentials = base64.b64encode(f"{settings.zoom_client_id}:{settings.zoom_client_secret}".encode()).decode()
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            ZOOM_OAUTH_TOKEN_URL,
            headers={"Authorization": f"Basic {credentials}", "Content-Type": "application/x-www-form-urlencoded"},
            data={"code": code, "redirect_uri": settings.zoom_redirect_uri, "grant_type": "authorization_code"},
        )
        resp.raise_for_status()
        return resp.json()
