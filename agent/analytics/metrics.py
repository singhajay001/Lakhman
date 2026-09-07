"""Commercial metrics computed from ingested orders.

Everything here is derived from order-level data. There is no line-item detail
in the MyFoodLink export, so product mix is inferred from GST rather than
observed - see `taxable_share` on the Order model.
"""
from __future__ import annotations

import statistics
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, timedelta

from sqlalchemy import select

from agent.config import settings
from agent.db import session_scope
from agent.models import Order

WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday",
                 "Friday", "Saturday", "Sunday"]
VALUE_BANDS = [(0, 10), (10, 20), (20, 30), (30, 50), (50, 75), (75, 100), (100, None)]


@dataclass
class Period:
    """Headline figures for a date range."""

    start: date
    end: date
    orders: int
    revenue: float
    aov: float
    revenue_per_day: float
    orders_per_day: float
    avg_lines: float | None

    @property
    def days(self) -> int:
        return (self.end - self.start).days + 1


@dataclass
class Snapshot:
    current: Period
    previous: Period | None
    by_weekday: dict[str, dict[str, float]] = field(default_factory=dict)
    by_hour: dict[int, dict[str, float]] = field(default_factory=dict)
    value_bands: list[dict] = field(default_factory=list)
    taxable_share: float | None = None
    small_order_count: int = 0
    small_order_revenue: float = 0.0

    @property
    def orders_change_pct(self) -> float | None:
        if not self.previous or not self.previous.orders_per_day:
            return None
        return (self.current.orders_per_day / self.previous.orders_per_day - 1) * 100

    @property
    def aov_change_pct(self) -> float | None:
        if not self.previous or not self.previous.aov:
            return None
        return (self.current.aov / self.previous.aov - 1) * 100


def load_orders(start: date | None = None, end: date | None = None) -> list[Order]:
    stmt = select(Order)
    if start:
        stmt = stmt.where(Order.checkout_date >= start)
    if end:
        stmt = stmt.where(Order.checkout_date <= end)
    with session_scope() as session:
        return list(session.scalars(stmt.order_by(Order.checkout_date)).all())


def net_after_commission(gross: float, rate: float | None = None) -> float:
    """What the store keeps on a marked-up price after Uber's commission."""
    return gross * (1 - (settings.uber_commission_rate if rate is None else rate))


def required_uplift(rate: float | None = None) -> float:
    """Uplift needed to hold in-store dollar margin.

    Commission is charged on the marked-up price, so the uplift is
    rate/(1-rate), not rate: a 30% commission needs ~42.9%, not 30%.
    """
    commission = settings.uber_commission_rate if rate is None else rate
    return commission / (1 - commission)


def summarise(orders: list[Order], start: date, end: date) -> Period:
    if not orders:
        return Period(start, end, 0, 0.0, 0.0, 0.0, 0.0, None)
    revenue = sum(o.subtotal for o in orders)
    days = (end - start).days + 1
    lines = [o.lines_ordered for o in orders if o.lines_ordered is not None]
    return Period(
        start=start,
        end=end,
        orders=len(orders),
        revenue=round(revenue, 2),
        aov=round(revenue / len(orders), 2),
        revenue_per_day=round(revenue / days, 2),
        orders_per_day=round(len(orders) / days, 2),
        avg_lines=round(statistics.mean(lines), 2) if lines else None,
    )


def build_snapshot(end: date, window_days: int = 7, compare: bool = True) -> Snapshot:
    """Figures for the `window_days` ending on `end`, against the prior window."""
    start = end - timedelta(days=window_days - 1)
    current_orders = load_orders(start, end)
    current = summarise(current_orders, start, end)

    previous = None
    if compare:
        prev_end = start - timedelta(days=1)
        prev_start = prev_end - timedelta(days=window_days - 1)
        previous = summarise(load_orders(prev_start, prev_end), prev_start, prev_end)

    snapshot = Snapshot(current=current, previous=previous)
    if not current_orders:
        return snapshot

    weekday_totals: dict[int, list[float]] = defaultdict(list)
    hour_totals: dict[int, list[float]] = defaultdict(list)
    for order in current_orders:
        weekday_totals[order.checkout_weekday].append(order.subtotal)
        hour_totals[order.checkout_hour].append(order.subtotal)

    snapshot.by_weekday = {
        WEEKDAY_NAMES[day]: {
            "orders": len(values),
            "revenue": round(sum(values), 2),
            "aov": round(sum(values) / len(values), 2),
        }
        for day, values in sorted(weekday_totals.items())
    }
    snapshot.by_hour = {
        hour: {
            "orders": len(values),
            "revenue": round(sum(values), 2),
            "aov": round(sum(values) / len(values), 2),
        }
        for hour, values in sorted(hour_totals.items())
    }

    total_orders = len(current_orders)
    total_revenue = sum(o.subtotal for o in current_orders)
    for low, high in VALUE_BANDS:
        in_band = [o for o in current_orders
                   if o.subtotal >= low and (high is None or o.subtotal < high)]
        if not in_band:
            continue
        band_revenue = sum(o.subtotal for o in in_band)
        snapshot.value_bands.append({
            "label": f"${low}+" if high is None else f"${low}-{high}",
            "orders": len(in_band),
            "revenue": round(band_revenue, 2),
            "pct_orders": round(len(in_band) / total_orders * 100, 1),
            "pct_revenue": round(band_revenue / total_revenue * 100, 1),
        })

    gst_orders = [o for o in current_orders if o.gst is not None]
    if gst_orders:
        taxable = sum(o.gst * settings.gst_divisor for o in gst_orders)
        gross = sum(o.subtotal for o in gst_orders)
        snapshot.taxable_share = round(min(taxable / gross, 1.0) * 100, 1) if gross else None

    small = [o for o in current_orders if o.subtotal < 10]
    snapshot.small_order_count = len(small)
    snapshot.small_order_revenue = round(sum(o.subtotal for o in small), 2)
    return snapshot


def latest_order_date() -> date | None:
    with session_scope() as session:
        return session.scalars(
            select(Order.checkout_date).order_by(Order.checkout_date.desc()).limit(1)
        ).first()
