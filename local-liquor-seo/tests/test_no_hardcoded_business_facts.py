"""Acceptance guard: no file outside config/ and .env may hardcode a business
fact. Every NAP detail, URL and licence detail is read from config/business.yaml
at runtime, so changing the phone number is a one-line config edit.

The patterns are derived from the config itself, so this test contains no
literals of its own and cannot match itself.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest
import yaml

from llm_seo.paths import project_root

SKIP_DIRS = {
    ".git", ".venv", "__pycache__", ".pytest_cache", "htmlcov", "dist", "build",
    "config",          # the source of truth lives here
    "data", "out",     # generated: captions legitimately contain the real details
}
SKIP_SUFFIXES = {".pyc", ".lock", ".png", ".jpg", ".jpeg", ".webp", ".ico"}
SKIP_NAMES = {".env", ".env.example", "uv.lock"}


def tracked_files() -> list[Path]:
    root = project_root()
    files: list[Path] = []
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if set(path.relative_to(root).parts) & SKIP_DIRS:
            continue
        if path.suffix in SKIP_SUFFIXES or path.name in SKIP_NAMES:
            continue
        files.append(path)
    return files


def secrets_from_config() -> dict[str, str]:
    with (project_root() / "config" / "business.yaml").open(encoding="utf-8") as handle:
        raw = yaml.safe_load(handle)
    return {
        "phone (display)": raw["contact"]["phone_display"],
        "phone (digits)": re.sub(r"\D", "", raw["contact"]["phone_display"]),
        "phone (e164)": raw["contact"]["phone_e164"],
        "street address": raw["address"]["line1"],
        "site host": raw["website"]["host"],
        "licence number": raw["licence"]["number"],
    }


@pytest.mark.parametrize("label,value", sorted(secrets_from_config().items()))
def test_business_facts_are_not_hardcoded_outside_config(label, value):
    offenders = []
    for path in tracked_files():
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        if value in text:
            offenders.append(str(path.relative_to(project_root())))
    assert not offenders, f"{label} is hardcoded in: {offenders}"


def test_the_trading_name_never_appears_in_source():
    with (project_root() / "config" / "business.yaml").open(encoding="utf-8") as handle:
        name = yaml.safe_load(handle)["identity"]["trading_name"]
    offenders = [
        str(path)
        for path in (project_root() / "src").rglob("*.py")
        if name in path.read_text(encoding="utf-8")
    ]
    assert not offenders, f"trading name hardcoded in: {offenders}"


def test_no_api_key_literals_in_the_tree():
    """Keys arrive through .env only. Catch the obvious shapes."""
    patterns = [
        re.compile(r"AIza[0-9A-Za-z_\-]{35}"),          # Google API key
        re.compile(r"\bsk-[A-Za-z0-9]{20,}\b"),          # generic secret key
        re.compile(r"ya29\.[0-9A-Za-z_\-]{20,}"),        # Google OAuth token
    ]
    offenders = []
    for path in tracked_files():
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for pattern in patterns:
            if pattern.search(text):
                offenders.append(f"{path.name}: {pattern.pattern}")
    assert not offenders, offenders
