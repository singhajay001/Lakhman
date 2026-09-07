"""Telegram notifications and the approval channel.

Phase 1 sends only; the inbound approval webhook arrives with Phase 3, which is
why `send` already threads a `dedupe_key` through - repeated alerts about the
same order should not wake the owner twice.
"""
from __future__ import annotations

import logging

import httpx2 as httpx
from sqlalchemy import select

from agent.config import settings
from agent.db import session_scope
from agent.models import Alert

log = logging.getLogger(__name__)
API_ROOT = "https://api.telegram.org"
MAX_MESSAGE_CHARS = 4096


def configured() -> bool:
    return bool(
        settings.enable_telegram
        and settings.telegram_bot_token
        and settings.telegram_chat_id
    )


def send_message(text: str) -> bool:
    """Send one message. Returns False rather than raising if it cannot."""
    if not configured():
        log.info("Telegram not configured - message not sent")
        return False

    body = text if len(text) <= MAX_MESSAGE_CHARS else text[: MAX_MESSAGE_CHARS - 1] + "…"
    url = f"{API_ROOT}/bot{settings.telegram_bot_token}/sendMessage"
    try:
        response = httpx.post(
            url,
            json={
                "chat_id": settings.telegram_chat_id,
                "text": body,
                "parse_mode": "Markdown",
                "disable_web_page_preview": True,
            },
            timeout=15.0,
        )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        log.error("Telegram send failed: %s", exc)
        return False
    return True


def raise_alert(kind: str, message: str, severity: str = "info",
                dedupe_key: str | None = None) -> bool:
    """Record an alert and send it, unless the same one was already sent."""
    with session_scope() as session:
        if dedupe_key:
            seen = session.scalars(
                select(Alert).where(Alert.kind == kind, Alert.dedupe_key == dedupe_key)
            ).first()
            if seen is not None:
                return False
        alert = Alert(kind=kind, severity=severity, message=message, dedupe_key=dedupe_key)
        session.add(alert)
        session.flush()
        alert.delivered = send_message(message)
        return alert.delivered
