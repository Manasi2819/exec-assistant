"""
Notification Agent
===================
Phase 2 — Delivers notifications via Slack and Email.

This agent is template-only (no LLM cost) for simple notifications.
Complex notifications (e.g., MoM) include the generated content.

Notification types:
  - meeting_brief_ready  — 60min + 15min before meeting
  - draft_ready          — AI reply draft awaiting approval
  - mom_pending          — MoM generated, awaiting approval
  - action_overdue       — Daily overdue task digest
  - action_reminder      — 2-day pre-deadline reminder
  - followup_draft       — Follow-up email draft awaiting approval
"""
from __future__ import annotations
from datetime import datetime
from typing import Any, Literal
import httpx

from app.core.config import get_settings
from app.models.state import AgentState


NotificationType = Literal[
    "meeting_brief_ready", "draft_ready", "mom_pending",
    "action_overdue", "action_reminder", "followup_draft"
]


class NotificationPayload:
    def __init__(self, notif_type: NotificationType, title: str, body: str,
                 action_url: str | None = None, metadata: dict | None = None):
        self.type = notif_type
        self.title = title
        self.body = body
        self.action_url = action_url
        self.metadata = metadata or {}
        self.created_at = datetime.utcnow()

    def to_slack_block_kit(self) -> dict:
        """Format for Slack Block Kit with approve/edit/reject buttons where applicable."""
        blocks = [
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"*{self.title}*\n{self.body}"}
            }
        ]
        if self.type in ("draft_ready", "mom_pending", "followup_draft"):
            blocks.append({
                "type": "actions",
                "elements": [
                    {"type": "button", "text": {"type": "plain_text", "text": "✓ Approve"}, "style": "primary",
                     "action_id": f"approve_{self.type}", "value": self.metadata.get("draft_id", "")},
                    {"type": "button", "text": {"type": "plain_text", "text": "✎ Edit"},
                     "action_id": f"edit_{self.type}", "value": self.metadata.get("draft_id", "")},
                    {"type": "button", "text": {"type": "plain_text", "text": "✕ Reject"}, "style": "danger",
                     "action_id": f"reject_{self.type}", "value": self.metadata.get("draft_id", "")},
                ]
            })
        elif self.action_url:
            blocks.append({
                "type": "actions",
                "elements": [
                    {"type": "button", "text": {"type": "plain_text", "text": "View →"},
                     "url": self.action_url, "action_id": "view_link"}
                ]
            })
        return {"blocks": blocks}


async def notification_node(state: AgentState) -> AgentState:
    """LangGraph node: Dispatches notifications based on state."""
    # This node is non-blocking — notifications fail silently
    try:
        await _dispatch_notifications_from_state(state)
    except Exception:
        pass  # Notifications never block the pipeline
    return state


async def _dispatch_notifications_from_state(state: AgentState) -> None:
    """Route notifications based on what's in state."""
    settings = get_settings()

    if state.get("meeting_brief") and not state.get("error"):
        brief = state["meeting_brief"]
        payload = NotificationPayload(
            notif_type="meeting_brief_ready",
            title=f"📋 Brief Ready: {brief.meeting_title}",
            body=f"Your meeting brief is ready. {len(brief.important_topics)} topics, "
                 f"{len(brief.recommended_preparation)} prep items.",
            action_url=f"http://localhost:3000/meetings/{brief.meeting_id}/brief",
            metadata={"meeting_id": brief.meeting_id},
        )
        await _send_slack(payload, settings)

    if state.get("reply_draft") and state.get("approval_status") == "pending":
        draft = state["reply_draft"]
        payload = NotificationPayload(
            notif_type="draft_ready",
            title="✉️ AI Reply Draft Ready",
            body=f"Subject: {draft.subject}\n\n_{draft.body[:120]}..._",
            metadata={"draft_id": draft.draft_id},
        )
        await _send_slack(payload, settings)

    if state.get("mom") and state.get("approval_status") == "pending":
        mom = state["mom"]
        payload = NotificationPayload(
            notif_type="mom_pending",
            title=f"📝 MoM Ready: {mom.meeting_title}",
            body=f"{len(mom.decisions)} decisions, {len(mom.action_items)} action items captured. Awaiting your approval.",
            metadata={"mom_id": mom.mom_id},
        )
        await _send_slack(payload, settings)


async def send_notification(payload: NotificationPayload) -> bool:
    """
    Public API — send a notification.
    Tries Slack first; falls back to logging.
    Returns True if sent successfully.
    """
    settings = get_settings()
    return await _send_slack(payload, settings)


async def _send_slack(payload: NotificationPayload, settings) -> bool:
    """Post message to Slack via Bot Token webhook."""
    if not settings.slack_bot_token:
        # Log notification instead (dev mode)
        print(f"[NOTIFICATION] {payload.type}: {payload.title}")
        return False

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                "https://slack.com/api/chat.postMessage",
                headers={"Authorization": f"Bearer {settings.slack_bot_token}"},
                json={
                    "channel": "#executive-ai-assistant",
                    **payload.to_slack_block_kit(),
                    "text": payload.title,  # fallback for notifications
                },
            )
            data = resp.json()
            return data.get("ok", False)
    except Exception as exc:
        print(f"[NOTIFICATION] Slack send failed: {exc}")
        return False


async def send_overdue_digest(overdue_tasks: list[dict]) -> None:
    """Send a daily digest of overdue action items."""
    if not overdue_tasks:
        return

    lines = [f"• {t.get('owner_name', 'Unknown')}: {t.get('description', '')} (was due {t.get('due_date', 'TBD')})"
             for t in overdue_tasks[:10]]

    payload = NotificationPayload(
        notif_type="action_overdue",
        title=f"⚠️ {len(overdue_tasks)} Overdue Action Item(s)",
        body="\n".join(lines),
        action_url="http://localhost:3000/tasks",
    )
    settings = get_settings()
    await _send_slack(payload, settings)
