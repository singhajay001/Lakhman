"""Anthropic API wrapper.

Prompts live in /prompts, not in string literals. The client degrades to a
deterministic fallback when no key is configured or the model declines, so a
missing key never breaks the weekly report.
"""
from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path

import anthropic

from agent.config import REPO_ROOT, settings

log = logging.getLogger(__name__)

PROMPT_DIR = REPO_ROOT / "prompts"
# Server-side fallback: on a policy decline the API re-runs the request on a
# fallback model inside the same call, routed by refusal category.
FALLBACK_BETA = "server-side-fallback-2026-07-01"


@lru_cache(maxsize=None)
def load_prompt(name: str) -> str:
    path = PROMPT_DIR / f"{name}.md"
    if not path.exists():
        raise FileNotFoundError(f"no prompt at {path}")
    return path.read_text(encoding="utf-8")


@lru_cache(maxsize=1)
def _client() -> anthropic.Anthropic | None:
    if not settings.anthropic_api_key:
        log.info("ANTHROPIC_API_KEY unset - LLM features disabled")
        return None
    return anthropic.Anthropic(api_key=settings.anthropic_api_key)


def generate(prompt_name: str, user_content: str, max_tokens: int = 2000) -> str | None:
    """Run a prompt. Returns None when unavailable or declined, never raises."""
    if not settings.enable_llm_narrative:
        return None
    client = _client()
    if client is None:
        return None

    try:
        response = client.beta.messages.create(
            model=settings.anthropic_model,
            max_tokens=max_tokens,
            system=load_prompt(prompt_name),
            thinking={"type": "adaptive"},
            betas=[FALLBACK_BETA],
            fallbacks="default",
            messages=[{"role": "user", "content": user_content}],
        )
    except anthropic.APIStatusError as exc:
        log.warning("Anthropic API error (%s): %s", exc.status_code, exc)
        return None
    except anthropic.APIConnectionError as exc:
        log.warning("could not reach the Anthropic API: %s", exc)
        return None

    # A refusal that survives the fallback chain returns 200 with no usable text.
    if response.stop_reason == "refusal":
        category = getattr(response.stop_details, "category", None)
        log.warning("model declined the request (category=%s)", category)
        return None

    text = "\n".join(block.text for block in response.content if block.type == "text").strip()
    return text or None
