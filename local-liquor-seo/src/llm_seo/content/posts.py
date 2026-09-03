"""A2 - GBP post generation.

Turns calendar entries into finished captions. Every post is validated before it
reaches disk: headline length, body length, keyword placement, required fields
for its post type, and the full compliance gate. A post that fails any of those
fails the build - it is never written out in a broken state.

Nothing here invents a fact. Themes that name a specific bottle are held back
until data/products.csv exists, and offer details the operator must supply are
emitted as explicit FILL markers rather than plausible-looking fiction.
"""

from __future__ import annotations

import csv
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from pathlib import Path

from ..business import Business, load_business
from ..compliance import ComplianceError, ContentKind, Surface, compliance_check, footer
from ..paths import out_dir
from .calendar import Calendar, CalendarEntry, build_calendar
from .config import ContentConfig, Theme, load_content_config
from .links import CAMPAIGN_POST, slugify, tag_url
from .phrases import lookup

HEADLINE_MAX = 58
BODY_MIN = 150
BODY_MAX = 300
KEYWORD_WITHIN = 90

FILL = "[[FILL: {}]]"

STATUS_READY = "ready"
STATUS_NEEDS_INPUT = "needs_input"

CSV_COLUMNS = [
    "date", "slot", "theme", "post_type", "headline", "body", "character_count",
    "cta_type", "cta_url", "primary_keyword", "image_filename", "alt_text",
    "offer_coupon_code", "offer_terms", "offer_redeem_by",
    "event_title", "event_start", "event_end", "status", "slug",
]


@dataclass(frozen=True)
class Post:
    date: date
    slot: str
    theme: str
    post_type: str
    headline: str
    body: str
    cta_type: str
    cta_url: str
    primary_keyword: str
    image_filename: str
    alt_text: str
    slug: str
    footer: str
    status: str = STATUS_READY
    offer_coupon_code: str = ""
    offer_terms: str = ""
    offer_redeem_by: str = ""
    event_title: str = ""
    event_start: str = ""
    event_end: str = ""

    @property
    def caption(self) -> str:
        """What you paste into the post box: body then the mandated footer.

        The headline is not prepended. A Google "What's new" post has no title
        field, so pasting one there would just eat the ~150 characters Google
        shows in the mobile card. OFFER and EVENT posts do have a title, and the
        headline fills it.
        """
        return f"{self.body}\n\n{self.footer}".strip()

    @property
    def needs_input(self) -> bool:
        return "[[FILL:" in self.caption or "[[FILL:" in " ".join(
            (self.offer_coupon_code, self.offer_terms, self.event_title)
        )

    def as_row(self) -> dict[str, str]:
        return {
            "date": self.date.isoformat(),
            "slot": self.slot,
            "theme": self.theme,
            "post_type": self.post_type,
            "headline": self.headline,
            "body": self.body,
            "character_count": str(len(self.body)),
            "cta_type": self.cta_type,
            "cta_url": self.cta_url,
            "primary_keyword": self.primary_keyword,
            "image_filename": self.image_filename,
            "alt_text": self.alt_text,
            "offer_coupon_code": self.offer_coupon_code,
            "offer_terms": self.offer_terms,
            "offer_redeem_by": self.offer_redeem_by,
            "event_title": self.event_title,
            "event_start": self.event_start,
            "event_end": self.event_end,
            "status": self.status,
            "slug": self.slug,
        }

    def to_markdown(self) -> str:
        lines = [
            "---",
            f"date: {self.date.isoformat()}",
            f"slot: {self.slot}",
            f"theme: {self.theme}",
            f"post_type: {self.post_type}",
            f"status: {self.status}",
            f"cta_type: {self.cta_type}",
            f"cta_url: {self.cta_url}",
            f"primary_keyword: {self.primary_keyword}",
            f"image_filename: {self.image_filename}",
            f'alt_text: "{self.alt_text}"',
        ]
        if self.post_type == "OFFER":
            lines += [
                f"offer_coupon_code: {self.offer_coupon_code}",
                f"offer_terms: {self.offer_terms}",
                f"offer_redeem_by: {self.offer_redeem_by}",
            ]
        if self.post_type == "EVENT":
            lines += [
                f"event_title: {self.event_title}",
                f"event_start: {self.event_start}",
                f"event_end: {self.event_end}",
            ]
        lines += ["---", ""]
        if self.post_type in {"OFFER", "EVENT"}:
            lines += [f"# {self.headline}", ""]
        else:
            lines += [f"<!-- headline / image overlay: {self.headline} -->", ""]
        lines += [self.caption, ""]
        return "\n".join(lines)


