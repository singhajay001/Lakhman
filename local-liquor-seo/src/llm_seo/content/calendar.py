"""A1 - the rolling content calendar.

Three posts a week on fixed slots, themes rotated so none repeats inside the
configured gap, and dated occasions pinned to the nearest slot in their window.

The scheduler is greedy least-recently-used: for each slot it takes the eligible
theme that has gone longest without appearing. That maximises the minimum gap
between repeats, which is the best any schedule can do for a given pool - and
when the pool is too small to honour the configured gap, the builder says so
rather than quietly breaking the rule.
"""

from __future__ import annotations

import csv
from dataclasses import dataclass, field
from datetime import date, timedelta
from pathlib import Path

from ..business import Business, load_business
from ..paths import out_dir
from .config import ContentConfig, Occasion, Theme, load_content_config

COLUMNS = [
    "date", "slot", "post_type", "theme", "product_focus",
    "primary_keyword", "cta", "cta_url_path", "asset_needed", "status",
]

STATUS_PLANNED = "planned"
STATUS_NEEDS_PRODUCT = "needs_product_data"


@dataclass(frozen=True)
class CalendarEntry:
    date: date
    slot: str
    post_type: str
    theme: str
    product_focus: str
    primary_keyword: str
    cta: str
    cta_url_path: str
    asset_needed: str
    status: str
    occasion: str = ""
    occasion_date: date | None = None

    def as_row(self) -> dict[str, str]:
        return {
            "date": self.date.isoformat(),
            "slot": self.slot,
            "post_type": self.post_type,
            "theme": self.theme,
            "product_focus": self.product_focus,
            "primary_keyword": self.primary_keyword,
            "cta": self.cta,
            "cta_url_path": self.cta_url_path,
            "asset_needed": self.asset_needed,
            "status": self.status,
        }


@dataclass
class Calendar:
    entries: list[CalendarEntry]
    warnings: list[str] = field(default_factory=list)

    def __len__(self) -> int:
        return len(self.entries)

    def min_theme_gap_days(self, *, ignore_occasions: bool = False) -> int | None:
        """Smallest gap between two posts sharing a theme. None if none repeat.

        A dated occasion is pinned to its date, so it can legitimately land
        inside the rotation gap; `ignore_occasions` measures the rotation alone.
        """
        last_seen: dict[str, date] = {}
        smallest: int | None = None
        rows = [e for e in self.entries if not (ignore_occasions and e.occasion)]
        for entry in sorted(rows, key=lambda e: e.date):
            previous = last_seen.get(entry.theme)
            if previous is not None:
                gap = (entry.date - previous).days
                smallest = gap if smallest is None else min(smallest, gap)
            last_seen[entry.theme] = entry.date
        return smallest

    def write_csv(self, path: Path | None = None) -> Path:
        target = path or out_dir() / "calendar.csv"
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=COLUMNS)
            writer.writeheader()
            for entry in sorted(self.entries, key=lambda e: e.date):
                writer.writerow(entry.as_row())
        return target


# --------------------------------------------------------------------------
# dated occasions
# --------------------------------------------------------------------------


def easter_sunday(year: int) -> date:
    """Anonymous Gregorian computus. Easter moves, and Easter Thursday matters."""
    a = year % 19
    b, c = divmod(year, 100)
    d, e = divmod(b, 4)
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = divmod(c, 4)
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month, day = divmod(h + l - 7 * m + 114, 31)
    return date(year, month, day + 1)


def nth_weekday(year: int, month: int, weekday: int, nth: int) -> date:
    """`weekday` is 0=Monday .. 6=Sunday, matching date.weekday()."""
    first = date(year, month, 1)
    offset = (weekday - first.weekday()) % 7
    return first + timedelta(days=offset + 7 * (nth - 1))


def occasion_date(occasion: Occasion, year: int) -> date:
    if occasion.rule == "fixed":
        return date(year, occasion.month, occasion.day)  # type: ignore[arg-type]
    if occasion.rule == "nth_weekday":
        return nth_weekday(year, occasion.month, occasion.weekday, occasion.nth)  # type: ignore[arg-type]
    return easter_sunday(year) + timedelta(days=occasion.offset_days)


def occasions_in_window(
    content: ContentConfig, start: date, end: date
) -> dict[date, Occasion]:
    """Occasion dates falling in [start, end], across whatever years it spans."""
    found: dict[date, Occasion] = {}
    for year in range(start.year, end.year + 1):
        for occasion in content.occasions:
            when = occasion_date(occasion, year)
            if start <= when <= end:
                found[when] = occasion
    return found


# --------------------------------------------------------------------------
# the schedule
# --------------------------------------------------------------------------


def _slot_dates(start: date, days: int, slot_days: list[str]) -> list[tuple[date, str]]:
    from ..business import DAY_INDEX

    wanted = {DAY_INDEX[day]: day for day in slot_days}
    dates: list[tuple[date, str]] = []
    for offset in range(days):
        when = start + timedelta(days=offset)
        if when.weekday() in wanted:
            dates.append((when, wanted[when.weekday()]))
    return dates


def _asset_for(theme: Theme) -> str:
    if theme.requires_products:
        return "product shot"
    return {
        "cold_convenience": "cold room / fridge shot",
        "how_to": "glassware or pour shot",
        "food_pairing": "bottle beside food",
        "occasion": "gift or table setting",
        "community": "shopfront or team",
        "student_uni": "shopfront with street context",
        "seasonal": "seasonal shelf end",
        "zero_alcohol": "zero-alcohol shelf",
    }.get(theme.id, "shopfront")


