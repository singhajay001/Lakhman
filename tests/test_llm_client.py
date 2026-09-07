"""LLM wrapper. Every failure path must degrade to None, never raise."""
from __future__ import annotations

from types import SimpleNamespace

import anthropic
import pytest

from agent.llm import client as llm


class FakeResponse:
    def __init__(self, text=None, stop_reason="end_turn", category=None):
        blocks = []
        if text is not None:
            blocks.append(SimpleNamespace(type="text", text=text))
        # A thinking block should be ignored rather than concatenated into output.
        blocks.insert(0, SimpleNamespace(type="thinking", thinking=""))
        self.content = blocks
        self.stop_reason = stop_reason
        self.stop_details = SimpleNamespace(category=category) if category else None


def install(monkeypatch, behaviour):
    """Point the wrapper at a fake `client.beta.messages.create`."""
    calls = {}

    def create(**kwargs):
        calls.update(kwargs)
        if isinstance(behaviour, Exception):
            raise behaviour
        return behaviour

    fake = SimpleNamespace(beta=SimpleNamespace(messages=SimpleNamespace(create=create)))
    monkeypatch.setattr(llm, "_client", lambda: fake)
    monkeypatch.setattr(llm.settings, "enable_llm_narrative", True)
    return calls


def test_returns_text_and_ignores_thinking_blocks(monkeypatch):
    install(monkeypatch, FakeResponse("Orders held steady."))
    assert llm.generate("weekly_narrative", "{}") == "Orders held steady."


def test_request_uses_the_configured_model_and_adaptive_thinking(monkeypatch):
    calls = install(monkeypatch, FakeResponse("ok"))
    llm.generate("weekly_narrative", "{}")
    assert calls["model"] == llm.settings.anthropic_model
    assert calls["thinking"] == {"type": "adaptive"}
    assert llm.FALLBACK_BETA in calls["betas"]
    assert calls["fallbacks"] == "default"


def test_refusal_returns_none_rather_than_empty_text(monkeypatch):
    """A declined liquor-copy request must not emit a blank section."""
    install(monkeypatch, FakeResponse(None, stop_reason="refusal", category="policy"))
    assert llm.generate("weekly_narrative", "{}") is None


def test_blank_response_returns_none(monkeypatch):
    install(monkeypatch, FakeResponse("   "))
    assert llm.generate("weekly_narrative", "{}") is None


def test_api_status_error_is_swallowed(monkeypatch):
    response = SimpleNamespace(status_code=429, headers={}, request=SimpleNamespace())
    error = anthropic.APIStatusError("rate limited", response=response, body=None)
    install(monkeypatch, error)
    assert llm.generate("weekly_narrative", "{}") is None


def test_connection_error_is_swallowed(monkeypatch):
    install(monkeypatch, anthropic.APIConnectionError(request=SimpleNamespace()))
    assert llm.generate("weekly_narrative", "{}") is None


def test_disabled_by_flag(monkeypatch):
    install(monkeypatch, FakeResponse("should not be used"))
    monkeypatch.setattr(llm.settings, "enable_llm_narrative", False)
    assert llm.generate("weekly_narrative", "{}") is None


def test_missing_api_key_disables_the_client(monkeypatch):
    monkeypatch.setattr(llm.settings, "anthropic_api_key", None)
    llm._client.cache_clear()
    assert llm._client() is None
    llm._client.cache_clear()


def test_prompts_load_from_disk_not_string_literals():
    assert "weekly trading summary" in llm.load_prompt("weekly_narrative")


def test_unknown_prompt_raises():
    with pytest.raises(FileNotFoundError):
        llm.load_prompt("no_such_prompt")
