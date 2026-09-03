"""Phase 2 - the content engine.

The acceptance test at the bottom is the one that matters most: it walks every
generated caption on disk and asserts none of them is missing the licence
number, the licensee name or the under-18 line.
"""

from __future__ import annotations

import csv
from datetime import date

import pytest

from llm_seo.compliance import ContentKind, Surface, compliance_check, normalise
from llm_seo.content.calendar import (
    build_calendar,
    easter_sunday,
    nth_weekday,
    occasion_date,
)
from llm_seo.content.config import load_content_config
from llm_seo.content.lint import lint_templates
from llm_seo.content.links import profile_url, slugify, tag_url
from llm_seo.content.phrases import load_phrases, lookup, phrases_for
from llm_seo.content.posts import (
    BODY_MAX,
    BODY_MIN,
    HEADLINE_MAX,
    KEYWORD_WITHIN,
    PostGenerationError,
    generate_posts,
)
from llm_seo.content.qanda import build_qanda

START = date(2026, 9, 7)  # a Monday


@pytest.fixture(scope="module")
def content():
    return load_content_config()


@pytest.fixture(scope="module")
def posts():
    return generate_posts(start=START, weeks=4)


# --------------------------------------------------------------------------
# links
# --------------------------------------------------------------------------


def test_slugify():
    assert slugify("Just landed: Example Pale Ale!") == "just-landed-example-pale-ale"


def test_slugify_truncates_on_a_word_boundary():
    slug = slugify("a" * 20 + " " + "b" * 20 + " " + "c" * 40, max_length=45)
    assert len(slug) <= 45 and not slug.endswith("-")


def test_tag_url_carries_every_utm(biz):
    url = tag_url(biz, "/specials", campaign="gbp_post", content="Some Post")
    assert url.startswith(biz.website.url_for("/specials") + "?")
    for expected in ("utm_source=google", "utm_medium=organic",
                     "utm_campaign=gbp_post", "utm_content=some-post"):
        assert expected in url


def test_tag_url_refuses_an_unknown_path(biz):
    with pytest.raises(ValueError, match="site_paths"):
        tag_url(biz, "/beer-deals", campaign="gbp_post", content="x")


def test_the_profile_website_field_is_never_tagged(biz):
    """UTMs on the profile's website field pollute every click from the listing."""
    assert profile_url(biz) == biz.website.canonical_url
    assert "utm_" not in profile_url(biz)


# --------------------------------------------------------------------------
# phrases
# --------------------------------------------------------------------------


def test_every_phrase_declares_a_kind():
    assert {phrase.kind for phrase in load_phrases()} <= {"place", "product"}


def test_place_phrases_take_an_article():
    place = phrases_for(["place"])[0]
    assert place.with_article.startswith("a ")
    assert place.sentence_case[0].isupper()


def test_product_phrases_take_no_article():
    for phrase in phrases_for(["product"]):
        assert phrase.article == ""


def test_lookup_falls_back_for_an_unknown_phrase():
    assert lookup("bottle shop on the moon").text == "bottle shop on the moon"


# --------------------------------------------------------------------------
# calendar
# --------------------------------------------------------------------------


def test_easter_matches_known_dates():
    assert easter_sunday(2026) == date(2026, 4, 5)
    assert easter_sunday(2027) == date(2027, 3, 28)


def test_nth_weekday_finds_melbourne_cup():
    assert nth_weekday(2026, 11, 1, 1) == date(2026, 11, 3)


def test_nth_weekday_finds_fathers_day():
    assert nth_weekday(2026, 9, 6, 1) == date(2026, 9, 6)


def test_calendar_length_matches_the_cadence(content):
    plan = build_calendar(start=START, days=90)
    weeks = 90 / 7
    assert abs(len(plan) - weeks * content.cadence.posts_per_week) <= 3


def test_calendar_only_uses_the_configured_slots(content):
    from llm_seo.business import DAY_INDEX

    allowed = {DAY_INDEX[slot.day] for slot in content.cadence.slots}
    plan = build_calendar(start=START, days=90)
    assert {entry.date.weekday() for entry in plan.entries} == allowed


def test_the_full_taxonomy_honours_the_21_day_rule(content):
    plan = build_calendar(start=START, days=180, have_products=True)
    assert plan.min_theme_gap_days(ignore_occasions=True) >= content.cadence.min_theme_gap_days
    assert plan.warnings == []


def test_without_products_the_shortfall_is_reported_not_hidden():
    plan = build_calendar(start=START, days=180, have_products=False)
    assert plan.warnings, "a rotation that breaks the rule must say so"
    assert "products.csv" in plan.warnings[0]


def test_product_themes_are_held_back_without_product_data():
    plan = build_calendar(start=START, days=180, have_products=False)
    content = load_content_config()
    needs_data = {theme.id for theme in content.themes if theme.requires_products}
    assert not needs_data & {entry.theme for entry in plan.entries}


