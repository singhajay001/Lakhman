"""Ingest: schema tolerance, revision handling, idempotency."""
from __future__ import annotations

import textwrap

import pytest

from agent.ingest.myfoodlink import discover, ingest, read_orders, read_sales

ORDER_HEADER = ("Checkout Date,Checkout Hour,Checkout Day,Dispatch Date,Order #,Total,"
                "Order State,Discount Allowed,# lines ordered,# of substitutions,"
                "# of not supplied")
SALES_HEADER = "Shop,Order #,Total,Tax,Currency,Type,Date,Revision,Platform,Marketplace"


def write_orders(tmp_path, rows, name="orders_q1.csv", header=ORDER_HEADER):
    path = tmp_path / name
    path.write_text(header + "\n" + "\n".join(rows) + "\n")
    return path


def write_sales(tmp_path, rows, name="sales.csv"):
    path = tmp_path / name
    path.write_text(SALES_HEADER + "\n" + "\n".join(rows) + "\n")
    return path


ORDER_ROW = "06/09/2026,22,Sunday,06/09/2026,00734,29.95,en_route,0.0,2,0,0"
SALES_ROW = "Trafalgar,00734,$29.95,$2.72,AUD,Finalised,2026-09-06,2,Third Party,UberEats"


def test_reads_dates_day_first_not_month_first(tmp_path):
    frame = read_orders([write_orders(tmp_path, [ORDER_ROW])])
    assert frame.iloc[0]["checkout_date"].month == 9
    assert frame.iloc[0]["checkout_date"].day == 6


def test_missing_required_column_raises_rather_than_reading_the_wrong_one(tmp_path):
    path = write_orders(tmp_path, ["06/09/2026,22"], header="Checkout Date,Checkout Hour")
    with pytest.raises(ValueError, match="missing expected column"):
        read_orders([path])


def test_column_order_does_not_matter(tmp_path):
    reordered_header = ("Order #,Total,Checkout Hour,Checkout Date,Checkout Day,"
                        "Dispatch Date,Order State,Discount Allowed,# lines ordered")
    path = write_orders(tmp_path, ["00734,29.95,22,06/09/2026,Sunday,06/09/2026,en_route,0.0,2"],
                        header=reordered_header)
    frame = read_orders([path])
    assert frame.iloc[0]["order_no"] == "00734"
    assert frame.iloc[0]["subtotal"] == 29.95


def test_unparseable_dates_are_dropped_not_crashed_on(tmp_path):
    rows = [ORDER_ROW, "not-a-date,22,Sunday,,00999,10.00,en_route,0.0,1,0,0"]
    assert len(read_orders([write_orders(tmp_path, rows)])) == 1


def test_sales_keeps_highest_revision_and_drops_non_finalised(tmp_path):
    rows = [
        "Trafalgar,00181,$50.00,$4.55,AUD,Finalised,2026-03-11,2,Third Party,UberEats",
        "Trafalgar,00181,$0.00,$0.00,AUD,Adjusted,2026-03-11,4,Third Party,UberEats",
        SALES_ROW,
    ]
    sales = read_sales([write_sales(tmp_path, rows)])
    assert set(sales.index) == {"00181", "00734"}
    assert sales.loc["00181"]["Total"] == 50.00  # the Adjusted revision is excluded


def test_money_strings_are_parsed(tmp_path):
    row = "Trafalgar,00734,\"$1,234.50\",$112.23,AUD,Finalised,2026-09-06,2,Third Party,UberEats"
    sales = read_sales([write_sales(tmp_path, [row])])
    assert sales.loc["00734"]["Total"] == 1234.50


def test_discover_splits_inbox_by_filename(tmp_path):
    write_orders(tmp_path, [ORDER_ROW], name="storeordersQ3.csv")
    write_sales(tmp_path, [SALES_ROW], name="mysales2026.csv")
    orders, sales = discover(tmp_path)
    assert [p.name for p in orders] == ["storeordersQ3.csv"]
    assert [p.name for p in sales] == ["mysales2026.csv"]


def test_ingest_joins_gst_and_is_idempotent(tmp_path, temp_db):
    write_orders(tmp_path, [ORDER_ROW])
    write_sales(tmp_path, [SALES_ROW])

    first = ingest(tmp_path)
    assert (first.inserted, first.updated) == (1, 0)

    second = ingest(tmp_path)
    assert (second.inserted, second.updated, second.skipped) == (0, 0, 1)

    from sqlalchemy import select
    from agent.db import session_scope
    from agent.models import Order

    with session_scope() as session:
        order = session.scalars(select(Order)).one()
    assert order.gst == pytest.approx(2.72)
    assert order.checkout_weekday == 6  # Sunday
    assert order.taxable_share == pytest.approx(2.72 * 11 / 29.95)


def test_ingest_updates_a_changed_row(tmp_path, temp_db):
    write_orders(tmp_path, [ORDER_ROW])
    write_sales(tmp_path, [SALES_ROW])
    ingest(tmp_path)

    revised = "06/09/2026,22,Sunday,06/09/2026,00734,35.00,en_route,0.0,3,0,0"
    write_orders(tmp_path, [revised])
    result = ingest(tmp_path)
    assert (result.inserted, result.updated) == (0, 1)


def test_empty_inbox_is_not_an_error(tmp_path, temp_db):
    assert ingest(tmp_path).rows_parsed == 0


def test_order_without_a_sales_row_still_ingests(tmp_path, temp_db):
    write_orders(tmp_path, [ORDER_ROW])
    assert ingest(tmp_path).inserted == 1

    from sqlalchemy import select
    from agent.db import session_scope
    from agent.models import Order

    with session_scope() as session:
        order = session.scalars(select(Order)).one()
    assert order.gst is None
    assert order.taxable_share is None
