"""Licensed-hours logic. This is the module with licence risk attached."""
from __future__ import annotations

import pytest

from agent.analytics.compliance import (
    MINUTES_PER_DAY, WindowStatus, check_bucket, parse_hhmm, scan_orders, window_for,
)

MON, SAT, SUN = 0, 5, 6


class FakeOrder:
    def __init__(self, order_no, weekday, hour, subtotal=20.0, taxable_share=1.0):
        self.order_no = order_no
        self.checkout_date = "2026-09-06"
        self.checkout_weekday = weekday
        self.checkout_hour = hour
        self.subtotal = subtotal
        self.taxable_share = taxable_share


@pytest.mark.parametrize("value,expected", [("00:00", 0), ("05:00", 300),
                                            ("22:00", 1320), ("24:00", MINUTES_PER_DAY)])
def test_parse_hhmm(value, expected):
    assert parse_hhmm(value) == expected


@pytest.mark.parametrize("value", ["25:00", "24:01", "99:99"])
def test_parse_hhmm_rejects_out_of_range(value):
    with pytest.raises(ValueError):
        parse_hhmm(value)


def test_window_for_weekdays_and_sunday():
    assert window_for(MON) == (300, MINUTES_PER_DAY)
    assert window_for(SUN) == (600, 1320)


def test_window_for_rejects_bad_weekday():
    with pytest.raises(ValueError):
        window_for(7)


@pytest.mark.parametrize("weekday,hour,expected", [
    (MON, 5, WindowStatus.INSIDE),      # opens 05:00
    (MON, 23, WindowStatus.INSIDE),     # trades to midnight
    (MON, 4, WindowStatus.OUTSIDE),     # before open
    (MON, 3, WindowStatus.OUTSIDE),
    (MON, 0, WindowStatus.OUTSIDE),
    (SAT, 23, WindowStatus.INSIDE),
    (SUN, 10, WindowStatus.INSIDE),     # opens 10:00
    (SUN, 21, WindowStatus.INSIDE),     # last full hour
    (SUN, 22, WindowStatus.OUTSIDE),    # 22:00 cut-off - the real-world case
    (SUN, 23, WindowStatus.OUTSIDE),
    (SUN, 9, WindowStatus.OUTSIDE),     # before open
])
def test_check_bucket_hourly(weekday, hour, expected):
    assert check_bucket(weekday, hour) is expected


def test_two_hour_bucket_straddling_open_is_not_a_breach():
    """MyFoodLink buckets daytime checkouts, so 04:00-06:00 crosses the 05:00 open."""
    assert check_bucket(MON, 4, bucket_hours=2) is WindowStatus.STRADDLES


def test_two_hour_bucket_straddling_sunday_close():
    assert check_bucket(SUN, 21, bucket_hours=2) is WindowStatus.STRADDLES


def test_two_hour_bucket_fully_inside_is_inside():
    assert check_bucket(SUN, 10, bucket_hours=2) is WindowStatus.INSIDE


def test_bucket_clamps_at_midnight_rather_than_overflowing():
    assert check_bucket(MON, 23, bucket_hours=4) is WindowStatus.INSIDE


@pytest.mark.parametrize("hour", [-1, 24, 99])
def test_check_bucket_rejects_bad_hour(hour):
    with pytest.raises(ValueError):
        check_bucket(MON, hour)


def test_check_bucket_rejects_zero_bucket():
    with pytest.raises(ValueError):
        check_bucket(MON, 12, bucket_hours=0)


def test_closed_all_day(monkeypatch):
    from agent.config import settings
    monkeypatch.setitem(settings.licensed_hours.windows, SUN, None)
    assert check_bucket(SUN, 12) is WindowStatus.CLOSED_ALL_DAY


def test_scan_reports_only_orders_outside_the_window():
    orders = [
        FakeOrder("inside", SUN, 19),
        FakeOrder("late", SUN, 22),
        FakeOrder("early", MON, 3),
    ]
    flagged = {e.order_no for e in scan_orders(orders)}
    assert flagged == {"late", "early"}


def test_likely_alcohol_needs_a_near_fully_taxable_basket():
    fully_taxable = scan_orders([FakeOrder("a", SUN, 22, taxable_share=0.999)])[0]
    mixed = scan_orders([FakeOrder("b", SUN, 22, taxable_share=0.43)])[0]
    unknown = scan_orders([FakeOrder("c", SUN, 22, taxable_share=None)])[0]

    assert fully_taxable.likely_alcohol is True
    assert mixed.likely_alcohol is False
    assert unknown.likely_alcohol is False
