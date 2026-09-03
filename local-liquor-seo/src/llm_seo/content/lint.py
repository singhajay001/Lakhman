"""Static check of the copy bank.

Renders every template against every phrase it could legally receive and reports
the ones that fall outside the post limits. Cheaper than discovering a 310-character
body three months into a calendar, and it runs without generating anything.
"""

from __future__ import annotations

from datetime import date

from ..business import Business, load_business
from .config import ContentConfig, load_content_config
from .phrases import phrases_for


def lint_templates(
    *, business: Business | None = None, content: ContentConfig | None = None
) -> list[str]:
    from .calendar import CalendarEntry
    from .posts import BODY_MAX, BODY_MIN, HEADLINE_MAX, KEYWORD_WITHIN, _variables, render

    biz = business or load_business()
    cfg = content or load_content_config()
    problems: list[str] = []

    for theme in cfg.themes:
        bank = cfg.copy_bank[theme.id]
        pool = phrases_for(theme.phrase_kinds)
        if not pool:
            problems.append(f"{theme.id}: no phrase matches phrase_kinds {theme.phrase_kinds}")
            continue

        # A body's length moves with the product name substituted into it, so
        # check the short end and the long end, not one convenient middle case.
        focus_cases = [""] if not theme.requires_products else [
            "Gin",
            "Example Pale Ale",
            "Example Reserve Single Batch Shiraz 2019",
        ]

        for phrase in pool:
            entry = CalendarEntry(
                date=date(2026, 1, 15), slot="range", post_type="STANDARD", theme=theme.id,
                product_focus="",
                primary_keyword=phrase.text, cta=theme.cta.type, cta_url_path=theme.cta.path,
                asset_needed="", status="planned",
            )
            for month, focus in [(m, f) for m in (1, 4, 7, 10) for f in focus_cases]:
                variables = _variables(biz, cfg, entry, index=0)
                variables["season"] = cfg.season_for(month)
                variables["Season"] = variables["season"].capitalize()
                if focus:
                    variables["focus"] = focus

                for template in bank.headlines:
                    rendered = render(template, variables)
                    if len(rendered) > HEADLINE_MAX:
                        problems.append(
                            f"{theme.id}: headline {len(rendered)} chars (max {HEADLINE_MAX}) "
                            f"-> {rendered!r}"
                        )
                for template in bank.bodies:
                    rendered = render(template, variables)
                    if not BODY_MIN <= len(rendered) <= BODY_MAX:
                        problems.append(
                            f"{theme.id}: body {len(rendered)} chars (need {BODY_MIN}-{BODY_MAX}) "
                            f"with {phrase.text!r} -> {rendered[:70]!r}..."
                        )
                    elif phrase.text.lower() not in rendered[:KEYWORD_WITHIN].lower():
                        problems.append(
                            f"{theme.id}: {phrase.text!r} falls outside the first "
                            f"{KEYWORD_WITHIN} chars -> {rendered[:70]!r}..."
                        )
    return sorted(set(problems))
