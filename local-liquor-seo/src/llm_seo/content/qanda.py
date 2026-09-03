"""A4 - seeded GBP questions and answers.

Google lets anyone ask a question on a profile, and the owner answer it. Seeding
the questions people actually ask is one of the cheapest wins on a listing: the
answers are indexed, they carry location and service keywords, and they stop the
same question being asked badly by someone else.

An answer that depends on a service fact we do not have is never invented. It is
written to out/qanda_needs_answer.csv instead, as a short list of questions only
the operator can settle.
"""

from __future__ import annotations

import csv
from dataclasses import dataclass, field
from pathlib import Path

from ..business import Business, load_business
from ..compliance import ComplianceError, ContentKind, Surface, compliance_check
from ..paths import out_dir
from .config import ContentConfig, QandaEntry, load_content_config
from .links import answer_url

CSV_COLUMNS = ["id", "question", "answer", "post_as", "link", "status"]
NEEDS_COLUMNS = ["id", "question", "depends_on", "what_we_need"]

STATUS_READY = "ready"
STATUS_NEEDS_ANSWER = "needs_answer"


@dataclass(frozen=True)
class QandaPair:
    id: str
    question: str
    answer: str
    post_as: str
    link: str = ""
    status: str = STATUS_READY

    def as_row(self) -> dict[str, str]:
        return {
            "id": self.id,
            "question": self.question,
            "answer": self.answer,
            "post_as": self.post_as,
            "link": self.link,
            "status": self.status,
        }


@dataclass(frozen=True)
class Unanswered:
    id: str
    question: str
    depends_on: str
    what_we_need: str

    def as_row(self) -> dict[str, str]:
        return {
            "id": self.id,
            "question": self.question,
            "depends_on": self.depends_on,
            "what_we_need": self.what_we_need,
        }


@dataclass
class QandaSet:
    pairs: list[QandaPair]
    unanswered: list[Unanswered] = field(default_factory=list)

    def __len__(self) -> int:
        return len(self.pairs)

    def write(self, directory: Path | None = None) -> tuple[Path, Path | None]:
        base = directory or out_dir()
        base.mkdir(parents=True, exist_ok=True)
        answers = base / "qanda.csv"
        with answers.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=CSV_COLUMNS)
            writer.writeheader()
            for pair in self.pairs:
                writer.writerow(pair.as_row())

        if not self.unanswered:
            return answers, None
        gaps = base / "qanda_needs_answer.csv"
        with gaps.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=NEEDS_COLUMNS)
            writer.writeheader()
            for row in self.unanswered:
                writer.writerow(row.as_row())
        return answers, gaps


def _variables(business: Business) -> dict[str, str]:
    landmarks = business.catchment.landmarks or [business.address.suburb]
    parking = business.services.parking
    hours = "; ".join(f"{label} {window}" for label, window in business.hours.display())
    from ..business import fmt_12h

    return {
        "suburb": business.address.suburb,
        "phone": business.contact.phone_display,
        "parking": parking,
        "parking_lower": parking[:1].lower() + parking[1:],
        "hours_summary": hours,
        "sunday_open": fmt_12h(business.hours.actual_window("sun")[0]),
        "delivery": business.services.delivery[0].name if business.services.delivery else "",
        "payments": ", ".join(business.services.payments),
        "landmark": landmarks[0],
        "landmark2": landmarks[-1],
        "id_policy": business.services.id_policy,
        "card_surcharge": business.services.card_surcharge or "",
        "brand": "{brand}",
    }


def _resolve(entry: QandaEntry, business: Business) -> tuple[str | None, str]:
    """(answer template, reason it is missing). One of the two is always empty."""
    if not entry.requires:
        return entry.answer, ""
    value = getattr(business.services, entry.requires, None)
    if value is None:
        return None, f"set services.{entry.requires} in config/business.yaml"
    if entry.if_yes is not None and entry.if_no is not None:
        return (entry.if_yes if value else entry.if_no), ""
    return entry.answer, ""


def build_qanda(
    *, business: Business | None = None, content: ContentConfig | None = None
) -> QandaSet:
    biz = business or load_business()
    cfg = content or load_content_config()
    variables = _variables(biz)

    pairs: list[QandaPair] = []
    missing: list[Unanswered] = []

    for entry in cfg.qanda:
        template, reason = _resolve(entry, biz)
        if template is None:
            missing.append(
                Unanswered(
                    id=entry.id,
                    question=entry.question.format(**variables),
                    depends_on=f"services.{entry.requires}",
                    what_we_need=reason,
                )
            )
            continue

        answer = template.format(**variables)
        link = answer_url(biz, entry.link) if entry.link else ""
        if link:
            answer = f"{answer} {link}"

        # Q&A is exempt from the licence footer by config, but every other rule
        # still applies - including the hours and Sunday checks, which is exactly
        # where an answer about opening times could go wrong.
        result = compliance_check(
            answer,
            kind=ContentKind.ALCOHOL,
            surface=Surface.QANDA,
            business=biz,
        )
        if not result.ok:
            raise ComplianceError(f"qanda {entry.id!r}", result.violations)

        pairs.append(
            QandaPair(
                id=entry.id,
                question=entry.question.format(**variables),
                answer=answer,
                post_as=entry.post_as,
                link=link,
                status=STATUS_NEEDS_ANSWER if entry.needs_operator_input else STATUS_READY,
            )
        )

    return QandaSet(pairs=pairs, unanswered=missing)
