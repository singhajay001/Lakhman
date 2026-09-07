"""Licensed-hours checking for packaged liquor.

Two things make this less trivial than comparing a clock time to a window:

1. MyFoodLink reports a checkout *hour bucket*, not a timestamp. Evening hours
   arrive individually but daytime checkouts appear only on even hours, which
   looks like two-hour bucketing. A bucket that only partly overlaps the
   licensed window cannot be called a breach.
2. NSW restricts *supply*, not checkout. An order placed near the boundary may
   still have been supplied inside it.

So the check returns three states, and only ``OUTSIDE`` is reported as a likely
breach. ``STRADDLES`` is surfaced for a human to check against the docket.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from agent.config import settings

MINUTES_PER_DAY = 24 * 60


class WindowStatus(str, Enum):
    INSIDE = "inside"
    OUTSIDE = "outside"
    STRADDLES = "straddles"
    CLOSED_ALL_DAY = "closed_all_day"


def parse_hhmm(value: str) -> int:
    """"HH:MM" -> minutes from midnight. Accepts "24:00" for end-of-day."""
    hours, minutes = value.split(":")
    total = int(hours) * 60 + int(minutes)
    if not 0 <= total <= MINUTES_PER_DAY:
        raise ValueError(f"time out of range: {value}")
    return total


def window_for(weekday: int) -> tuple[int, int] | None:
    """Licensed window for a weekday, in minutes from midnight, or None."""
    if weekday not in settings.licensed_hours.windows:
        raise ValueError(f"weekday must be 0-6, got {weekday}")
    window = settings.licensed_hours.windows[weekday]
    if window is None:
        return None
    start, end = (parse_hhmm(v) for v in window)
    if end <= start:
        raise ValueError(f"window end must follow start: {window}")
    return start, end


def check_bucket(weekday: int, hour: int, bucket_hours: int = 1) -> WindowStatus:
    """Classify an hour bucket against that weekday's licensed window.

    The bucket covers ``[hour, hour + bucket_hours)``. Pass ``bucket_hours=2``
    for daytime hours if you have confirmed the export buckets them.
    """
    if not 0 <= hour <= 23:
        raise ValueError(f"hour must be 0-23, got {hour}")
    if bucket_hours < 1:
        raise ValueError("bucket_hours must be at least 1")

    window = window_for(weekday)
    if window is None:
        return WindowStatus.CLOSED_ALL_DAY

    start, end = window
    bucket_start = hour * 60
    bucket_end = min(bucket_start + bucket_hours * 60, MINUTES_PER_DAY)

    if bucket_start >= start and bucket_end <= end:
        return WindowStatus.INSIDE
    if bucket_end <= start or bucket_start >= end:
        return WindowStatus.OUTSIDE
    return WindowStatus.STRADDLES


@dataclass(frozen=True)
class LiquorExposure:
    """An order that sits outside the licensed window and looks alcoholic."""

    order_no: str
    checkout_date: str
    weekday: int
    hour: int
    status: WindowStatus
    subtotal: float
    taxable_share: float | None

    @property
    def likely_alcohol(self) -> bool:
        """GST-bearing enough that the basket is plausibly liquor.

        A proxy only - chips and soft drink carry GST too. Anything flagged here
        needs the docket checked before it is treated as a breach.
        """
        return self.taxable_share is not None and self.taxable_share > 0.95


def scan_orders(orders, bucket_hours: int = 1) -> list[LiquorExposure]:
    """Return orders whose checkout bucket falls outside the licensed window.

    ``STRADDLES`` is included so a human can check; ``INSIDE`` is not.
    """
    exposures: list[LiquorExposure] = []
    for order in orders:
        status = check_bucket(order.checkout_weekday, order.checkout_hour, bucket_hours)
        if status is WindowStatus.INSIDE:
            continue
        exposures.append(
            LiquorExposure(
                order_no=order.order_no,
                checkout_date=str(order.checkout_date),
                weekday=order.checkout_weekday,
                hour=order.checkout_hour,
                status=status,
                subtotal=order.subtotal,
                taxable_share=order.taxable_share,
            )
        )
    return exposures
