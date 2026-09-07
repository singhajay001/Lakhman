"""Dashboard and JSON endpoints.

Read-only by design: there is no route here that writes to Uber Eats, because
MyFoodLink owns every write to the storefront.
"""
from __future__ import annotations

from datetime import date, datetime

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import HTMLResponse, PlainTextResponse

from agent.analytics import compliance
from agent.analytics.metrics import build_snapshot, latest_order_date, load_orders
from agent.config import settings
from agent.db import init_db
from agent.reporting import weekly

app = FastAPI(title="Uber Eats storefront agent", version="0.1.0")


@app.on_event("startup")
def _startup() -> None:
    init_db()


def _resolve_end(end: str | None) -> date:
    if end is None:
        resolved = latest_order_date()
        if resolved is None:
            raise HTTPException(404, "no orders ingested yet")
        return resolved
    try:
        return datetime.strptime(end, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, "end must be YYYY-MM-DD") from None


@app.get("/health")
def health() -> dict:
    latest = latest_order_date()
    return {"status": "ok", "latest_order_date": str(latest) if latest else None}


@app.get("/api/snapshot")
def api_snapshot(end: str | None = None, days: int = Query(7, ge=1, le=365)) -> dict:
    snapshot = build_snapshot(_resolve_end(end), window_days=days)
    return {
        "current": snapshot.current.__dict__,
        "previous": snapshot.previous.__dict__ if snapshot.previous else None,
        "orders_change_pct": snapshot.orders_change_pct,
        "aov_change_pct": snapshot.aov_change_pct,
        "by_weekday": snapshot.by_weekday,
        "by_hour": snapshot.by_hour,
        "value_bands": snapshot.value_bands,
        "taxable_share_pct": snapshot.taxable_share,
    }


@app.get("/api/compliance")
def api_compliance(end: str | None = None, days: int = Query(28, ge=1, le=365)) -> dict:
    end_date = _resolve_end(end)
    start = date.fromordinal(end_date.toordinal() - days + 1)
    exposures = compliance.scan_orders(load_orders(start, end_date))
    return {
        "licence": settings.liquor_licence_number,
        "window": {"start": str(start), "end": str(end_date)},
        "exposures": [
            {**exposure.__dict__, "status": exposure.status.value,
             "likely_alcohol": exposure.likely_alcohol}
            for exposure in exposures
        ],
    }


@app.get("/report", response_class=PlainTextResponse)
def report(end: str | None = None, days: int = Query(7, ge=1, le=365)) -> str:
    return weekly.build(_resolve_end(end), window_days=days)


@app.get("/", response_class=HTMLResponse)
def dashboard(days: int = Query(28, ge=1, le=365)) -> str:
    end = latest_order_date()
    if end is None:
        return _page("<p class='empty'>No orders ingested yet. Drop the MyFoodLink exports "
                     "into <code>data/inbox</code> and run <code>make ingest</code>.</p>")

    snapshot = build_snapshot(end, window_days=days)
    exposures = [e for e in compliance.scan_orders(load_orders(snapshot.current.start, end))
                 if e.status is compliance.WindowStatus.OUTSIDE]

    tiles = "".join(
        f"<div class='tile'><span class='k'>{key}</span><span class='v'>{value}</span>"
        f"<span class='n'>{note}</span></div>"
        for key, value, note in [
            ("Orders", snapshot.current.orders,
             f"{snapshot.current.orders_per_day}/day"),
            ("Revenue", f"${snapshot.current.revenue:,.0f}",
             f"${snapshot.current.revenue_per_day:,.0f}/day"),
            ("Average order", f"${snapshot.current.aov:,.2f}",
             _fmt_delta(snapshot.aov_change_pct)),
            ("Items per basket", snapshot.current.avg_lines or "–",
             f"{snapshot.taxable_share or '–'}% GST-bearing"),
        ]
    )

    hours = snapshot.by_hour
    peak = max((v["orders"] for v in hours.values()), default=1)
    bars = "".join(
        f"<div class='bar'><span class='fill' style='height:{v['orders'] / peak * 100:.1f}%'"
        f" title='{v['orders']} orders'></span><span class='hl'>{h}</span></div>"
        for h, v in sorted(hours.items())
    )

    breach = ""
    if exposures:
        rows = "".join(
            f"<tr><td>{e.order_no}</td><td>{e.checkout_date}</td><td>{e.hour:02d}:00</td>"
            f"<td class='num'>${e.subtotal:,.2f}</td>"
            f"<td>{'likely alcohol' if e.likely_alcohol else 'unlikely'}</td></tr>"
            for e in exposures
        )
        breach = (f"<h2>Outside licensed hours <span class='count'>{len(exposures)}</span></h2>"
                  f"<p class='note'>Licence {settings.liquor_licence_number}. Checkout time is a "
                  f"proxy for supply time — check the docket before treating these as breaches.</p>"
                  f"<table><thead><tr><th>Order</th><th>Date</th><th>Hour</th><th>Value</th>"
                  f"<th>Basket</th></tr></thead><tbody>{rows}</tbody></table>")

    body = (
        f"<h1>{settings.store_name}</h1>"
        f"<p class='sub'>{snapshot.current.start:%-d %b} – {end:%-d %b %Y} · "
        f"last {days} days · read-only view</p>"
        f"<div class='tiles'>{tiles}</div>"
        f"<h2>Orders by hour</h2><div class='chart'>{bars}</div>"
        f"{breach}"
        f"<p class='note'><a href='/report?days={days}'>Weekly report</a> · "
        f"<a href='/api/snapshot?days={days}'>JSON</a></p>"
    )
    return _page(body)


