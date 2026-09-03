"""Loads and validates config/business.yaml.

No business fact - name, address, phone, URL, licence number, hours - may be
written into any module under src/. It all arrives through here.
"""

from __future__ import annotations

import functools
import re
from pathlib import Path
from typing import Annotated, Any, Literal
from urllib.parse import urlsplit

import yaml
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from . import plus_code as olc
from .paths import config_dir

DAYS: tuple[str, ...] = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
DAY_INDEX: dict[str, int] = {day: i for i, day in enumerate(DAYS)}

_HHMM = re.compile(r"^(?P<h>\d{1,2}):(?P<m>\d{2})$")


def parse_hhmm(value: str) -> int:
    """'08:00' -> 480. Accepts '24:00' as end-of-day (1440)."""
    match = _HHMM.match(value.strip())
    if not match:
        raise ValueError(f"expected HH:MM, got {value!r}")
    hours, minutes = int(match["h"]), int(match["m"])
    if minutes > 59 or hours > 24 or (hours == 24 and minutes != 0):
        raise ValueError(f"not a valid time of day: {value!r}")
    return hours * 60 + minutes


def fmt_hhmm(minutes: int) -> str:
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def fmt_12h(minutes: int) -> str:
    """480 -> '8am', 1290 -> '9.30pm'. The form used in customer-facing copy."""
    if minutes in (0, 1440):
        return "midnight"
    if minutes == 720:
        return "midday"
    hour24, minute = divmod(minutes, 60)
    meridiem = "am" if hour24 < 12 else "pm"
    hour12 = hour24 % 12 or 12
    return f"{hour12}{f'.{minute:02d}' if minute else ''}{meridiem}"