def test_an_occasion_claims_exactly_one_slot():
    plan = build_calendar(start=START, days=365, have_products=True)
    labels = [entry.occasion for entry in plan.entries if entry.occasion]
    assert len(labels) == len(set(labels)), "an occasion was pinned to two slots"


def test_an_occasion_only_lands_on_a_slot_that_can_carry_its_theme(content):
    plan = build_calendar(start=START, days=365, have_products=True)
    for entry in plan.entries:
        if entry.occasion:
            occasion = next(o for o in content.occasions if o.label == entry.occasion)
            assert entry.theme == occasion.theme


def test_an_occasion_post_lands_before_the_day_itself(content):
    plan = build_calendar(start=START, days=365, have_products=True)
    for entry in plan.entries:
        if entry.occasion_date:
            assert entry.date <= entry.occasion_date
            assert (entry.occasion_date - entry.date).days <= 6


def test_melbourne_cup_becomes_an_event_post():
    plan = build_calendar(start=START, days=120, have_products=True)
    cup = [e for e in plan.entries if e.occasion == "Melbourne Cup"]
    assert cup and cup[0].post_type == "EVENT"


def test_calendar_writes_every_required_column(tmp_path):
    plan = build_calendar(start=START, days=30)
    path = plan.write_csv(tmp_path / "calendar.csv")
    with path.open(encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    assert rows
    for column in ("date", "slot", "post_type", "theme", "product_focus",
                   "primary_keyword", "cta", "asset_needed", "status"):
        assert column in rows[0]


# --------------------------------------------------------------------------
# posts
# --------------------------------------------------------------------------


def test_four_weeks_produces_twelve_posts(posts):
    assert len(posts) == 12


def test_every_post_is_ready_without_any_product_data(posts):
    assert {post.status for post in posts.posts} == {"ready"}
    assert not any("[[FILL:" in post.caption for post in posts.posts)


def test_headlines_fit_googles_limit(posts):
    for post in posts.posts:
        assert len(post.headline) <= HEADLINE_MAX


def test_bodies_sit_in_the_target_range(posts):
    for post in posts.posts:
        assert BODY_MIN <= len(post.body) <= BODY_MAX


def test_the_keyword_lands_before_google_truncates(posts):
    for post in posts.posts:
        assert post.primary_keyword.lower() in post.body[:KEYWORD_WITHIN].lower()


def test_every_cta_is_one_google_offers(posts, content):
    for post in posts.posts:
        assert post.cta_type in content.cta_types


def test_every_cta_url_is_tagged_and_on_site(biz, posts):
    for post in posts.posts:
        assert post.cta_url.startswith(biz.website.canonical_url.rstrip("/"))
        assert "utm_campaign=gbp_post" in post.cta_url


def test_copy_does_not_repeat_itself(posts):
    bodies = [post.body for post in posts.posts]
    assert len(set(bodies)) == len(bodies)


def test_image_filenames_follow_the_convention(biz, posts):
    prefix = slugify(biz.name)
    for post in posts.posts:
        assert post.image_filename.startswith(prefix)
        assert post.image_filename.endswith(f"-{slugify(biz.address.suburb)}.jpg")


def test_alt_text_is_present_and_specific(posts):
    for post in posts.posts:
        assert len(post.alt_text) > 20


def test_a_standard_post_does_not_waste_the_preview_on_a_headline(posts):
    """Google's What's new posts have no title field; the caption starts with copy."""
    standard = [p for p in posts.posts if p.post_type == "STANDARD"]
    assert standard
    for post in standard:
        assert not post.caption.startswith(post.headline)


def test_an_offer_post_carries_its_required_fields():
    plan = build_calendar(start=START, days=120, have_products=True)
    offers = [e for e in plan.entries if e.post_type == "OFFER"]
    assert offers, "the price-value theme should produce OFFER posts"


def test_offer_details_are_never_invented():
    """A generated discount would be a false advertisement. Markers, not fiction."""
    generated = generate_posts(start=START, weeks=8, have_products=True)
    offers = [p for p in generated.posts if p.post_type == "OFFER"]
    assert offers
    for post in offers:
        assert "[[FILL:" in post.offer_coupon_code
        assert "[[FILL:" in post.offer_terms
        assert post.offer_redeem_by
        assert post.status == "needs_input"


def test_an_event_post_carries_a_title_and_a_window():
    generated = generate_posts(start=START, weeks=12, have_products=True)
    events = [p for p in generated.posts if p.post_type == "EVENT"]
    assert events
    for post in events:
        assert post.event_title and post.event_start and post.event_end


def test_generation_is_deterministic():
    first = generate_posts(start=START, weeks=4)
    second = generate_posts(start=START, weeks=4)
    assert [p.body for p in first.posts] == [p.body for p in second.posts]


def test_a_body_outside_the_limits_fails_the_build(biz, content):
    broken = content.model_copy(
        update={
            "copy_bank": {
                **content.copy_bank,
                "cold_convenience": content.copy_bank["cold_convenience"].model_copy(
                    update={"bodies": ["Too short {a_phrase}."]}
                ),
            }
        }
    )
    with pytest.raises(PostGenerationError, match="body is"):
        generate_posts(start=START, weeks=4, content=broken)


def test_the_markdown_carries_the_metadata_a_human_needs(posts):
    markdown = posts.posts[0].to_markdown()
    for field in ("date:", "theme:", "post_type:", "cta_url:", "image_filename:", "alt_text:"):
        assert field in markdown


def test_writing_produces_one_file_per_post_plus_a_csv(tmp_path, posts):
    posts_dir, csv_path = posts.write(tmp_path)
    assert len(list(posts_dir.glob("*.md"))) == len(posts)
    with csv_path.open(encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    assert len(rows) == len(posts)
    assert rows[0]["character_count"] == str(len(posts.posts[0].body))


# --------------------------------------------------------------------------
# template linter
# --------------------------------------------------------------------------


def test_every_template_renders_inside_the_limits():
    assert lint_templates() == []


# --------------------------------------------------------------------------
# Q&A
# --------------------------------------------------------------------------


def test_qanda_covers_the_topics_that_matter():
    result = build_qanda()
    ids = {pair.id for pair in result.pairs} | {row.id for row in result.unanswered}
    for expected in ("opening_hours", "open_now_sunday", "parking", "cold_stock", "ice",
                     "gift_wrapping", "gift_cards", "phone_orders", "bulk_orders",
                     "delivery", "card_surcharge", "id_required", "price_match",
                     "distance_uni", "distance_centre", "website", "specific_brand"):
        assert expected in ids, expected


def test_there_are_at_least_twenty_questions():
    result = build_qanda()
    assert len(result.pairs) + len(result.unanswered) >= 20


def test_the_sunday_rule_is_answered_explicitly(biz):
    result = build_qanda()
    answers = " ".join(pair.answer for pair in result.pairs)
    assert "10am on Sundays" in answers or "Sunday trading starts at 10am" in answers


def test_answers_link_untagged(biz):
    """GBP answers do not carry UTMs reliably, so links in them stay clean."""
    for pair in build_qanda().pairs:
        if pair.link:
            assert "utm_" not in pair.link
            assert pair.link.startswith(biz.website.canonical_url.rstrip("/"))


def test_unknown_services_produce_a_checklist_not_an_invented_answer(biz):
    result = build_qanda()
    unanswered = {row.depends_on for row in result.unanswered}
    for service in biz.services.unanswered():
        assert f"services.{service}" in unanswered


def test_a_known_service_produces_a_real_answer(biz):
    """Answer services.ice and the ice question stops being a gap."""
    answered = biz.model_copy(
        update={"services": biz.services.model_copy(update={"ice": True})}
    )
    result = build_qanda(business=answered)
    assert "ice" in {pair.id for pair in result.pairs}
    assert "ice" not in {row.id for row in result.unanswered}


def test_the_false_branch_reads_as_a_real_answer(biz):
    answered = biz.model_copy(
        update={"services": biz.services.model_copy(update={"price_match": False})}
    )
    pair = next(p for p in build_qanda(business=answered).pairs if p.id == "price_match")
    assert "do not price match" in pair.answer


def test_every_answer_passes_the_compliance_gate(biz):
    for pair in build_qanda().pairs:
        result = compliance_check(
            pair.answer, kind=ContentKind.ALCOHOL, surface=Surface.QANDA, business=biz
        )
        assert result.ok, f"{pair.id}: {result.report()}"


def test_qanda_writes_both_files(tmp_path):
    answers, gaps = build_qanda().write(tmp_path)
    assert answers.is_file() and gaps is not None and gaps.is_file()


# --------------------------------------------------------------------------
# ACCEPTANCE - walk every generated caption
# --------------------------------------------------------------------------


def test_no_alcohol_caption_is_missing_its_mandated_footer(biz, tmp_path):
    """The acceptance criterion, asserted against files on disk.

    Every alcohol caption must carry the licence number, the licensee name and
    the under-18 line. Not the trading name - the name on the licence.
    """
    generated = generate_posts(start=START, weeks=12, have_products=True)
    posts_dir, _ = generated.write(tmp_path)
    files = sorted(posts_dir.glob("*.md"))
    assert len(files) >= 12

    checked = 0
    for path in files:
        text = path.read_text(encoding="utf-8")
        if "theme: zero_alcohol" in text:
            continue
        body = normalise(text)
        assert biz.licence.number.lower() in body, path.name
        assert normalise(biz.licence.licensee_name) in body, path.name
        assert normalise(biz.compliance.responsible_service_line) in body, path.name
        checked += 1
    assert checked >= 10


def test_every_generated_caption_passes_the_gate(biz):
    generated = generate_posts(start=START, weeks=12, have_products=True)
    content = load_content_config()
    kinds = {theme.id: theme.kind for theme in content.themes}
    for post in generated.posts:
        result = compliance_check(
            post.caption,
            kind=kinds[post.theme],
            surface=Surface.POST,
            links=[post.cta_url],
            business=biz,
        )
        assert result.ok, f"{post.date} {post.theme}: {result.report()}"
