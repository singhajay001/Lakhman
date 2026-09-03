"""Loads config/content.yaml: the theme taxonomy, slots, occasions and copy bank."""

from __future__ import annotations

import functools
from pathlib import Path
from typing import Any, Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field, model_validator

from ..business import DAYS
from ..paths import config_dir

KindLiteral = Literal["alcohol", "zero_alcohol", "non_alcohol"]


class _Model(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class Slot(_Model):
    day: str
    name: str
    note: str

    @model_validator(mode="after")
    def _known_day(self) -> "Slot":
        if self.day not in DAYS:
            raise ValueError(f"slot day {self.day!r} is not a day of the week")
        return self


class Cadence(_Model):
    posts_per_week: int
    min_theme_gap_days: int
    slots: list[Slot]

    @model_validator(mode="after")
    def _slots_match_cadence(self) -> "Cadence":
        if len(self.slots) != self.posts_per_week:
            raise ValueError("cadence.slots must have one entry per post per week")
        if len({slot.day for slot in self.slots}) != len(self.slots):
            raise ValueError("two slots fall on the same day")
        return self


class Cta(_Model):
    type: str
    path: str


class Theme(_Model):
    id: str
    label: str
    slots: list[str]
    kind: KindLiteral
    requires_products: bool
    cta: Cta
    post_type: str = "standard"
    # Which kinds of search phrase this theme's copy can carry. A theme whose
    # bodies say "to go with dinner" only works with a product phrase.
    phrase_kinds: list[str] = Field(default_factory=lambda: ["place", "product"])


class Occasion(_Model):
    id: str
    label: str
    theme: str
    rule: Literal["fixed", "nth_weekday", "easter_offset"]
    month: int | None = None
    day: int | None = None
    weekday: int | None = None
    nth: int | None = None
    offset_days: int = 0
    # Google EVENT posts need a title and a start/end datetime. Only occasions
    # that genuinely bound a period get one; "Christmas" is a season, not an event.
    post_type: str = "standard"

    @model_validator(mode="after")
    def _rule_has_its_fields(self) -> "Occasion":
        needed = {
            "fixed": ("month", "day"),
            "nth_weekday": ("month", "weekday", "nth"),
            "easter_offset": (),
        }[self.rule]
        missing = [field for field in needed if getattr(self, field) is None]
        if missing:
            raise ValueError(f"occasion {self.id!r} ({self.rule}) needs {missing}")
        return self


class CopyBank(_Model):
    headlines: list[str]
    bodies: list[str]

    @model_validator(mode="after")
    def _not_empty(self) -> "CopyBank":
        if not self.headlines or not self.bodies:
            raise ValueError("a copy bank needs at least one headline and one body")
        return self


class QandaEntry(_Model):
    id: str
    question: str
    post_as: Literal["owner", "ask_from_second_account"]
    answer: str | None = None
    requires: str | None = None
    # Not `yes`/`no`: bare yes and no are booleans in YAML, and the whole file
    # fails to load with an obscure "keys should be strings" error.
    if_yes: str | None = None
    if_no: str | None = None
    link: str | None = None
    note: str | None = None
    needs_operator_input: bool = False

    @model_validator(mode="after")
    def _has_something_to_say(self) -> "QandaEntry":
        if self.requires and not (self.answer or (self.if_yes and self.if_no)):
            raise ValueError(
                f"qanda {self.id!r} depends on services.{self.requires} but supplies "
                "neither an answer nor a yes/no pair"
            )
        if not self.requires and not self.answer:
            raise ValueError(f"qanda {self.id!r} needs an answer")
        return self


class ContentConfig(_Model):
    cadence: Cadence
    post_types: dict[str, str]
    cta_types: list[str]
    themes: list[Theme]
    occasions: list[Occasion]
    seasons: dict[str, list[int]]
    copy_bank: dict[str, CopyBank]
    qanda: list[QandaEntry] = Field(default_factory=list)

    @model_validator(mode="after")
    def _cross_references_resolve(self) -> "ContentConfig":
        ids = {theme.id for theme in self.themes}
        if len(ids) != len(self.themes):
            raise ValueError("duplicate theme id")
        missing_copy = ids - set(self.copy_bank)
        if missing_copy:
            raise ValueError(f"themes with no copy bank: {sorted(missing_copy)}")
        orphan_copy = set(self.copy_bank) - ids
        if orphan_copy:
            raise ValueError(f"copy banks with no theme: {sorted(orphan_copy)}")

        slot_days = {slot.day for slot in self.cadence.slots}
        for theme in self.themes:
            unknown = set(theme.slots) - slot_days
            if unknown:
                raise ValueError(f"theme {theme.id!r} names unknown slots: {sorted(unknown)}")
            if theme.cta.type not in self.cta_types:
                raise ValueError(
                    f"theme {theme.id!r} uses CTA {theme.cta.type!r}, which Google does not offer"
                )
            if theme.post_type not in self.post_types:
                raise ValueError(f"theme {theme.id!r} has unknown post_type {theme.post_type!r}")

        for occasion in self.occasions:
            if occasion.theme not in ids:
                raise ValueError(f"occasion {occasion.id!r} names unknown theme {occasion.theme!r}")
            if occasion.post_type not in self.post_types:
                raise ValueError(
                    f"occasion {occasion.id!r} has unknown post_type {occasion.post_type!r}"
                )
            theme = self.theme(occasion.theme)
            if theme.requires_products and occasion.post_type == "event":
                raise ValueError(
                    f"occasion {occasion.id!r} pins an EVENT to a theme that needs product data"
                )

        months = sorted(month for months in self.seasons.values() for month in months)
        if months != list(range(1, 13)):
            raise ValueError("seasons must partition all twelve months exactly once")

        if len({entry.id for entry in self.qanda}) != len(self.qanda):
            raise ValueError("duplicate qanda id")

        for theme in self.themes:
            unknown_kinds = set(theme.phrase_kinds) - {"place", "product"}
            if unknown_kinds:
                raise ValueError(
                    f"theme {theme.id!r} names unknown phrase kinds: {sorted(unknown_kinds)}"
                )
            bank = self.copy_bank[theme.id]
            if not theme.requires_products:
                for template in bank.headlines + bank.bodies:
                    if "{focus}" in template:
                        raise ValueError(
                            f"theme {theme.id!r} uses {{focus}} but is not marked "
                            "requires_products - it would emit a post with a hole in it"
                        )
        return self

    def theme(self, theme_id: str) -> Theme:
        for theme in self.themes:
            if theme.id == theme_id:
                return theme
        raise KeyError(theme_id)

    def themes_for_slot(self, day: str, *, with_products: bool) -> list[Theme]:
        return [
            theme
            for theme in self.themes
            if day in theme.slots and (with_products or not theme.requires_products)
        ]

    def season_for(self, month: int) -> str:
        for season, months in self.seasons.items():
            if month in months:
                return season
        raise KeyError(month)  # pragma: no cover - the validator rules this out


@functools.lru_cache(maxsize=4)
def _load_cached(path_str: str) -> ContentConfig:
    with Path(path_str).open("r", encoding="utf-8") as handle:
        return ContentConfig.model_validate(yaml.safe_load(handle))


def load_content_config(path: Path | str | None = None) -> ContentConfig:
    resolved = Path(path) if path else config_dir() / "content.yaml"
    return _load_cached(str(resolved.resolve()))


def reset_cache() -> None:
    _load_cached.cache_clear()
