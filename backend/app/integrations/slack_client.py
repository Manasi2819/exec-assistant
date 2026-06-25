"""
Slack Integration Client
========================
Delivers notifications with Block Kit interactive buttons.
Handles button press events (approve/edit/reject) via webhook.
"""
from __future__ import annotations
import hashlib, hmac, json, time
from typing import Any
import httpx

SLACK_API_BASE = "https://slack.com/api"


class SlackClient:
    def __init__(self, bot_token: str):
        self.bot_token = bot_token
        self._headers = {"Authorization": f"Bearer {bot_token}", "Content-Type": "application/json"}

    async def post_message(self, channel: str, text: str, blocks: list | None = None) -> dict[str, Any]:
        payload: dict[str, Any] = {"channel": channel, "text": text}
        if blocks:
            payload["blocks"] = blocks
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(f"{SLACK_API_BASE}/chat.postMessage", headers=self._headers, json=payload)
            resp.raise_for_status()
            return resp.json()

    async def update_message(self, channel: str, ts: str, text: str, blocks: list | None = None) -> dict[str, Any]:
        payload: dict[str, Any] = {"channel": channel, "ts": ts, "text": text}
        if blocks:
            payload["blocks"] = blocks
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(f"{SLACK_API_BASE}/chat.update", headers=self._headers, json=payload)
            resp.raise_for_status()
            return resp.json()

    async def post_approval_message(
        self, channel: str, title: str, preview: str,
        draft_id: str, notif_type: str = "draft_ready",
    ) -> dict[str, Any]:
        """Post interactive approval message with Block Kit buttons."""
        blocks = [
            {"type": "section", "text": {"type": "mrkdwn", "text": f"*{title}*\n_{preview[:200]}_"}},
            {"type": "actions", "elements": [
                {"type": "button", "text": {"type": "plain_text", "text": "✓ Approve"}, "style": "primary",
                 "action_id": f"approve_{notif_type}", "value": draft_id},
                {"type": "button", "text": {"type": "plain_text", "text": "✎ Edit"},
                 "action_id": f"edit_{notif_type}", "value": draft_id},
                {"type": "button", "text": {"type": "plain_text", "text": "✕ Reject"}, "style": "danger",
                 "action_id": f"reject_{notif_type}", "value": draft_id},
            ]},
        ]
        return await self.post_message(channel=channel, text=title, blocks=blocks)


def verify_slack_signature(body: bytes, timestamp: str, signature: str, signing_secret: str) -> bool:
    """Verify Slack request signature."""
    if abs(time.time() - int(timestamp)) > 300:
        return False  # Replay attack protection
    base = f"v0:{timestamp}:{body.decode()}"
    computed = "v0=" + hmac.new(signing_secret.encode(), base.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(computed, signature)
