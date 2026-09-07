"""Ingest MyFoodLink exports.

MyFoodLink owns the Uber Eats integration and all writes to the menu. This
agent only reads. Two exports are consumed:

* **orders** - one row per order: date, hour bucket, weekday, total, line count,
  fulfilment counters. Split across quarterly files.
* **sales** - one row per order *revision*: totals, GST, platform, marketplace.
  Only ``Finalised`` rows at the highest revision count.

They join on ``Order #``. Ingestion is idempotent: re-running over the same
files updates rows in place rather than duplicating them.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

import pandas as pd
from sqlalchemy import select

from agent.db import session_scope
from agent.models import Order

log = logging.getLogger(__name__)

ORDER_DATE_FORMAT = "%d/%m/%Y"
MONEY = ["Total", "Tax", "Product Total", "Product Tax", "Charge Total", "Charge Tax"]

# Export headers -> safe attribute names. Mapping by name rather than position
# means a reordered or widened export still ingests correctly; a *renamed*
# column raises in `_require_columns` instead of silently reading the wrong one.
ORDER_COLUMNS = {
    "Order #": "order_no",
    "Checkout Date": "checkout_date_raw",
    "Dispatch Date": "dispatch_date_raw",
    "Checkout Hour": "checkout_hour",
    "Total": "subtotal",
    "Discount Allowed": "discount",
    "# lines ordered": "lines_ordered",
    "# of substitutions": "substitutions",
    "# of not supplied": "not_supplied",
    "Order State": "order_state",
}
REQUIRED_ORDER_COLUMNS = ["Order #", "Checkout Date", "Checkout Hour", "Total"]
NUMERIC_ORDER_COLUMNS = [
    "subtotal", "checkout_hour", "lines_ordered",
    "substitutions", "not_supplied", "discount",
]


def _require_columns(frame: pd.DataFrame, required: list[str], source: str) -> None:
    missing = [column for column in required if column not in frame.columns]
    if missing:
        raise ValueError(f"{source} is missing expected column(s): {', '.join(missing)}")


@dataclass
class IngestResult:
    files_read: int
    rows_parsed: int
    inserted: int
    updated: int
    skipped: int

    def __str__(self) -> str:
        return (
            f"{self.files_read} file(s), {self.rows_parsed} rows -> "
            f"{self.inserted} inserted, {self.updated} updated, {self.skipped} skipped"
        )


def _money(series: pd.Series) -> pd.Series:
    """Strip $ and thousands separators, coerce to float."""
    return pd.to_numeric(series.astype(str).str.replace(r"[$,]", "", regex=True), errors="coerce")


def read_orders(paths: list[Path]) -> pd.DataFrame:
    frames = []
    for path in sorted(paths):
        frame = pd.read_csv(path, dtype=str)
        _require_columns(frame, REQUIRED_ORDER_COLUMNS, path.name)
        frame = frame.rename(columns=ORDER_COLUMNS)
        frame["source_file"] = path.name
        frames.append(frame)
    if not frames:
        return pd.DataFrame()

    orders = pd.concat(frames, ignore_index=True)
    orders["checkout_date"] = pd.to_datetime(
        orders["checkout_date_raw"], format=ORDER_DATE_FORMAT, errors="coerce"
    )
    orders["dispatch_date"] = pd.to_datetime(
        orders.get("dispatch_date_raw"), format=ORDER_DATE_FORMAT, errors="coerce"
    )
    for column in NUMERIC_ORDER_COLUMNS:
        if column in orders:
            orders[column] = pd.to_numeric(orders[column], errors="coerce")

    bad_dates = int(orders["checkout_date"].isna().sum())
    if bad_dates:
        log.warning("dropping %d order row(s) with unparseable checkout date", bad_dates)
    return orders.dropna(subset=["checkout_date", "order_no", "subtotal", "checkout_hour"])


def read_sales(paths: list[Path]) -> pd.DataFrame:
    """Finalised rows only, deduplicated to the highest revision per order."""
    frames = [pd.read_csv(path, dtype=str) for path in sorted(paths)]
    if not frames:
        return pd.DataFrame()

    sales = pd.concat(frames, ignore_index=True)
    _require_columns(sales, ["Order #", "Total", "Tax", "Type", "Revision"], "sales export")
    for column in MONEY:
        if column in sales:
            sales[column] = _money(sales[column])
    sales["Revision"] = pd.to_numeric(sales.get("Revision"), errors="coerce")

    sales = sales[sales["Type"] == "Finalised"]
    return (
        sales.sort_values("Revision")
        .drop_duplicates(subset="Order #", keep="last")
        .set_index("Order #")
    )


def discover(inbox: Path) -> tuple[list[Path], list[Path]]:
    """Split the inbox into order and sales exports by filename."""
    order_files = sorted(p for p in inbox.glob("*.csv") if "order" in p.name.lower())
    sales_files = sorted(p for p in inbox.glob("*.csv") if "sales" in p.name.lower())
    return order_files, sales_files


def ingest(inbox: Path) -> IngestResult:
    order_files, sales_files = discover(inbox)
    orders = read_orders(order_files)
    sales = read_sales(sales_files)

    if orders.empty:
        log.warning("no order rows found in %s", inbox)
        return IngestResult(len(order_files) + len(sales_files), 0, 0, 0, 0)

    inserted = updated = skipped = 0
    with session_scope() as session:
        existing = {
            row.order_no: row
            for row in session.scalars(select(Order)).all()
        }
        for row in orders.to_dict("records"):
            order_no = str(row["order_no"])
            sale = sales.loc[order_no] if order_no in sales.index else None
            checkout = row["checkout_date"]
            dispatch = row.get("dispatch_date")

            values = dict(
                checkout_date=checkout.date(),
                checkout_hour=int(row["checkout_hour"]),
                checkout_weekday=int(checkout.weekday()),
                dispatch_date=dispatch.date() if pd.notna(dispatch) else None,
                subtotal=float(row["subtotal"]),
                discount=_opt_float(row.get("discount")) or 0.0,
                gst=_opt_float(sale["Tax"]) if sale is not None else None,
                lines_ordered=_opt_int(row.get("lines_ordered")),
                substitutions=_opt_int(row.get("substitutions")),
                not_supplied=_opt_int(row.get("not_supplied")),
                marketplace=sale["Marketplace"] if sale is not None else None,
                platform=sale["Platform"] if sale is not None else None,
                order_state=row.get("order_state"),
                source_file=row["source_file"],
            )

            current = existing.get(order_no)
            if current is None:
                session.add(Order(order_no=order_no, **values))
                inserted += 1
                continue
            if all(getattr(current, key) == value for key, value in values.items()):
                skipped += 1
                continue
            for key, value in values.items():
                setattr(current, key, value)
            updated += 1

    return IngestResult(
        files_read=len(order_files) + len(sales_files),
        rows_parsed=len(orders),
        inserted=inserted,
        updated=updated,
        skipped=skipped,
    )


def _opt_int(value) -> int | None:
    return None if value is None or pd.isna(value) else int(value)


def _opt_float(value) -> float | None:
    return None if value is None or pd.isna(value) else float(value)
