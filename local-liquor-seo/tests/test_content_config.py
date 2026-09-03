"""config/content.yaml validators. Every one of these guards a failure mode that
would otherwise surface as a broken caption weeks later."""

from __future__ import annotations

import copy

import pytest
import yaml
from pydantic import ValidationError

from llm_seo.content.config import ContentConfig, load_content_config
from llm_seo.paths import config_dir


@pytest.fixture()
def raw() -> dict:
    with (config_dir() / "content.yaml").open(encoding="utf-8") as handle:
        return yaml.safe_load(handle)


def build(raw: dict, **mutate) -> ContentConfig:
    data = copy.deepcopy(raw)
    data.update(mutate)
    return ContentConfig.model_validate(data)


def test_the_shipped_config_validates():
    assert load_content_config().themes


def test_slots_must_match_the_cadence(raw):
    cadence = copy.deepcopy(raw["cadence"])
    cadence["posts_per_week"] = 5
    with pytest.raises(ValidationError, match="one entry per post"):
        build(raw, cadence=cadence)


def test_two_slots_cannot_share_a_day(raw):
    cadence = copy.deepcopy(raw["cadence"])
    cadence["slots"][1]["day"] = cadence["slots"][0]["day"]
    with pytest.raises(ValidationError, match="same day"):
        build(raw, cadence=cadence)


def test_a_slot_must_name_a_real_day(raw):
    cadence = copy.deepcopy(raw["cadence"])
    cadence["slots"][0]["day"] = "funday"
    with pytest.raises(ValidationError, match="day of the week"):
        build(raw, cadence=cadence)


def test_a_theme_needs_a_copy_bank(raw):
    themes = copy.deepcopy(raw["themes"])
    themes.append({**themes[0], "id": "orphan", "requires_products": False})
    with pytest.raises(ValidationError, match="no copy bank"):
        build(raw, themes=themes)


def test_a_copy_bank_needs_a_theme(raw):
    bank = copy.deepcopy(raw["copy_bank"])
    bank["ghost"] = {"headlines": ["x"], "bodies": ["y"]}
    with pytest.raises(ValidationError, match="no theme"):
        build(raw, copy_bank=bank)


def test_duplicate_theme_ids_are_rejected(raw):
    themes = copy.deepcopy(raw["themes"])
    themes.append(copy.deepcopy(themes[0]))
    with pytest.raises(ValidationError, match="duplicate theme id"):
        build(raw, themes=themes)


def test_a_theme_cannot_use_an_unknown_slot(raw):
    themes = copy.deepcopy(raw["themes"])
    themes[0]["slots"] = ["mon"]
    with pytest.raises(ValidationError, match="unknown slots"):
        build(raw, themes=themes)


def test_a_cta_google_does_not_offer_is_rejected(raw):
    themes = copy.deepcopy(raw["themes"])
    themes[0]["cta"]["type"] = "Buy now"
    with pytest.raises(ValidationError, match="Google does not offer"):
        build(raw, themes=themes)


def test_an_unknown_post_type_is_rejected(raw):
    themes = copy.deepcopy(raw["themes"])
    themes[0]["post_type"] = "carousel"
    with pytest.raises(ValidationError, match="unknown post_type"):
        build(raw, themes=themes)


def test_an_unknown_phrase_kind_is_rejected(raw):
    themes = copy.deepcopy(raw["themes"])
    themes[0]["phrase_kinds"] = ["vibe"]
    with pytest.raises(ValidationError, match="unknown phrase kinds"):
        build(raw, themes=themes)


def test_a_focus_placeholder_needs_product_data(raw):
    """The guard against emitting a post with a hole where a bottle should be."""
    bank = copy.deepcopy(raw["copy_bank"])
    bank["cold_convenience"]["bodies"][0] = "Looking for {a_phrase}? Try {focus}. " + "x" * 130
    with pytest.raises(ValidationError, match="requires_products"):
        build(raw, copy_bank=bank)


def test_an_occasion_must_name_a_real_theme(raw):
    occasions = copy.deepcopy(raw["occasions"])
    occasions[0]["theme"] = "nonexistent"
    with pytest.raises(ValidationError, match="unknown theme"):
        build(raw, occasions=occasions)


def test_an_occasion_rule_needs_its_fields(raw):
    occasions = copy.deepcopy(raw["occasions"])
    occasions[0].pop("day")
    with pytest.raises(ValidationError, match="needs"):
        build(raw, occasions=occasions)


def test_an_event_cannot_be_pinned_to_a_product_theme(raw):
    occasions = copy.deepcopy(raw["occasions"])
    occasions[0].update({"theme": "new_arrival", "post_type": "event"})
    with pytest.raises(ValidationError, match="needs product data"):
        build(raw, occasions=occasions)


def test_seasons_must_partition_the_year(raw):
    seasons = copy.deepcopy(raw["seasons"])
    seasons["summer"] = [12, 1]
    with pytest.raises(ValidationError, match="partition"):
        build(raw, seasons=seasons)


def test_duplicate_qanda_ids_are_rejected(raw):
    qanda = copy.deepcopy(raw["qanda"])
    qanda.append(copy.deepcopy(qanda[0]))
    with pytest.raises(ValidationError, match="duplicate qanda id"):
        build(raw, qanda=qanda)


def test_a_conditional_question_needs_both_branches(raw):
    qanda = copy.deepcopy(raw["qanda"])
    entry = next(q for q in qanda if q.get("requires") and q.get("if_yes"))
    entry.pop("if_no")
    with pytest.raises(ValidationError, match="neither an answer nor"):
        build(raw, qanda=qanda)


def test_an_unconditional_question_needs_an_answer(raw):
    qanda = copy.deepcopy(raw["qanda"])
    entry = next(q for q in qanda if not q.get("requires"))
    entry.pop("answer")
    with pytest.raises(ValidationError, match="needs an answer"):
        build(raw, qanda=qanda)


def test_an_empty_copy_bank_is_rejected(raw):
    bank = copy.deepcopy(raw["copy_bank"])
    bank["how_to"]["bodies"] = []
    with pytest.raises(ValidationError, match="at least one"):
        build(raw, copy_bank=bank)


def test_season_lookup_covers_every_month():
    content = load_content_config()
    assert {content.season_for(month) for month in range(1, 13)} == set(content.seasons)


def test_theme_lookup_raises_for_an_unknown_id():
    with pytest.raises(KeyError):
        load_content_config().theme("nope")