class PostGenerationError(RuntimeError):
    """A post could not be produced correctly. Never written out half-built."""


@dataclass
class PostSet:
    posts: list[Post]
    warnings: list[str] = field(default_factory=list)

    def __len__(self) -> int:
        return len(self.posts)

    def write(self, directory: Path | None = None) -> tuple[Path, Path]:
        base = directory or out_dir()
        posts_dir = base / "posts"
        posts_dir.mkdir(parents=True, exist_ok=True)
        for post in self.posts:
            path = posts_dir / f"{post.date.isoformat()}_{post.slug}.md"
            path.write_text(post.to_markdown(), encoding="utf-8")

        csv_path = base / "posts.csv"
        with csv_path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=CSV_COLUMNS)
            writer.writeheader()
            for post in sorted(self.posts, key=lambda p: p.date):
                writer.writerow(post.as_row())
        return posts_dir, csv_path


# --------------------------------------------------------------------------
# template variables
# --------------------------------------------------------------------------


def _variables(
    business: Business, content: ContentConfig, entry: CalendarEntry, index: int
) -> dict[str, str]:
    suburbs = business.catchment.primary_suburbs
    landmarks = business.catchment.landmarks or suburbs
    nearby = [s for s in suburbs if s != business.address.suburb] or suburbs
    parking = business.services.parking
    season = content.season_for(entry.date.month)
    phrase = lookup(entry.primary_keyword)

    return {
        "phrase": phrase.text,
        "Phrase": phrase.text[:1].upper() + phrase.text[1:],
        "a_phrase": phrase.with_article,
        "A_phrase": phrase.sentence_case,
        "suburb": business.address.suburb,
        "nearby": nearby[index % len(nearby)],
        "landmark": landmarks[index % len(landmarks)],
        "parking": parking,
        "parking_lower": parking[:1].lower() + parking[1:],
        "delivery": business.services.delivery[0].name if business.services.delivery else "",
        "season": season,
        "Season": season.capitalize(),
        "focus": entry.product_focus or FILL.format("product name"),
        "occasion": entry.occasion,
    }


def render(template: str, variables: dict[str, str]) -> str:
    try:
        return template.format(**variables)
    except KeyError as exc:  # pragma: no cover - caught by the template linter
        raise PostGenerationError(f"template uses unknown variable {exc}") from exc


# --------------------------------------------------------------------------
# generation
# --------------------------------------------------------------------------


def _image_filename(business: Business, entry: CalendarEntry) -> str:
    subject = slugify(entry.asset_needed or entry.theme, max_length=32)
    return (
        f"{slugify(business.name)}-{subject}-"
        f"{slugify(business.address.suburb)}.jpg"
    )


def _alt_text(business: Business, entry: CalendarEntry, variables: dict[str, str]) -> str:
    return (
        f"{entry.asset_needed.capitalize()} at {business.name}, "
        f"{business.address.suburb} - {variables['phrase']}"
    )


def _offer_fields(entry: CalendarEntry) -> dict[str, str]:
    """Offer details are the operator's to supply. We never invent a discount."""
    redeem_by = entry.date + timedelta(days=6)
    return {
        "offer_coupon_code": FILL.format("coupon code, or NONE for in-store only"),
        "offer_terms": FILL.format("terms - what is included, any limit per customer"),
        "offer_redeem_by": redeem_by.isoformat(),
    }


def _event_fields(entry: CalendarEntry) -> dict[str, str]:
    when = entry.occasion_date or entry.date
    return {
        "event_title": entry.occasion or entry.theme.replace("_", " ").title(),
        "event_start": datetime.combine(when, datetime.min.time()).isoformat(timespec="minutes"),
        "event_end": datetime.combine(when, datetime.max.time()).isoformat(timespec="minutes"),
    }


