"""Metrics, including the commission arithmetic the report leans on."""
from __future__ import annotations

from datetime import date, timedelta

import pytest

from agent.analytics.metrics import (
    build_snapshot, latest_order_date, net_after_commission, required_uplift, summarise,
)
from agent.db import session_scope
from agent.models import Order


def make_order(session, order_no, day, hour, subtotal, gst=None, lines=3):
    session.add(Order(
        order_no=order_no, checkout_date=day, checkout_hour=hour,
        checkout_weekday=day.weekday(), subtotal=subtotal, gst=gst, lines_ordered=lines,
    ))


def test_required_uplift_exceeds_the_commission_rate():
    """The trap: a 30% commission needs ~43% uplift, because it is charged on
    the marked-up price. Matching the uplift to the rate loses margin."""
    assert required_uplift(0.30) == pytest.approx(0.4286, abs=1e-4)
    assert required_uplift(0.15) == pytest.approx(0.1765, abs=1e-4)
    assert required_uplift(0.25) == pytest.approx(0.3333, abs=1e-4)


def test_uplift_holds_the_in_store_take():
    in_store = 10.00
    marked_up = in_store * (1 + required_uplift(0.30))
    assert net_after_commission(marked_up, 0.30) == pytest.approx(in_store, abs=0.01)


def test_matching_uplift_to_commission_loses_money():
    """A 30% uplift against 30% commission nets less than the in-store price."""
    assert net_after_commission(10.00 * 1.30, 0.30) == pytest.approx(9.10, abs=0.01)


def test_summarise_on_empty_period_is_zeroed_not_an_error():
    period = summarise([], date(2026, 9, 1), date(2026, 9, 7))
    assert (period.orders, period.revenue, period.aov) == (0, 0.0, 0.0)
    assert period.days == 7


def test_snapshot_headline_and_comparison(temp_db):
    end = date(2026, 9, 7)
    with session_scope() as session:
        for i in range(7):                       # current week: 7 x $40
            make_order(session, f"c{i}", end - timedelta(days=i), 20, 40.0, gst=3.64)
        for i in range(7):                       # prior week: 7 x $20
            make_order(session, f"p{i}", end - timedelta(days=7 + i), 20, 20.0, gst=1.82)

    snapshot = build_snapshot(end, window_days=7)
    assert snapshot.current.orders == 7
    assert snapshot.current.aov == 40.0
    assert snapshot.previous.aov == 20.0
    assert snapshot.aov_change_pct == pytest.approx(100.0)
    assert snapshot.orders_change_pct == pytest.approx(0.0)


def test_snapshot_bands_and_small_orders(temp_db):
    end = date(2026, 9, 7)
    with session_scope() as session:
        make_order(session, "tiny", end, 20, 6.00)
        make_order(session, "mid", end, 20, 35.00)
        make_order(session, "big", end, 20, 120.00)

    snapshot = build_snapshot(end, window_days=1)
    assert snapshot.small_order_count == 1
    assert snapshot.small_order_revenue == 6.00
    assert [b["label"] for b in snapshot.value_bands] == ["$0-10", "$30-50", "$100+"]


def test_taxable_share_is_a_percentage_of_revenue(temp_db):
    end = date(2026, 9, 7)
    with session_scope() as session:
        # $110 of fully taxable goods carries $10 GST at the 1/11 rate.
        make_order(session, "booze", end, 20, 110.00, gst=10.00)
        make_order(session, "bread", end, 20, 110.00, gst=0.00)

    assert build_snapshot(end, window_days=1).taxable_share == pytest.approx(50.0, abs=0.1)


def test_taxable_share_is_capped_at_100_percent(temp_db):
    end = date(2026, 9, 7)
    with session_scope() as session:
        make_order(session, "odd", end, 20, 10.00, gst=5.00)  # implausible tax line
    assert build_snapshot(end, window_days=1).taxable_share == 100.0


def test_latest_order_date_on_empty_db_is_none(temp_db):
    assert latest_order_date() is None
