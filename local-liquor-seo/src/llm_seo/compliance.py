"""Automated compliance gate for every piece of generated copy.

Nothing reaches disk without passing `compliance_check()`. On a violation the
build fails - copy is never silently stripped or rewritten, because a validator
that quietly edits your ads teaches you nothing about the ad you wrote.

The rules encode:
  R1  licence number + licensee name on alcohol promotion
  R2  the mandated under-18 responsible service line on alcohol promotion
  R3  no encouragement of rapid, excessive or irresponsible consumption
  R4  no special appeal to minors
  R5  no time-pressured or extreme discount framing
  R6  zero-alcohol copy is exempt from R1-R2 but must never be sold as a way to
      get drunk, and is still bound by R3-R5
  R7  never advertise trading outside actual opening hours, and never imply
      liquor sales before the Sunday sales start time
  R8  every link resolves to a known path on the canonical site
  R9  review replies never carry the licence footer
  R10 review replies never offer alcohol as compensation
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Iterable, Iterator, Sequence
from urllib.parse import urlsplit

from .business import DAYS, Business, fmt_12h, load_blocklist, load_business

__all__ = [
    "ContentKind",
    "Surface",
    "Violation",
    "ComplianceResult",
    "ComplianceError",
    "compliance_check",
    "enforce",
    "footer",
    "normalise",
]


class ContentKind(str, Enum):
    """What the copy is selling. Decides whether R1/R2 apply."""

    ALCOHOL = "alcohol"
    ZERO_ALCOHOL = "zero_alcohol"
    NON_ALCOHOL = "non_alcohol"


class Surface(str, Enum):
    """Where the copy is going. Decides which rules are in scope."""

    POST = "post"
    PRODUCT = "product"
    QANDA = "qanda"
    REVIEW_REPLY = "review_reply"
    PHOTO_CAPTION = "photo_caption"
    PROFILE = "profile"


@dataclass(frozen=True)
class Violation:
    rule: str
    message: str
    excerpt: str | None = None

    def __str__(self) -> str:
        tail = f" -> {self.excerpt!r}" if self.excerpt else ""
        return f"[{self.rule}] {self.message}{tail}"


@dataclass(frozen=True)
class ComplianceResult:
    ok: bool
    violations: tuple[Violation, ...] = ()
    kind: ContentKind = ContentKind.ALCOHOL
    surface: Surface = Surface.POST

    def __bool__(self) -> bool:
        return self.ok

    @property
    def rules(self) -> tuple[str, ...]:
        return tuple(dict.fromkeys(v.rule for v in self.violations))

    def report(self) -> str:
        if self.ok:
            return f"PASS ({self.kind.value} / {self.surface.value})"
        lines = [f"FAIL ({self.kind.value} / {self.surface.value})"]
        lines += [f"  {v}" for v in self.violations]
        return "\n".join(lines)

    def raise_for_status(self, label: str = "copy") -> None:
        if not self.ok:
            raise ComplianceError(label, self.violations)


class ComplianceError(RuntimeError):
    def __init__(self, label: str, violations: Sequence[Violation]) -> None:
        self.label = label
        self.violations = tuple(violations)
        detail = "\n".join(f"  {v}" for v in self.violations)
        super().__init__(f"{label} failed compliance:\n{detail}")


# --------------------------------------------------------------------------
# text normalisation
# --------------------------------------------------------------------------

_SMART = {
    "‘": "'", "’": "'", "‛": "'",
    "“": '"', "”": '"',
    "–": "-", "—": "-", "−": "-",
    " ": " ", "​": "", "﻿": "",
}


def normalise(text: str) -> str:
    """Case-folded, punctuation-normalised, whitespace-collapsed copy.

    Every matcher works on this form so that a curly apostrophe or a stray
    non-breaking space can never smuggle a blocked phrase past the gate.
    """
    cleaned = unicodedata.normalize("NFKC", text)
    for bad, good in _SMART.items():
        cleaned = cleaned.replace(bad, good)
    return re.sub(r"\s+", " ", cleaned).strip().lower()


def _phrase_pattern(phrase: str) -> re.Pattern[str]:
    tokens = [re.escape(t) for t in phrase.strip().split()]
    body = r"\s+".join(tokens)
    lead = r"\b" if phrase[:1].isalnum() else ""
    tail = r"\b" if phrase[-1:].isalnum() else ""
    return re.compile(lead + body + tail, re.IGNORECASE)


def _find_phrases(haystack: str, phrases: Iterable[str]) -> Iterator[str]:
    for phrase in phrases:
        match = _phrase_pattern(phrase).search(haystack)
        if match:
            yield match.group(0)


def _mask_allowed(haystack: str, allow_phrases: Iterable[str]) -> str:
    """Blank out known-safe phrases before blocklist scanning.

    Offsets are preserved so excerpts stay meaningful. Every entry in
    allow_phrases is a hole in the validator, so the list stays short.
    """
    masked = haystack
    for phrase in allow_phrases:
        masked = _phrase_pattern(phrase).sub(lambda m: "\x00" * len(m.group(0)), masked)
    return masked


# --------------------------------------------------------------------------
# hours claims (R7)
# --------------------------------------------------------------------------

_DAY_WORDS: dict[str, tuple[str, ...]] = {
    "monday": ("mon",), "mondays": ("mon",), "mon": ("mon",),
    "tuesday": ("tue",), "tuesdays": ("tue",), "tue": ("tue",), "tues": ("tue",),
    "wednesday": ("wed",), "wednesdays": ("wed",), "wed": ("wed",),
    "thursday": ("thu",), "thursdays": ("thu",), "thu": ("thu",),
    "thur": ("thu",), "thurs": ("thu",),
    "friday": ("fri",), "fridays": ("fri",), "fri": ("fri",),
    "saturday": ("sat",), "saturdays": ("sat",), "sat": ("sat",),
    "sunday": ("sun",), "sundays": ("sun",), "sun": ("sun",),
    "weekend": ("sat", "sun"), "weekends": ("sat", "sun"),
    "weekday": ("mon", "tue", "wed", "thu", "fri"),
    "weekdays": ("mon", "tue", "wed", "thu", "fri"),
}

_DAY_RANGE = re.compile(
    r"\b(?P<a>mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*\s*(?:-|to|through|thru)\s*"
    r"(?P<b>mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*\b",
    re.IGNORECASE,
)
_DAY_TOKEN = re.compile(r"\b(" + "|".join(sorted(_DAY_WORDS, key=len, reverse=True)) + r")\b")

_TIME_TOKEN = re.compile(
    r"""(?<![\w$.])
    (?:
        (?P<word>midnight|midday|noon)
      | (?P<h>\d{1,2})(?::(?P<m>\d{2}))?\s*(?P<mer>am|pm|a\.m\.|p\.m\.)
      | (?P<h24>\d{1,2}):(?P<m24>\d{2})
    )
    (?!\w)""",
    re.VERBOSE,
)
_RANGE_SEP = re.compile(r"^\s*(?:-|to|til|till|until|thru|through)\s*$")
_HOURS_CUE = re.compile(
    r"\b(open|opens|opening|opened|hours|trading|trade|close|closes|closing|"
    r"doors|we're here|were here|here till|here until|serving|shut)\b"
)
_START_CUE = re.compile(r"\b(from|open|opens|opening|doors|start|starts|as early as)\b")
_END_CUE = re.compile(r"\b(til|till|until|to|close|closes|closing|shut|through to)\b")

def _last_cue(pattern: re.Pattern[str], fragment: str) -> int:
    """Offset of the last cue match in `fragment`, or -1."""
    last = -1
    for match in pattern.finditer(fragment):
        last = match.start()
    return last


_ALL_DAY_WORDS = re.compile(r"\b(every ?day|everyday|daily|7 days|seven days|all week)\b")


@dataclass(frozen=True)
class HoursClaim:
    """An advertised trading time pulled out of the copy."""

    start: int | None
    end: int | None
    days: tuple[str, ...]
    text: str
    scoped: bool = False


def _time_value(match: re.Match[str]) -> int | None:
    word = match.group("word")
    if word:
        return 1440 if word == "midnight" else 720
    if match.group("mer"):
        hour = int(match.group("h"))
        minute = int(match.group("m") or 0)
        if hour > 12 or minute > 59:
            return None
        meridiem = match.group("mer").replace(".", "")
        if meridiem == "am":
            hour = 0 if hour == 12 else hour
        else:
            hour = 12 if hour == 12 else hour + 12
        return hour * 60 + minute
    hour, minute = int(match.group("h24")), int(match.group("m24"))
    if hour > 24 or minute > 59:
        return None
    return hour * 60 + minute


def _sentences(text: str) -> list[tuple[int, str]]:
    spans: list[tuple[int, str]] = []
    start = 0
    for match in re.finditer(r"[.!?\n|]+", text):
        spans.append((start, text[start : match.start()]))
        start = match.end()
    spans.append((start, text[start:]))
    return spans


def _sentence_span_for(text: str, position: int) -> tuple[int, str]:
    """The sentence containing `position`, with its start offset.

    Claim excerpts are clipped to this so a violation never quotes across a
    full stop and reads like nonsense.
    """
    chosen = (0, "")
    for start, sentence in _sentences(text):
        if start <= position:
            chosen = (start, sentence)
        else:
            break
    return chosen


def _days_in(fragment: str) -> tuple[tuple[str, ...], bool]:
    """Days named in a fragment, and whether any scoping was found at all."""
    if _ALL_DAY_WORDS.search(fragment):
        return DAYS, True
    found: set[str] = set()
    scoped = False
    for match in _DAY_RANGE.finditer(fragment):
        first = _DAY_WORDS[match.group("a").lower()][0]
        last = _DAY_WORDS[match.group("b").lower()][0]
        start, end = DAYS.index(first), DAYS.index(last)
        span = DAYS[start : end + 1] if start <= end else DAYS[start:] + DAYS[: end + 1]
        found.update(span)
        scoped = True
    if not scoped:
        for match in _DAY_TOKEN.finditer(fragment):
            found.update(_DAY_WORDS[match.group(1).lower()])
            scoped = True
    if not found:
        return DAYS, False
    return tuple(day for day in DAYS if day in found), scoped


def extract_hours_claims(text: str) -> list[HoursClaim]:
    """Pull advertised opening/closing times out of normalised copy.

    Deliberately conservative: a bare time is only treated as a trading claim
    when an opening-hours cue sits beside it, so "$8.50" and "the 6pm rush"
    do not become compliance failures.
    """
    body = normalise(text)
    matches = list(_TIME_TOKEN.finditer(body))
    claims: list[HoursClaim] = []
    index = 0
    while index < len(matches):
        current = matches[index]
        value = _time_value(current)
        if value is None:
            index += 1
            continue

        following = matches[index + 1] if index + 1 < len(matches) else None
        gap = body[current.end() : following.start()] if following else ""
        if following and _RANGE_SEP.match(gap):
            end_value = _time_value(following)
            if end_value is not None:
                _, fragment = _sentence_span_for(body, current.start())
                days, scoped = _days_in(fragment)
                claims.append(
                    HoursClaim(
                        start=value,
                        end=end_value,
                        days=days,
                        text=body[current.start() : following.end()],
                        scoped=scoped,
                    )
                )
                index += 2
                continue

        sentence_start, fragment = _sentence_span_for(body, current.start())
        window_start = max(sentence_start, current.start() - 40)
        lead = body[window_start : current.start()]
        if _HOURS_CUE.search(lead) or _HOURS_CUE.search(
            body[current.end() : current.end() + 15]
        ):
            days, scoped = _days_in(fragment)
            # The cue nearest the time wins: "open until 9pm" is a closing
            # claim even though "open" appears first.
            is_end = _last_cue(_END_CUE, lead) > _last_cue(_START_CUE, lead)
            claims.append(
                HoursClaim(
                    start=None if is_end else value,
                    end=value if is_end else None,
                    days=days,
                    text=body[window_start : current.end()].strip(),
                    scoped=scoped,
                )
            )
        index += 1
    return claims


def _check_hours(body: str, business: Business) -> Iterator[Violation]:
    hours = business.hours
    for phrase in _find_phrases(body, business.compliance.forbidden_hours_phrases):
        yield Violation(
            "R7_HOURS",
            "open-ended trading claim - advertise the actual hours, nothing vaguer",
            phrase,
        )

    for claim in extract_hours_claims(body):
        latest_open, earliest_close = hours.intersection(list(claim.days))
        scope = "every day" if len(claim.days) == 7 else "/".join(claim.days)

        if claim.start is not None and claim.start < latest_open:
            yield Violation(
                "R7_HOURS",
                f"advertises opening at {fmt_12h(claim.start)} but the doors open "
                f"no earlier than {fmt_12h(latest_open)} across {scope}",
                claim.text,
            )
        if claim.end is not None and claim.end > earliest_close:
            yield Violation(
                "R7_HOURS",
                f"advertises trading until {fmt_12h(claim.end)} but we close by "
                f"{fmt_12h(earliest_close)} across {scope}",
                claim.text,
            )
        if (
            "sun" in claim.days
            and claim.start is not None
            and claim.start < hours.sunday_sales_start_minutes
        ):
            yield Violation(
                "R7_SUNDAY",
                "implies liquor sales before "
                f"{fmt_12h(hours.sunday_sales_start_minutes)} on a Sunday",
                claim.text,
            )


# --------------------------------------------------------------------------
# links (R8)
# --------------------------------------------------------------------------

_MARKDOWN_LINK = re.compile(r"\[[^\]]*\]\(\s*(?P<url>[^)\s]+)\s*\)")
_SCHEME_URL = re.compile(r"\bhttps?://[^\s<>\"'\]\)]+", re.IGNORECASE)
_BARE_URL = re.compile(
    r"(?<![\w@/.])(?:www\.)?[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)+(?:/[^\s<>\"'\)\]]*)?",
    re.IGNORECASE,
)
_TRAILING_PUNCT = ".,;:!?'\""


def _candidate_urls(text: str) -> list[str]:
    found: list[str] = []
    remaining = text
    for match in _MARKDOWN_LINK.finditer(text):
        found.append(match.group("url"))
    remaining = _MARKDOWN_LINK.sub(" ", remaining)
    for match in _SCHEME_URL.finditer(remaining):
        found.append(match.group(0))
    remaining = _SCHEME_URL.sub(" ", remaining)
    for match in _BARE_URL.finditer(remaining):
        token = match.group(0)
        if "/" in token or re.search(r"\.(au|com|net|org|io|co)\b", token, re.I):
            found.append(token)
    cleaned: list[str] = []
    for url in found:
        stripped = url.rstrip(_TRAILING_PUNCT)
        if stripped:
            cleaned.append(stripped)
    return list(dict.fromkeys(cleaned))


def _check_links(text: str, business: Business, extra: Sequence[str]) -> Iterator[Violation]:
    site = business.website
    for raw in [*_candidate_urls(text), *extra]:
        candidate = raw.strip().rstrip(_TRAILING_PUNCT)
        if not candidate:
            continue
        has_scheme = bool(re.match(r"^https?://", candidate, re.IGNORECASE))
        parts = urlsplit(candidate if has_scheme else f"//{candidate}", scheme="https")
        host = (parts.netloc or "").lower().split(":")[0]
        host = host[4:] if host.startswith("www.") else host

        if host not in {h.lower() for h in site.allowed_hosts}:
            yield Violation(
                "R8_LINK_HOST",
                f"links off-site to {host or candidate!r}; every CTA must point at "
                f"{site.host}",
                candidate,
            )
            continue
        if has_scheme and parts.scheme.lower() != "https":
            yield Violation("R8_LINK_SCHEME", "link is not https", candidate)
        if not site.knows_path(parts.path or "/"):
            yield Violation(
                "R8_LINK_PATH",
                f"{site.normalise_path(parts.path)!r} is not a known page - a CTA to "
                "a 404 is worse than no CTA",
                candidate,
            )


# --------------------------------------------------------------------------
# footer
# --------------------------------------------------------------------------


def footer(business: Business | None = None) -> str:
    """The mandated footer block appended to alcohol-promoting copy."""
    biz = business or load_business()
    return biz.compliance.footer_template.format(
        rsa_line=" ".join(biz.compliance.responsible_service_line.split()),
        licensee=biz.licence.licensee_name,
        licence_number=biz.licence.number,
    ).strip()


def _has_rsa_line(body: str, business: Business) -> bool:
    return normalise(business.compliance.responsible_service_line) in body


def _has_licence_number(body: str, business: Business) -> bool:
    return business.licence.number.lower() in body


def _has_licensee_name(body: str, business: Business) -> bool:
    return normalise(business.licence.licensee_name) in body


# --------------------------------------------------------------------------
# the gate
# --------------------------------------------------------------------------


@dataclass
class _Ctx:
    body: str
    masked: str
    business: Business
    blocklist: dict[str, Any]
    kind: ContentKind
    surface: Surface
    links: tuple[str, ...] = field(default_factory=tuple)


def _rule_licence_footer(ctx: _Ctx) -> Iterator[Violation]:
    if ctx.kind is not ContentKind.ALCOHOL:
        return
    if ctx.surface.value not in ctx.business.compliance.footer_surfaces:
        return
    if not _has_licence_number(ctx.body, ctx.business):
        yield Violation(
            "R1_LICENCE_NUMBER",
            "alcohol copy is missing the licence number in the footer",
        )
    if not _has_licensee_name(ctx.body, ctx.business):
        yield Violation(
            "R1_LICENSEE_NAME",
            "alcohol copy is missing the licensee name in the footer",
        )


def _rule_rsa_line(ctx: _Ctx) -> Iterator[Violation]:
    if ctx.kind is not ContentKind.ALCOHOL:
        return
    if ctx.surface.value not in ctx.business.compliance.footer_surfaces:
        return
    if not _has_rsa_line(ctx.body, ctx.business):
        yield Violation(
            "R2_UNDER18_WARNING",
            "alcohol copy is missing the mandated under-18 responsible service line",
        )


def _rule_blocklist(ctx: _Ctx) -> Iterator[Violation]:
    groups = (
        ("irresponsible_consumption", "R3_IRRESPONSIBLE_CONSUMPTION",
         "encourages rapid, excessive or irresponsible consumption"),
        ("minor_appeal", "R4_MINOR_APPEAL",
         "reads as having a special appeal to under-18s"),
        ("urgency_discount", "R5_URGENCY_DISCOUNT",
         "time-pressured or extreme discount framing"),
        ("zero_alcohol_substitute", "R6_ZERO_ALCOHOL_SUBSTITUTE",
         "positions a drink as a way to get drunk"),
    )
    for key, rule, message in groups:
        for hit in _find_phrases(ctx.masked, ctx.blocklist.get(key, [])):
            yield Violation(rule, message, hit)


def _rule_review_reply(ctx: _Ctx) -> Iterator[Violation]:
    if ctx.surface is not Surface.REVIEW_REPLY:
        return
    if _has_licence_number(ctx.body, ctx.business) or _has_rsa_line(ctx.body, ctx.business):
        yield Violation(
            "R9_REPLY_FOOTER",
            "review replies must not carry the licence footer",
        )
    for hit in _find_phrases(ctx.masked, ctx.blocklist.get("inducement", [])):
        yield Violation(
            "R10_INDUCEMENT",
            "offers alcohol as compensation - offer a conversation, not a drink",
            hit,
        )


def _rule_service_claims(ctx: _Ctx) -> Iterator[Violation]:
    """Never advertise a service the store does not run.

    Each key under blocklist.service_claims names a boolean on
    business.services; its phrases are blocked only while that boolean is false.
    """
    claims = ctx.blocklist.get("service_claims") or {}
    for service, phrases in claims.items():
        if getattr(ctx.business.services, service, False):
            continue
        for hit in _find_phrases(ctx.masked, phrases):
            yield Violation(
                "R11_SERVICE_CLAIM",
                f"advertises {service.replace('_', ' ')}, which the store does not offer",
                hit,
            )


_RULES = (
    _rule_licence_footer,
    _rule_rsa_line,
    _rule_blocklist,
    _rule_review_reply,
    _rule_service_claims,
)


def compliance_check(
    text: str,
    *,
    kind: ContentKind | str = ContentKind.ALCOHOL,
    surface: Surface | str = Surface.POST,
    links: Sequence[str] = (),
    business: Business | None = None,
    blocklist: dict[str, Any] | None = None,
) -> ComplianceResult:
    """Validate one piece of copy. Never mutates the copy.

    `kind` decides whether the licence footer and under-18 line are required;
    `surface` decides which rules are in scope; `links` are CTA destinations that
    do not appear in the visible text.
    """
    kind = ContentKind(kind)
    surface = Surface(surface)
    biz = business or load_business()
    terms = blocklist if blocklist is not None else load_blocklist()

    body = normalise(text)
    ctx = _Ctx(
        body=body,
        masked=_mask_allowed(body, terms.get("allow_phrases", [])),
        business=biz,
        blocklist=terms,
        kind=kind,
        surface=surface,
        links=tuple(links),
    )

    violations: list[Violation] = []
    for rule in _RULES:
        violations.extend(rule(ctx))
    violations.extend(_check_hours(body, biz))
    violations.extend(_check_links(text, biz, tuple(links)))

    # Deduplicate while preserving order - the same phrase can hit two lists.
    unique = tuple(dict.fromkeys(violations))
    return ComplianceResult(ok=not unique, violations=unique, kind=kind, surface=surface)


def enforce(
    text: str,
    *,
    label: str = "copy",
    kind: ContentKind | str = ContentKind.ALCOHOL,
    surface: Surface | str = Surface.POST,
    links: Sequence[str] = (),
    business: Business | None = None,
    blocklist: dict[str, Any] | None = None,
) -> str:
    """compliance_check() that raises instead of returning. Fails the build."""
    result = compliance_check(
        text, kind=kind, surface=surface, links=links,
        business=business, blocklist=blocklist,
    )
    result.raise_for_status(label)
    return text