def _validate(post: Post, entry: CalendarEntry, business: Business) -> None:
    if len(post.headline) > HEADLINE_MAX:
        raise PostGenerationError(
            f"{entry.date}: headline is {len(post.headline)} chars, max {HEADLINE_MAX}: "
            f"{post.headline!r}"
        )
    if not BODY_MIN <= len(post.body) <= BODY_MAX:
        raise PostGenerationError(
            f"{entry.date}: body is {len(post.body)} chars, needs {BODY_MIN}-{BODY_MAX}: "
            f"{post.body!r}"
        )
    opening = post.body[:KEYWORD_WITHIN].lower()
    if post.primary_keyword.lower() not in opening:
        raise PostGenerationError(
            f"{entry.date}: keyword {post.primary_keyword!r} is not in the first "
            f"{KEYWORD_WITHIN} characters, where Google truncates the mobile card"
        )
    if post.post_type == "OFFER" and not post.offer_redeem_by:
        raise PostGenerationError(f"{entry.date}: an OFFER post needs a redeem-by date")
    if post.post_type == "EVENT" and not (post.event_title and post.event_start and post.event_end):
        raise PostGenerationError(f"{entry.date}: an EVENT post needs a title and start/end")

    result = compliance_check(
        post.caption,
        kind=ContentKind(_theme_kind(entry, business)),
        surface=Surface.POST,
        links=[post.cta_url],
        business=business,
    )
    if not result.ok:
        raise ComplianceError(f"post {post.date.isoformat()} ({post.theme})", result.violations)


_KIND_CACHE: dict[str, str] = {}


def _theme_kind(entry: CalendarEntry, business: Business) -> str:
    return _KIND_CACHE.get(entry.theme, "alcohol")


def generate_posts(
    *,
    start: date | None = None,
    weeks: int = 4,
    business: Business | None = None,
    content: ContentConfig | None = None,
    calendar: Calendar | None = None,
    have_products: bool = False,
) -> PostSet:
    """Write `weeks` of posts from `start` (default: next Monday)."""
    biz = business or load_business()
    cfg = content or load_content_config()
    begin = start or _next_monday(date.today())
    plan = calendar or build_calendar(
        start=begin, days=weeks * 7, business=biz, content=cfg, have_products=have_products
    )
    _KIND_CACHE.update({theme.id: theme.kind for theme in cfg.themes})

    template_use: dict[str, int] = {}
    posts: list[Post] = []
    for index, entry in enumerate(sorted(plan.entries, key=lambda e: e.date)):
        theme = cfg.theme(entry.theme)
        bank = cfg.copy_bank[theme.id]
        turn = template_use.get(theme.id, 0)
        template_use[theme.id] = turn + 1

        variables = _variables(biz, cfg, entry, index)
        headline = render(bank.headlines[turn % len(bank.headlines)], variables)
        body = render(bank.bodies[turn % len(bank.bodies)], variables)

        slug = slugify(f"{theme.id}-{headline}")
        cta_url = tag_url(biz, entry.cta_url_path, campaign=CAMPAIGN_POST, content=slug)

        extra: dict[str, str] = {}
        if entry.post_type == "OFFER":
            extra.update(_offer_fields(entry))
        if entry.post_type == "EVENT":
            extra.update(_event_fields(entry))

        post = Post(
            date=entry.date,
            slot=entry.slot,
            theme=theme.id,
            post_type=entry.post_type,
            headline=headline,
            body=body,
            cta_type=entry.cta,
            cta_url=cta_url,
            primary_keyword=entry.primary_keyword,
            image_filename=_image_filename(biz, entry),
            alt_text=_alt_text(biz, entry, variables),
            slug=slug,
            footer=footer(biz) if theme.kind == "alcohol" else "",
            **extra,
        )
        post = _with_status(post)
        _validate(post, entry, biz)
        posts.append(post)

    return PostSet(posts=posts, warnings=list(plan.warnings))


def _with_status(post: Post) -> Post:
    from dataclasses import replace

    return replace(post, status=STATUS_NEEDS_INPUT if post.needs_input else STATUS_READY)


def _next_monday(today: date) -> date:
    return today + timedelta(days=(7 - today.weekday()) % 7 or 7)