def _fmt_delta(pct: float | None) -> str:
    return "vs prior period n/a" if pct is None else f"{pct:+.1f}% vs prior period"


def _page(body: str) -> str:
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Storefront agent</title><style>
:root{{color-scheme:light dark;--bg:#f5f7f3;--panel:#fff;--ink:#16211c;--ink2:#4c5852;
--ink3:#78827b;--rule:#dde2d8;--accent:#1e5b46;--bar:#2a78d6;--warn:#d03b3b}}
@media(prefers-color-scheme:dark){{:root{{--bg:#121613;--panel:#1a201c;--ink:#edf1ea;
--ink2:#a6b0a8;--ink3:#7d877f;--rule:#2a322c;--accent:#63b294;--bar:#3987e5}}}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--ink);
font:15px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;padding:2rem 1.25rem 4rem}}
main{{max-width:880px;margin:0 auto}}h1{{font-size:1.5rem;margin:0 0 .2rem}}
h2{{font-size:1.05rem;margin:2.2rem 0 .6rem}}
.sub{{color:var(--ink3);margin:0 0 1.6rem;font-size:.875rem}}
.tiles{{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1px;
background:var(--rule);border:1px solid var(--rule);border-radius:3px;overflow:hidden}}
.tile{{background:var(--panel);padding:1rem;display:flex;flex-direction:column;gap:.2rem}}
.tile .k{{font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;color:var(--ink3)}}
.tile .v{{font-size:1.6rem;font-weight:600;font-variant-numeric:tabular-nums}}
.tile .n{{font-size:.78rem;color:var(--ink3)}}
.chart{{display:flex;align-items:flex-end;gap:4px;height:170px;background:var(--panel);
border:1px solid var(--rule);border-radius:3px;padding:.85rem}}
.bar{{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;
height:100%;gap:.35rem}}
.fill{{width:100%;background:var(--bar);border-radius:3px 3px 0 0;min-height:2px;display:block}}
.hl{{font-size:.66rem;color:var(--ink3);font-variant-numeric:tabular-nums}}
table{{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--rule);
border-radius:3px;font-size:.875rem}}
th,td{{text-align:left;padding:.5rem .7rem;border-bottom:1px solid var(--rule)}}
th{{font-size:.66rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink3)}}
tbody tr:last-child td{{border-bottom:none}}td.num{{text-align:right;
font-variant-numeric:tabular-nums}}
.count{{color:var(--warn);font-variant-numeric:tabular-nums}}
.note{{font-size:.8rem;color:var(--ink3)}}a{{color:var(--accent)}}
.empty{{color:var(--ink2)}}code{{font-size:.85em}}
</style></head><body><main>{body}</main></body></html>"""
