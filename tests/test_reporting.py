"""The weekly report is the Phase 1 deliverable - it must render without an LLM."""
from __future__ import annotations

from datetime import date, timedelta

from agent.db import session_scope
from agent.models import Order
from agent.reporting import weekly


def seed(session, end, count=7, subtotal=40.0, hour=20, weekday_offset=0):
    for i in range(count):
        day = end - timedelta(days=i)
        session.add(Order(
            order_no=f"o{i}", checkout_date=day, checkout_hour=hour,
            checkout_weekday=day.weekday(), subtotal=subtotal, gst=subtotal / 11,
            lines_ordered=3,
        ))


def test_empty_database_gives_guidance_not_a_traceback(temp_db):
    assert "No orders ingested yet" in weekly.build()


def test_report_renders_without_an_llm(temp_db, monkeypatch):
    monkeypatch.setattr(weekly.llm.settings, "enable_llm_narrative", False)
    end = date(2026, 9, 7)
    with session_scope() as session:
        seed(session, end)

    report = weekly.build(end, window_days=7)
    assert "# Uber Eats weekly report" in report
    assert "## Headline" in report
    assert "$280.00" in report        # 7 x $40
    assert "42.9%" in report          # required uplift at 30% commission


def test_narrative_is_included_when_available(temp_db, monkeypatch):
    monkeypatch.setattr(weekly.llm, "generate", lambda *a, **k: "A quiet week.")
    end = date(2026, 9, 7)
    with session_scope() as session:
        seed(session, end)
    assert "A quiet week." in weekly.build(end, window_days=7)


def test_licensed_hours_section_flags_a_late_sunday_order(temp_db, monkeypatch):
    monkeypatch.setattr(weekly.llm, "generate", lambda *a, **k: None)
    end = date(2026, 9, 6)  # a Sunday
    with session_scope() as session:
        session.add(Order(
            order_no="00734", checkout_date=end, checkout_hour=22,
            checkout_weekday=end.weekday(), subtotal=29.95, gst=2.72, lines_ordered=2,
        ))

    report = weekly.build(end, window_days=1)
    assert "outside the licensed window" in report
    assert "LIQP700301260" in report
    assert "00734" in report
    assert "check the docket" in report  # never asserts a breach outright


def test_clean_period_says_so(temp_db, monkeypatch):
    monkeypatch.setattr(weekly.llm, "generate", lambda *a, **k: None)
    end = date(2026, 9, 5)  # a Saturday
    with session_scope() as session:
        session.add(Order(
            order_no="ok", checkout_date=end, checkout_hour=19,
            checkout_weekday=end.weekday(), subtotal=40.0, gst=3.64, lines_ordered=3,
        ))
    assert "No orders fell outside the licensed window" in weekly.build(end, window_days=1)
