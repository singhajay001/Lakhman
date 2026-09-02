"""config/business.yaml is the single source of truth, so its schema is enforced."""

from __future__ import annotations

import copy

import pytest
import yaml
from pydantic import ValidationError

from llm_seo.business import (
    DAYS,
    Business,
    ConfigIncomplete,
    fmt_12h,
    fmt_hhmm,
    load_business,
    parse_hhmm,
)
from llm_seo.paths import config_dir


@pytest.fixture()
def raw() -> dict:
    with (config_dir() / "business.yaml").open(encoding="utf-8") as handle:
        return yaml.safe_load(handle)


def build(raw: dict, **mutate) -> Business:
    data = copy.deepcopy(raw)
    for dotted, value in mutate.items():
        node = data
        *path, leaf = dotted.split("__")
        for key in path:
            node = node[key]
        node[leaf] = value
    return Business.model_validate(data)


# --------------------------------------------------------------------------
# time helpers
# --------------------------------------------------------------------------


@pytest.mark.parametrize("value,minutes", [("08:00", 480), ("00:00", 0), ("24:00", 1440), ("21:30", 1290)])
def test_parse_hhmm(value, minutes):
    assert parse_hhmm(value) == minutes


@pytest.mark.parametrize("bad", ["8am", "8:0", "25:00", "10:75", "24:30", ""])
def test_parse_hhmm_rejects_rubbish(bad):
    with pytest.raises(ValueError):
        parse_hhmm(bad)


def test_fmt_hhmm_round_trips():
    assert fmt_hhmm(parse_hhmm("21:30")) == "21:30"


@pytest.mark.parametrize(
    "minutes,text",
    [(480, "8am"), (720, "midday"), (1260, "9pm"), (1290, "9.30pm"), (1440, "midnight"), (0, "midnight")],
)
def test_fmt_12h(minutes, text):
    assert fmt_12h(minutes) == text


# --------------------------------------------------------------------------
# the shipped config
# --------------------------------------------------------------------------


def test_the_shipped_config_validates(biz):
    assert biz.name
    assert set(biz.hours.actual) == set(DAYS)


def test_actual_hours_sit_inside_the_licensed_ceiling(biz):
    for day in DAYS:
        actual, licensed = biz.hours.actual_window(day), biz.hours.window("licensed", day)
        assert licensed[0] <= actual[0] and actual[1] <= licensed[1]


def test_sunday_never_opens_before_the_sales_start(biz):
    assert biz.hours.actual_window("sun")[0] >= biz.hours.sunday_sales_start_minutes


def test_intersection_is_the_narrowest_window(biz):
    latest_open, earliest_close = biz.hours.intersection()
    assert latest_open == max(biz.hours.actual_window(d)[0] for d in DAYS)
    assert earliest_close == min(biz.hours.actual_window(d)[1] for d in DAYS)


def test_intersection_of_one_day_is_that_day(biz):
    assert biz.hours.intersection(["sun"]) == biz.hours.actual_window("sun")


def test_display_groups_consecutive_identical_days(biz):
    labels = [label for label, _ in biz.hours.display()]
    assert labels == ["Mon-Wed", "Thu-Sat", "Sun"]


def test_open_gaps_are_reported_not_hidden(biz):
    """The shipped config still has TODOs; they must surface, not fail silently."""
    assert biz.warnings()


def test_resolved_values_drop_out_of_the_gap_list(biz):
    gaps = " ".join(biz.warnings())
    assert "geo.lat" not in gaps
    assert "licensee_name" not in gaps


# --------------------------------------------------------------------------
# schema enforcement
# --------------------------------------------------------------------------


def test_formatted_address_must_contain_every_component(raw):
    with pytest.raises(ValidationError):
        build(raw, address__formatted="Somewhere else entirely")


def test_phone_e164_is_validated(raw):
    """A local-format number in the e164 field is a config error, not a warning."""
    with pytest.raises(ValidationError):
        build(raw, contact__phone_e164=raw["contact"]["phone_display"])


def test_canonical_url_must_be_https(raw):
    with pytest.raises(ValidationError):
        build(raw, website__canonical_url="http://example.com/")


def test_website_host_must_match_the_canonical_url(raw):
    with pytest.raises(ValidationError):
        build(raw, website__host="not-the-same-host.example")


def test_site_paths_must_include_the_root(raw):
    with pytest.raises(ValidationError):
        build(raw, website__site_paths=["/specials"])


def test_site_paths_must_be_rooted(raw):
    with pytest.raises(ValidationError):
        build(raw, website__site_paths=["/", "specials"])


def test_licence_number_shape_is_enforced(raw):
    with pytest.raises(ValidationError):
        build(raw, licence__number="12345")


def test_a_missing_day_is_rejected(raw):
    hours = copy.deepcopy(raw["hours"]["actual"])
    hours.pop("sun")
    with pytest.raises(ValidationError):
        build(raw, hours__actual=hours)