def build_calendar(
    *,
    start: date,
    days: int = 90,
    business: Business | None = None,
    content: ContentConfig | None = None,
    have_products: bool = False,
    keywords: list[str] | None = None,
) -> Calendar:
    """Plan `days` of posts from `start`.

    `have_products` unlocks the themes that name a specific SKU. Without it they
    are held back, because a post that says "Just landed: {focus}" with nothing
    to put in the hole is worse than one fewer post.
    """
    biz = business or load_business()
    cfg = content or load_content_config()
    phrases = keywords or _content_phrases()

    end = start + timedelta(days=days - 1)
    slot_days = [slot.day for slot in cfg.cadence.slots]
    slot_names = {slot.day: slot.name for slot in cfg.cadence.slots}
    schedule = _slot_dates(start, days, slot_days)
    pinned = _pin_occasions(cfg, start, end, schedule, have_products=have_products)

    last_used: dict[str, date] = {}
    entries: list[CalendarEntry] = []
    warnings: list[str] = []

    for index, (when, day) in enumerate(schedule):
        pool = cfg.themes_for_slot(day, with_products=have_products)
        if not pool:
            warnings.append(f"{when}: no theme is eligible for the {day} slot")
            continue

        occasion = pinned.get(when)
        theme = _pick_theme(pool, cfg, occasion, last_used, when)
        last_used[theme.id] = when

        post_type = cfg.post_types[theme.post_type]
        if occasion is not None and occasion.theme == theme.id:
            post_type = cfg.post_types[occasion.post_type]

        entries.append(
            CalendarEntry(
                date=when,
                slot=slot_names[day],
                post_type=post_type,
                theme=theme.id,
                # Left empty even for themes that need one: the calendar plans,
                # it does not choose the bottle. A literal "TBC" here ended up
                # rendered into the caption as "Just landed: TBC".
                product_focus="",
                primary_keyword=_phrase_for(theme, phrases, index),
                cta=theme.cta.type,
                cta_url_path=theme.cta.path,
                asset_needed=_asset_for(theme),
                status=STATUS_NEEDS_PRODUCT if theme.requires_products else STATUS_PLANNED,
                occasion=occasion.label if occasion else "",
                occasion_date=_occasion_date_for(occasion, when) if occasion else None,
            )
        )

    warnings.extend(_gap_warnings(Calendar(entries), cfg, have_products))
    return Calendar(entries=entries, warnings=warnings)


def _occasion_date_for(occasion: Occasion, near: date) -> date:
    """The real date of the occasion the slot at `near` is running up to."""
    candidates = [occasion_date(occasion, year) for year in (near.year, near.year + 1)]
    return min((c for c in candidates if c >= near), default=candidates[0])


def _pin_occasions(
    content: ContentConfig,
    start: date,
    end: date,
    schedule: list[tuple[date, str]],
    *,
    have_products: bool = False,
    lead_days: int = 6,
) -> dict[date, Occasion]:
    """Assign each occasion to exactly one slot that can actually carry it.

    Two rules, both learned the hard way:

    * One slot per occasion. Letting every slot inside the window claim the same
      event produced three "occasion" posts in a week and wrecked the rotation.
    * The slot must be eligible for the occasion's theme. Melbourne Cup falls on
      a Tuesday, the `occasion` theme only runs on Saturdays, and pinning it to
      the Tuesday silently handed the Cup to whatever theme the rotation had
      queued - a how-to about glassware, in the first run.

    The last eligible slot on or before the date wins, so the post lands in the
    run-up rather than on the day itself.
    """
    ordered = sorted(schedule)
    claimed: dict[date, Occasion] = {}
    window_end = end + timedelta(days=lead_days)
    for when, occasion in sorted(occasions_in_window(content, start, window_end).items()):
        eligible = [
            slot_date
            for slot_date, day in ordered
            if when - timedelta(days=lead_days) <= slot_date <= when
            and slot_date not in claimed
            and any(
                theme.id == occasion.theme
                for theme in content.themes_for_slot(day, with_products=have_products)
            )
        ]
        if eligible:
            claimed[eligible[-1]] = occasion
    return claimed


def _pick_theme(
    pool: list[Theme],
    content: ContentConfig,
    occasion: Occasion | None,
    last_used: dict[str, date],
    when: date,
) -> Theme:
    if occasion is not None:
        for theme in pool:
            if theme.id == occasion.theme:
                return theme
    stale = date.min

    def sort_key(theme: Theme) -> tuple[date, str]:
        return (last_used.get(theme.id, stale), theme.id)

    return sorted(pool, key=sort_key)[0]


def _phrase_for(theme: Theme, phrases: list[str], index: int) -> str:
    """The local-intent phrase for this post, restricted to kinds the theme fits."""
    from .phrases import phrases_for

    allowed = {phrase.text for phrase in phrases_for(theme.phrase_kinds)}
    pool = [phrase for phrase in phrases if phrase in allowed] or phrases
    return pool[index % len(pool)]


def _content_phrases() -> list[str]:
    from .phrases import load_phrases

    return [phrase.text for phrase in load_phrases()]


def _gap_warnings(
    calendar: Calendar, content: ContentConfig, have_products: bool
) -> list[str]:
    required = content.cadence.min_theme_gap_days
    actual = calendar.min_theme_gap_days(ignore_occasions=True)
    if actual is None or actual >= required:
        return []

    usable = len({theme.id for slot in content.cadence.slots
                  for theme in content.themes_for_slot(slot.day, with_products=have_products)})
    needed = -(-required * content.cadence.posts_per_week // 7)
    message = (
        f"themes repeat every {actual} days, short of the {required}-day rule: "
        f"{usable} themes are usable but {needed} are needed at "
        f"{content.cadence.posts_per_week} posts a week."
    )
    if not have_products:
        held = sum(1 for theme in content.themes if theme.requires_products)
        message += f" Add data/products.csv to unlock {held} more."
    return [message]
