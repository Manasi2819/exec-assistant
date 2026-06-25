"""
Gmail Integration Client
========================
Handles Gmail email ingestion via Google Pub/Sub push + history.list fallback,
and email sending via the Gmail API.

Phase 1: Stubs (no OAuth tokens required)
Phase 2: Full OAuth with access_token from DB

OAuth setup (one-time):
  1. Google Cloud Console → Create OAuth 2.0 Client ID
  2. Enable Gmail API + Google Pub/Sub API
  3. Set GMAIL_CLIENT_ID + GMAIL_CLIENT_SECRET in .env
  4. User hits /api/v1/integrations/gmail/connect → OAuth flow
  5. Tokens stored in DB oauth_tokens table
"""
from __future__ import annotations
from typing import Any

import httpx

from app.core.config import get_settings


GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1"
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"

GMAIL_SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
]


class GmailClient:
    def __init__(self, access_token: str):
        self.access_token = access_token
        self._headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

    async def list_messages(
        self, query: str = "is:unread", max_results: int = 20
    ) -> list[dict[str, Any]]:
        """List messages matching query. Returns message stubs."""
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{GMAIL_API_BASE}/users/me/messages",
                headers=self._headers,
                params={"q": query, "maxResults": max_results},
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("messages", [])

    async def get_message(self, message_id: str) -> dict[str, Any]:
        """Fetch full message payload."""
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{GMAIL_API_BASE}/users/me/messages/{message_id}",
                headers=self._headers,
                params={"format": "full"},
            )
            resp.raise_for_status()
            return resp.json()

    async def send_message(
        self, to: str, subject: str, body: str, thread_id: str | None = None
    ) -> dict[str, Any]:
        """Send an email. Optionally reply to an existing thread."""
        import base64
        from email.mime.text import MIMEText

        msg = MIMEText(body)
        msg["to"] = to
        msg["subject"] = subject
        if thread_id:
            msg["References"] = thread_id
            msg["In-Reply-To"] = thread_id

        raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
        payload: dict[str, Any] = {"raw": raw}
        if thread_id:
            payload["threadId"] = thread_id

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{GMAIL_API_BASE}/users/me/messages/send",
                headers=self._headers,
                json=payload,
            )
            resp.raise_for_status()
            return resp.json()

    async def setup_push_watch(self, topic_name: str) -> dict[str, Any]:
        """
        Register Gmail push notifications via Google Cloud Pub/Sub.
        topic_name: "projects/YOUR_PROJECT/topics/gmail-push"
        """
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{GMAIL_API_BASE}/users/me/watch",
                headers=self._headers,
                json={"topicName": topic_name, "labelIds": ["INBOX"]},
            )
            resp.raise_for_status()
            return resp.json()

    async def history_list(self, start_history_id: str) -> list[dict[str, Any]]:
        """
        Poll for new messages since start_history_id.
        Used as fallback when Pub/Sub webhook expires.
        """
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{GMAIL_API_BASE}/users/me/history",
                headers=self._headers,
                params={"startHistoryId": start_history_id, "historyTypes": "messageAdded"},
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("history", [])


def get_gmail_auth_url(state: str = "") -> str:
    """Generate the OAuth authorization URL for Gmail."""
    settings = get_settings()
    params = {
        "client_id": settings.gmail_client_id,
        "redirect_uri": settings.gmail_redirect_uri,
        "response_type": "code",
        "scope": " ".join(GMAIL_SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    from urllib.parse import urlencode
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


async def exchange_gmail_code(code: str) -> dict[str, Any]:
    """Exchange OAuth code for access + refresh tokens."""
    settings = get_settings()
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(GOOGLE_TOKEN_URL, data={
            "code": code,
            "client_id": settings.gmail_client_id,
            "client_secret": settings.gmail_client_secret,
            "redirect_uri": settings.gmail_redirect_uri,
            "grant_type": "authorization_code",
        })
        resp.raise_for_status()
        return resp.json()