def test_an_unknown_day_key_is_rejected(raw):
    hours = copy.deepcopy(raw["hours"]["actual"])
    hours["funday"] = ["10:00", "12:00"]
    with pytest.raises(ValidationError):
        build(raw, hours__actual=hours)


def test_closing_before_opening_is_rejected(raw):
    hours = copy.deepcopy(raw["hours"]["actual"])
    hours["mon"] = ["21:00", "08:00"]
    with pytest.raises(ValidationError):
        build(raw, hours__actual=hours)


def test_trading_outside_the_licence_is_rejected(raw):
    hours = copy.deepcopy(raw["hours"]["actual"])
    hours["sun"] = ["06:00", "21:00"]
    with pytest.raises(ValidationError):
        build(raw, hours__actual=hours)


def test_sunday_opening_before_the_sales_start_is_rejected(raw):
    hours = copy.deepcopy(raw["hours"])
    hours["licensed"]["sun"] = ["05:00", "22:00"]
    hours["actual"]["sun"] = ["08:00", "21:00"]
    with pytest.raises(ValidationError):
        build(raw, hours=hours)


def test_unknown_config_keys_are_rejected(raw):
    data = copy.deepcopy(raw)
    data["identity"]["mystery_field"] = "?"
    with pytest.raises(ValidationError):
        Business.model_validate(data)


# --------------------------------------------------------------------------
# URLs and required-but-missing values
# --------------------------------------------------------------------------


def test_url_for_builds_a_canonical_url(biz):
    assert biz.website.url_for("/specials").endswith("/specials")
    assert biz.website.url_for("/") == biz.website.canonical_url


def test_url_for_tolerates_a_trailing_slash(biz):
    assert biz.website.url_for("/specials/") == biz.website.url_for("/specials")


def test_url_for_refuses_an_unknown_path(biz):
    with pytest.raises(ValueError, match="site_paths"):
        biz.website.url_for("/beer-deals")


def test_missing_place_id_explains_itself(raw):
    unresolved = build(raw, google__place_id=None)
    with pytest.raises(ConfigIncomplete, match="place_id"):
        unresolved.google.require_place_id()


def test_a_present_place_id_is_returned(raw):
    resolved = build(raw, google__place_id="ChIJexample")
    assert resolved.google.require_place_id() == "ChIJexample"


def test_missing_geo_explains_itself(raw):
    unresolved = build(raw, geo={"lat": None, "lng": None, "verified": False})
    assert unresolved.geo.is_resolved is False
    with pytest.raises(ConfigIncomplete, match="geo.lat"):
        unresolved.geo.require()


def test_resolved_geo_is_returned(biz):
    assert biz.geo.require() == (biz.geo.lat, biz.geo.lng)


# --------------------------------------------------------------------------
# geo / plus code cross-check
# --------------------------------------------------------------------------


def test_the_shipped_geo_is_resolved_and_verified(biz):
    assert biz.geo.is_resolved and biz.geo.verified
    assert biz.geo.plus_code and biz.geo.source


def test_a_swapped_lat_lng_is_rejected(raw, biz):
    """The classic transposition. Without the plus-code check it would centre
    the entire rank grid in the Indian Ocean and nothing would look wrong."""
    geo = dict(raw["geo"], lat=raw["geo"]["lng"], lng=raw["geo"]["lat"])
    with pytest.raises(ValidationError, match="out of range|plus code"):
        build(raw, geo=geo)


def test_a_dropped_minus_sign_is_rejected(raw):
    geo = dict(raw["geo"], lat=abs(raw["geo"]["lat"]))
    with pytest.raises(ValidationError, match="plus code"):
        build(raw, geo=geo)


def test_a_coordinate_a_suburb_away_is_rejected(raw):
    geo = dict(raw["geo"], lat=raw["geo"]["lat"] - 0.02)
    with pytest.raises(ValidationError, match="plus code"):
        build(raw, geo=geo)


def test_a_coordinate_inside_the_tolerance_is_accepted(raw):
    """~20 m north is the pin at the door rather than the centre of the tenancy."""
    geo = dict(raw["geo"], lat=raw["geo"]["lat"] + 0.0002)
    assert build(raw, geo=geo).geo.is_resolved


def test_an_out_of_range_latitude_is_rejected(raw):
    with pytest.raises(ValidationError):
        build(raw, geo=dict(raw["geo"], lat=-99.0))


def test_an_out_of_range_longitude_is_rejected(raw):
    with pytest.raises(ValidationError):
        build(raw, geo=dict(raw["geo"], lng=400.0))


def test_a_short_plus_code_is_rejected(raw):
    """Google displays '64J5+R5 Marsfield'; the config needs the full code."""
    with pytest.raises(ValidationError, match="full 10-digit"):
        build(raw, geo=dict(raw["geo"], plus_code="64J5+R5"))


def test_geo_without_a_plus_code_skips_the_cross_check(raw):
    geo = {k: v for k, v in raw["geo"].items() if k != "plus_code"}
    assert build(raw, geo=geo).geo.plus_code is None


def test_loader_is_cached(biz):
    assert load_business() is biz
