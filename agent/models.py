"""Schema.

Phase 1 populates `orders` and `actions_log` only. The remaining tables are
defined now so later phases add rows rather than migrations.
"""
from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import (
    Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Item(Base):
    __tablename__ = "items"

    id: Mapped[int] = mapped_column(primary_key=True)
    sku: Mapped[str] = mapped_column(String(64), unique=True)
    uber_item_id: Mapped[str | None] = mapped_column(String(64))
    name: Mapped[str] = mapped_column(String(255))
    category: Mapped[str | None] = mapped_column(String(128))
    price: Mapped[float | None] = mapped_column(Float)
    cost: Mapped[float | None] = mapped_column(Float)
    is_alcohol: Mapped[bool] = mapped_column(Boolean, default=False)
    stock_qty: Mapped[float | None] = mapped_column(Float)
    image_url: Mapped[str | None] = mapped_column(String(512))
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class MenuSnapshot(Base):
    __tablename__ = "menu_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True)
    taken_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    source: Mapped[str] = mapped_column(String(64))
    payload_json: Mapped[str] = mapped_column(Text)


class Order(Base):
    """One row per Uber Eats order.

    `checkout_hour` is the hour bucket MyFoodLink reports, not a precise
    timestamp: daytime checkouts arrive bucketed to even hours. Evening hours
    are reported individually. Compliance checks must account for that.
    """

    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_no: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    checkout_date: Mapped[date] = mapped_column(Date, index=True)
    checkout_hour: Mapped[int] = mapped_column(Integer)
    checkout_weekday: Mapped[int] = mapped_column(Integer)  # Monday=0
    dispatch_date: Mapped[date | None] = mapped_column(Date)
    subtotal: Mapped[float] = mapped_column(Float)
    discount: Mapped[float] = mapped_column(Float, default=0.0)
    gst: Mapped[float | None] = mapped_column(Float)
    lines_ordered: Mapped[int | None] = mapped_column(Integer)
    substitutions: Mapped[int | None] = mapped_column(Integer)
    not_supplied: Mapped[int | None] = mapped_column(Integer)
    marketplace: Mapped[str | None] = mapped_column(String(64))
    platform: Mapped[str | None] = mapped_column(String(64))
    order_state: Mapped[str | None] = mapped_column(String(32))
    source_file: Mapped[str | None] = mapped_column(String(255))

    @property
    def taxable_share(self) -> float | None:
        """Share of the order carrying GST.

        Alcohol and packaged goods carry GST; basic food does not, so this
        proxies product mix. It is a proxy, not a measurement - a fully
        taxable basket may be chips and soft drink rather than liquor.
        """
        from agent.config import settings

        if self.gst is None or not self.subtotal:
            return None
        return min(max(self.gst * settings.gst_divisor / self.subtotal, 0.0), 1.0)


class Promo(Base):
    __tablename__ = "promos"

    id: Mapped[int] = mapped_column(primary_key=True)
    promo_type: Mapped[str] = mapped_column(String(64))
    settings_json: Mapped[str] = mapped_column(Text)
    start: Mapped[date | None] = mapped_column(Date)
    end: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(32), default="proposed")
    spend: Mapped[float] = mapped_column(Float, default=0.0)
    result_json: Mapped[str | None] = mapped_column(Text)


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    external_id: Mapped[str | None] = mapped_column(String(128), unique=True)
    ts: Mapped[datetime] = mapped_column(DateTime)
    rating: Mapped[int | None] = mapped_column(Integer)
    text: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(String(64))
    reply_draft: Mapped[str | None] = mapped_column(Text)
    reply_status: Mapped[str] = mapped_column(String(32), default="none")


class ActionLog(Base):
    """Every external mutation, with before/after and who approved it."""

    __tablename__ = "actions_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    ts: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    actor: Mapped[str] = mapped_column(String(64))
    action: Mapped[str] = mapped_column(String(128))
    before: Mapped[str | None] = mapped_column(Text)
    after: Mapped[str | None] = mapped_column(Text)
    approved_by: Mapped[str | None] = mapped_column(String(64))


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(primary_key=True)
    ts: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    kind: Mapped[str] = mapped_column(String(64), index=True)
    severity: Mapped[str] = mapped_column(String(16), default="info")
    message: Mapped[str] = mapped_column(Text)
    dedupe_key: Mapped[str | None] = mapped_column(String(255))
    delivered: Mapped[bool] = mapped_column(Boolean, default=False)
    order_id: Mapped[int | None] = mapped_column(ForeignKey("orders.id"))

    __table_args__ = (UniqueConstraint("kind", "dedupe_key", name="uq_alert_dedupe"),)
