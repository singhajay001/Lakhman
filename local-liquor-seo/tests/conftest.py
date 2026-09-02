from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault("LLM_SEO_ROOT", str(ROOT))
sys.path.insert(0, str(ROOT / "src"))

from llm_seo import business as business_module  # noqa: E402
from llm_seo.compliance import footer  # noqa: E402


@pytest.fixture(scope="session")
def biz():
    business_module.reset_caches()
    return business_module.load_business()


@pytest.fixture(scope="session")
def terms():
    return business_module.load_blocklist()


@pytest.fixture(scope="session")
def compliant_footer(biz) -> str:
    return footer(biz)


@pytest.fixture()
def alcohol_post(biz, compliant_footer):
    """Build a caption that differs from a known-good one only where a test wants."""

    def _make(body: str) -> str:
        return f"{body}\n\n{compliant_footer}"

    return _make