class _Model(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class Identity(_Model):
    trading_name: str
    short_name: str
    positioning: str
    instagram_handle: str


class Address(_Model):
    line1: str
    suburb: str
    state: str
    postcode: str
    country_code: str
    formatted: str

    @model_validator(mode="after")
    def _formatted_agrees(self) -> "Address":
        for part in (self.line1, self.suburb, self.state, self.postcode):
            if part not in self.formatted:
                raise ValueError(
                    f"address.formatted must contain every component; missing {part!r}"
                )
        return self


class Contact(_Model):
    phone_display: str
    phone_e164: str

    @field_validator("phone_e164")
    @classmethod
    def _e164(cls, value: str) -> str:
        if not re.fullmatch(r"\+\d{8,15}", value):
            raise ValueError("phone_e164 must look like +61400000000")
        return value

    @property
    def phone_digits(self) -> str:
        return re.sub(r"\D", "", self.phone_display)


class Geo(_Model):
    lat: float | None = None
    lng: float | None = None
    plus_code: str | None = None
    source: str | None = None
    verified: bool = False

    @field_validator("lat")
    @classmethod
    def _lat_range(cls, value: float | None) -> float | None:
        if value is not None and not -90.0 <= value <= 90.0:
            raise ValueError("geo.lat is out of range")
        return value

    @field_validator("lng")
    @classmethod
    def _lng_range(cls, value: float | None) -> float | None:
        if value is not None and not -180.0 <= value <= 180.0:
            raise ValueError("geo.lng is out of range")
        return value

    @field_validator("plus_code")
    @classmethod
    def _plus_code_shape(cls, value: str | None) -> str | None:
        if value is not None and not olc.is_full_code(value):
            raise ValueError(
                f"geo.plus_code {value!r} is not a full 10-digit code. Google shows "
                "the short form; prepend the 4-character area prefix."
            )
        return value

    @property
    def is_resolved(self) -> bool:
        return self.lat is not None and self.lng is not None

    def require(self) -> tuple[float, float]:
        if not self.is_resolved:
            raise ConfigIncomplete(
                "geo.lat / geo.lng are unset in config/business.yaml. "
                "Resolve them from the Places API details response for the store's "
                "place_id, then set geo.verified: true."
            )
        return float(self.lat), float(self.lng)  # type: ignore[arg-type]


class Website(_Model):
    canonical_url: str
    host: str
    allowed_hosts: list[str]
    site_paths: list[str]
    site_paths_source: str = "seeded-manually"
    site_paths_crawled_at: str | None = None

    @field_validator("canonical_url")
    @classmethod
    def _https(cls, value: str) -> str:
        if not value.startswith("https://"):
            raise ValueError("canonical_url must be https")
        return value

    @field_validator("site_paths")
    @classmethod
    def _paths(cls, value: list[str]) -> list[str]:
        if "/" not in value:
            raise ValueError("site_paths must include the site root '/'")
        for path in value:
            if not path.startswith("/"):
                raise ValueError(f"site_paths entries must start with '/': {path!r}")
        return value

    @model_validator(mode="after")
    def _host_agrees(self) -> "Website":
        if urlsplit(self.canonical_url).netloc != self.host:
            raise ValueError("website.host must match the host in canonical_url")
        if self.host not in self.allowed_hosts:
            raise ValueError("website.allowed_hosts must include the canonical host")
        return self

    def normalise_path(self, path: str) -> str:
        """'/specials/' and '/specials' are the same page; '/' stays '/'."""
        cleaned = "/" + path.strip().strip("/")
        return cleaned if cleaned != "/" else "/"

    def knows_path(self, path: str) -> bool:
        known = {self.normalise_path(p) for p in self.site_paths}
        return self.normalise_path(path) in known

    def url_for(self, path: str) -> str:
        if not self.knows_path(path):
            raise ValueError(
                f"{path!r} is not in website.site_paths - a CTA to a 404 is worse "
                "than no CTA. Re-crawl the sitemap or add the path to business.yaml."
            )
        normalised = self.normalise_path(path)
        base = self.canonical_url.rstrip("/")
        return f"{base}/" if normalised == "/" else f"{base}{normalised}"


class Delivery(_Model):
    name: str
    url: str | None = None


class Services(_Model):
    delivery: list[Delivery]
    click_and_collect: bool
    parking: str
    payments: list[str]
    # Unknown (None) is a real state: the Q&A generator marks the matching
    # question as needing an answer rather than guessing on the operator's behalf.
    ice: bool | None = None
    gift_wrapping: bool | None = None
    gift_cards: bool | None = None
    phone_orders: bool | None = None
    bulk_orders: bool | None = None
    card_surcharge: str | None = None
    price_match: bool | None = None
    cold_room: bool = True
    id_policy: str = ""

    def unanswered(self) -> list[str]:
        return [
            name
            for name in ("ice", "gift_wrapping", "gift_cards", "phone_orders",
                         "bulk_orders", "card_surcharge", "price_match")
            if getattr(self, name) is None
        ]


class GoogleProfile(_Model):
    place_id: str | None = None
    primary_category: str | None = None
    primary_category_as_reported: str | None = None
    primary_category_verified: bool = False
    secondary_categories: list[str] = Field(default_factory=list)
    acceptable_primary_categories: list[str] = Field(default_factory=list)
    flagged_primary_categories: list[str] = Field(default_factory=list)
    candidate_secondary_categories: list[str] = Field(default_factory=list)
    cloud_project_number: str | int | None = None
    cloud_project_id: str | None = None
    api_write_access: Literal["unknown", "requested", "granted", "denied"] = "unknown"
    location_resource_name: str | None = None

    @model_validator(mode="after")
    def _category_lists_are_disjoint(self) -> "GoogleProfile":
        clash = set(self.acceptable_primary_categories) & set(self.flagged_primary_categories)
        if clash:
            raise ValueError(f"a category cannot be both acceptable and flagged: {sorted(clash)}")
        return self

    def category_status(self) -> tuple[str, str]:
        """(status, message) for the primary category.

        Primary category is the single biggest map-pack lever, so the audit
        reports on it in four distinct states rather than a bare pass/fail.
        """
        if not self.primary_category:
            return "unset", "google.primary_category is unset."
        if self.primary_category in self.flagged_primary_categories:
            return "flagged", (
                f"primary category is {self.primary_category!r}, which is not a liquor "
                "category. This is the single biggest map-pack lever - fix it before "
                "anything else in this toolkit will matter."
            )
        if self.acceptable_primary_categories and (
            self.primary_category not in self.acceptable_primary_categories
        ):
            return "unrecognised", (
                f"primary category {self.primary_category!r} is neither on the "
                "acceptable nor the flagged list - check it against the dashboard picker."
            )
        return "ok", f"primary category is {self.primary_category!r}."

    def require_place_id(self) -> str:
        if not self.place_id:
            raise ConfigIncomplete(
                "google.place_id is unset in config/business.yaml. Get it from the "
                "GBP dashboard or a Places API text search, then re-run."
            )
        return self.place_id


class Licence(_Model):
    number: str
    type: str
    licensee_name: str
    licensee_name_verified: bool = False

    @field_validator("number")
    @classmethod
    def _liqp(cls, value: str) -> str:
        if not re.fullmatch(r"[A-Z]{4}\d{9}", value):
            raise ValueError("licence.number does not look like a NSW licence number")
        return value


DayWindow = Annotated[list[str], Field(min_length=2, max_length=2)]


class Hours(_Model):
    actual: dict[str, DayWindow]
    licensed: dict[str, DayWindow]
    sunday_sales_start: str
    timezone: str

    @field_validator("actual", "licensed")
    @classmethod
    def _every_day(cls, value: dict[str, list[str]]) -> dict[str, list[str]]:
        missing = set(DAYS) - set(value)
        if missing:
            raise ValueError(f"missing days: {sorted(missing)}")
        unknown = set(value) - set(DAYS)
        if unknown:
            raise ValueError(f"unknown day keys: {sorted(unknown)}")
        for day, window in value.items():
            open_at, close_at = parse_hhmm(window[0]), parse_hhmm(window[1])
            if close_at <= open_at:
                raise ValueError(f"{day}: closing time must be after opening time")
        return value

    @model_validator(mode="after")
    def _actual_within_licensed(self) -> "Hours":
        for day in DAYS:
            a_open, a_close = self.window("actual", day)
            l_open, l_close = self.window("licensed", day)
            if a_open < l_open or a_close > l_close:
                raise ValueError(
                    f"{day}: actual trading hours fall outside the licensed hours"
                )
        if self.window("actual", "sun")[0] < parse_hhmm(self.sunday_sales_start):
            raise ValueError("Sunday opening is earlier than sunday_sales_start")
        return self

    def window(self, kind: str, day: str) -> tuple[int, int]:
        table = self.actual if kind == "actual" else self.licensed
        open_at, close_at = table[day]
        return parse_hhmm(open_at), parse_hhmm(close_at)

    def actual_window(self, day: str) -> tuple[int, int]:
        return self.window("actual", day)

    def intersection(self, days: list[str] | tuple[str, ...] | None = None) -> tuple[int, int]:
        """The window that is true for *every* named day.

        An hours claim with no day attached reads as applying every day, so it is
        checked against the intersection across the whole week.
        """
        scope = tuple(days) if days else DAYS
        opens = [self.actual_window(day)[0] for day in scope]
        closes = [self.actual_window(day)[1] for day in scope]
        return max(opens), min(closes)

    @property
    def sunday_sales_start_minutes(self) -> int:
        return parse_hhmm(self.sunday_sales_start)

    def display(self) -> list[tuple[str, str]]:
        """Grouped, human-readable hours: [('Mon-Wed', '8am - 9pm'), ...]."""
        rows: list[tuple[str, str]] = []
        run: list[str] = []
        for day in DAYS:
            if run and self.actual_window(day) != self.actual_window(run[-1]):
                rows.append(self._row(run))
                run = []
            run.append(day)
        rows.append(self._row(run))
        return rows

    def _row(self, run: list[str]) -> tuple[str, str]:
        label = run[0].capitalize() if len(run) == 1 else f"{run[0].capitalize()}-{run[-1].capitalize()}"
        open_at, close_at = self.actual_window(run[0])
        return label, f"{fmt_12h(open_at)} - {fmt_12h(close_at)}"


class Catchment(_Model):
    primary_suburbs: list[str]
    landmarks: list[str] = Field(default_factory=list)
    demand_drivers: list[str]


class ComplianceCfg(_Model):
    responsible_service_line: str
    footer_template: str
    footer_surfaces: list[str]
    forbidden_hours_phrases: list[str]


class Business(_Model):
    identity: Identity
    address: Address
    contact: Contact
    geo: Geo
    website: Website
    google: GoogleProfile
    licence: Licence
    hours: Hours
    services: Services
    catchment: Catchment
    compliance: ComplianceCfg
    geo_plus_code_tolerance_m: float = 100.0

    @model_validator(mode="after")
    def _geo_agrees_with_plus_code(self) -> "Business":
        """A plus code is a free second opinion on the coordinates.

        If both are present they must describe the same place; a transposed or
        mistyped coordinate would otherwise centre the whole rank grid on the
        wrong suburb and quietly poison every scan.
        """
        if not (self.geo.is_resolved and self.geo.plus_code):
            return self
        gap = olc.distance_to_cell_m(self.geo.plus_code, self.geo.lat, self.geo.lng)
        if gap > self.geo_plus_code_tolerance_m:
            raise ValueError(
                f"geo.lat/geo.lng sit {gap:.0f} m from the centre of plus code "
                f"{self.geo.plus_code} (tolerance {self.geo_plus_code_tolerance_m:.0f} m). "
                "One of them is wrong."
            )
        return self

    @property
    def name(self) -> str:
        return self.identity.trading_name

    def warnings(self) -> list[str]:
        """Non-fatal gaps an operator has to close before going live."""
        gaps: list[str] = []
        if not self.google.place_id:
            gaps.append("google.place_id is unset - Part B (rank + audit) cannot run.")
        status, message = self.google.category_status()
        if status != "ok":
            gaps.append(message)
        elif not self.google.primary_category_verified:
            gaps.append(
                f"{message} Read the exact label back off the dashboard picker, then "
                "set google.primary_category_verified: true."
            )
        if not self.google.secondary_categories and self.google.candidate_secondary_categories:
            gaps.append(
                "no secondary categories set - candidates: "
                + ", ".join(self.google.candidate_secondary_categories)
            )
        if not self.geo.is_resolved:
            gaps.append("geo.lat/geo.lng are unset - the rank grid cannot be built.")
        if not self.licence.licensee_name_verified:
            gaps.append(
                "licence.licensee_name is unverified - confirm it against the NSW "
                "licence record before anything is published."
            )
        if self.google.api_write_access != "granted":
            gaps.append(
                f"google.api_write_access is '{self.google.api_write_access}' - "
                "PUBLISH_MODE=api will refuse to run (see docs/google-access.md). "
                "Everything else works without it."
            )
        unanswered = self.services.unanswered()
        if unanswered:
            gaps.append(
                "services not answered yet, so their Q&A entries cannot be written: "
                + ", ".join(unanswered)
            )
        if self.website.site_paths_source != "sitemap":
            gaps.append(
                "website.site_paths has not been refreshed from the live sitemap "
                "(run `llm-seo audit site --refresh-paths`)."
            )
        return gaps


class ConfigIncomplete(RuntimeError):
    """A required config value is missing. Says exactly what to fill in."""


def _read_yaml(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise FileNotFoundError(f"missing config file: {path}")
    with path.open("r", encoding="utf-8") as handle:
        loaded = yaml.safe_load(handle)
    if not isinstance(loaded, dict):
        raise ValueError(f"{path} must contain a YAML mapping")
    return loaded


@functools.lru_cache(maxsize=8)
def _load_business_cached(path_str: str) -> Business:
    return Business.model_validate(_read_yaml(Path(path_str)))


def load_business(path: Path | str | None = None) -> Business:
    resolved = Path(path) if path else config_dir() / "business.yaml"
    return _load_business_cached(str(resolved.resolve()))


@functools.lru_cache(maxsize=8)
def _load_yaml_cached(path_str: str) -> dict[str, Any]:
    return _read_yaml(Path(path_str))


def load_blocklist(path: Path | str | None = None) -> dict[str, Any]:
    """Term lists keyed by rule. `service_claims` nests one list per service."""
    resolved = Path(path) if path else config_dir() / "blocklist.yaml"
    raw = _load_yaml_cached(str(resolved.resolve()))
    loaded: dict[str, Any] = {}
    for key, value in raw.items():
        if isinstance(value, dict):
            loaded[key] = {k: list(v or []) for k, v in value.items()}
        else:
            loaded[key] = list(value or [])
    return loaded


def load_keywords(path: Path | str | None = None) -> dict[str, Any]:
    resolved = Path(path) if path else config_dir() / "keywords.yaml"
    return dict(_load_yaml_cached(str(resolved.resolve())))


def reset_caches() -> None:
    _load_business_cached.cache_clear()
    _load_yaml_cached.cache_clear()
