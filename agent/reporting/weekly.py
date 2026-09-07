"""The weekly owner report.

Plain Markdown so it renders in Telegram, in a terminal, and in the dashboard
without a template engine in the middle. The LLM writes only the opening
narrative; every figure below it is computed.
"""
from __future__ import annotations

import json
from datetime import date

from agent.analytics import compliance
from agent.analytics.metrics import (
    Snapshot, build_snapshot, latest_order_date, load_orders,
    net_after_commission, required_uplift,
)
from agent.config import settings
from agent.llm import client as llm


def _money(value: float) -> str:
    return f"${value:,.2f}"


def _delta(pct: float | None) -> str:
    if pct is None:
        return "n/a"
    return f"{pct:+.1f}%"


def _narrative_input(snapshot: Snapshot) -> str:
    payload = {
        "window": {"start": str(snapshot.current.start), "end": str(snapshot.current.end),
                   "days": snapshot.current.days},
        "this_period": {
            "orders": snapshot.current.orders,
            "revenue": snapshot.current.revenue,
            "aov": snapshot.current.aov,
            "orders_per_day": snapshot.current.orders_per_day,
            "avg_lines": snapshot.current.avg_lines,
        },
        "previous_period": None if not snapshot.previous else {
            "orders": snapshot.previous.orders,
            "revenue": snapshot.previous.revenue,
            "aov": snapshot.previous.aov,
            "orders_per_day": snapshot.previous.orders_per_day,
        },
        "change_pct": {"orders_per_day": snapshot.orders_change_pct,
                       "aov": snapshot.aov_change_pct},
        "by_weekday": snapshot.by_weekday,
        "taxable_share_pct": snapshot.taxable_share,
        "orders_under_10": snapshot.small_order_count,
    }
    return json.dumps(payload, indent=2, default=str)


def build(end: date | None = None, window_days: int = 7) -> str:
    end = end or latest_order_date()
    if end is None:
        return "No orders ingested yet - drop the MyFoodLink exports into data/inbox and run `make ingest`."

    snapshot = build_snapshot(end, window_days=window_days)
    current, previous = snapshot.current, snapshot.previous
    lines: list[str] = []

    lines.append(f"# Uber Eats weekly report")
    lines.append(f"_{current.start:%-d %b} – {current.end:%-d %b %Y} · {settings.store_name}_\n")

    narrative = llm.generate("weekly_narrative", _narrative_input(snapshot))
    if narrative:
        lines.append(narrative + "\n")

    lines.append("## Headline\n")
    lines.append("| | This period | Previous | Change |")
    lines.append("|---|---:|---:|---:|")
    lines.append(f"| Orders | {current.orders} | {previous.orders if previous else '–'} "
                 f"| {_delta(snapshot.orders_change_pct)} |")
    lines.append(f"| Revenue | {_money(current.revenue)} "
                 f"| {_money(previous.revenue) if previous else '–'} | |")
    lines.append(f"| Average order | {_money(current.aov)} "
                 f"| {_money(previous.aov) if previous else '–'} | {_delta(snapshot.aov_change_pct)} |")
    lines.append(f"| Orders per day | {current.orders_per_day} "
                 f"| {previous.orders_per_day if previous else '–'} | |")
    lines.append(f"| Items per basket | {current.avg_lines or '–'} "
                 f"| {previous.avg_lines if previous else '–'} | |\n")

    net = net_after_commission(current.revenue)
    lines.append(f"After an assumed {settings.uber_commission_rate:.0%} commission you keep "
                 f"**{_money(net)}** of that, before cost of goods. Holding your in-store dollar "
                 f"margin needs an uplift of **{required_uplift():.1%}** on the shelf price, not "
                 f"{settings.uber_commission_rate:.0%} — commission is charged on the marked-up price.\n")

    if snapshot.by_weekday:
        lines.append("## By day\n")
        lines.append("| Day | Orders | Revenue | Avg order |")
        lines.append("|---|---:|---:|---:|")
        for day, values in snapshot.by_weekday.items():
            lines.append(f"| {day} | {int(values['orders'])} | {_money(values['revenue'])} "
                         f"| {_money(values['aov'])} |")
        lines.append("")

    if snapshot.value_bands:
        lines.append("## Order size\n")
        lines.append("| Band | Orders | % of orders | % of revenue |")
        lines.append("|---|---:|---:|---:|")
        for band in snapshot.value_bands:
            lines.append(f"| {band['label']} | {band['orders']} | {band['pct_orders']}% "
                         f"| {band['pct_revenue']}% |")
        lines.append("")

    if snapshot.small_order_count:
        keep = net_after_commission(snapshot.small_order_revenue / snapshot.small_order_count)
        lines.append(f"{snapshot.small_order_count} order(s) under $10 this period, averaging "
                     f"{_money(snapshot.small_order_revenue / snapshot.small_order_count)} — "
                     f"about {_money(keep)} kept each before goods and picking time.\n")

    if snapshot.taxable_share is not None:
        lines.append(f"**{snapshot.taxable_share}%** of revenue carried GST, which stands in for "
                     f"alcohol and packaged goods. This is a proxy from the tax line, not a "
                     f"product-level measurement.\n")

    lines.append(_compliance_section(current.start, current.end))
    lines.append("\n---\n_Figures from MyFoodLink exports. MyFoodLink owns the Uber Eats "
                 "integration; this agent only reads._")
    return "\n".join(lines)


def _compliance_section(start: date, end: date) -> str:
    exposures = compliance.scan_orders(load_orders(start, end))
    if not exposures:
        return "## Liquor licensed hours\n\nNo orders fell outside the licensed window this period."

    outside = [e for e in exposures if e.status is compliance.WindowStatus.OUTSIDE]
    straddling = [e for e in exposures if e.status is compliance.WindowStatus.STRADDLES]

    lines = ["## Liquor licensed hours\n"]
    lines.append(f"Licence {settings.liquor_licence_number} ({settings.liquor_licence_name}). "
                 "Checkout time is a proxy for supply time, so check the docket before "
                 "treating anything here as a breach.\n")
    if outside:
        lines.append(f"**{len(outside)} order(s) outside the licensed window:**\n")
        lines.append("| Order | Date | Hour | Value | GST-bearing | Likely alcohol |")
        lines.append("|---|---|---:|---:|---:|---|")
        for exposure in outside:
            share = "–" if exposure.taxable_share is None else f"{exposure.taxable_share:.0%}"
            lines.append(
                f"| {exposure.order_no} | {exposure.checkout_date} | {exposure.hour:02d}:00 "
                f"| {_money(exposure.subtotal)} | {share} "
                f"| {'yes' if exposure.likely_alcohol else 'unlikely'} |"
            )
        lines.append("")
    if straddling:
        lines.append(f"{len(straddling)} order(s) sat in an hour bucket that straddles the "
                     "boundary — ambiguous, not a breach.\n")
    return "\n".join(lines)
