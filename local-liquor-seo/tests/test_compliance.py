"""The compliance gate is the only thing standing between a generator and a
regulator, so it gets the heaviest test coverage in the project."""

from __future__ import annotations

import pytest

from llm_seo.business import parse_hhmm
from llm_seo.compliance import (
    ComplianceError,
    ComplianceResult,
    ContentKind,
    Surface,
    Violation,
    compliance_check,
    enforce,
    extract_hours_claims,
    footer,
    normalise,
)


def rules(result: ComplianceResult) -> set[str]:
    return {v.rule for v in result.violations}


# --------------------------------------------------------------------------
# normalisation
# --------------------------------------------------------------------------


def test_normalise_collapses_whitespace_and_case():
    assert normalise("  Cold\tBEER\n\n now ") == "cold beer now"


@pytest.mark.parametrize("smart", ["’", "‘"])
def test_normalise_folds_smart_apostrophes(smart):
    assert normalise(f"one more won{smart}t hurt") == "one more won't hurt"


def test_normalise_folds_dashes_and_invisible_characters():
    assert normalise("8am–6pm") == "8am-6pm"
    assert normalise("boo​zy") == "boozy"


# --------------------------------------------------------------------------
# R1 / R2 - the mandated footer
# --------------------------------------------------------------------------


def test_compliant_alcohol_post_passes(alcohol_post):
    text = alcohol_post(
        "Cold craft beer in Marsfield, chilled and ready to go. Fresh local cans in "
        "the cold room today."
    )
    result = compliance_check(text)
    assert result.ok, result.report()
    assert bool(result) is True


def test_alcohol_post_without_footer_fails_r1_and_r2():
    result = compliance_check("Cold craft beer, chilled and ready to go.")
    assert rules(result) == {
        "R1_LICENCE_NUMBER",
        "R1_LICENSEE_NAME",
        "R2_UNDER18_WARNING",
    }


def test_missing_licence_number_only(biz, alcohol_post):
    text = alcohol_post("Cold local beer.").replace(biz.licence.number, "")
    assert rules(compliance_check(text)) == {"R1_LICENCE_NUMBER"}


def test_missing_rsa_line_only(biz, alcohol_post):
    text = alcohol_post("Cold local beer.").replace(
        " ".join(biz.compliance.responsible_service_line.split()), ""
    )
    assert rules(compliance_check(text)) == {"R2_UNDER18_WARNING"}


def test_rsa_line_survives_reflowing(biz, alcohol_post):
    """A caption wrapped across lines still carries the line."""
    reflowed = alcohol_post("Cold local beer.").replace(", or to obtain", ",\n   or to obtain")
    assert compliance_check(reflowed).ok


def test_non_alcohol_copy_needs_no_footer():
    result = compliance_check(
        "Fresh acai bowls now in the front fridge.", kind=ContentKind.NON_ALCOHOL
    )
    assert result.ok, result.report()


def test_zero_alcohol_copy_needs_no_footer():
    result = compliance_check(
        "The zero-alcohol shelf just grew: four new alcohol-free lagers in stock.",
        kind="zero_alcohol",
    )
    assert result.ok, result.report()


def test_qanda_is_exempt_from_the_footer_but_not_the_rest(biz):
    assert "qanda" not in biz.compliance.footer_surfaces
    result = compliance_check(
        "Yes, we keep beer, wine and spirits cold and ready to walk out with.",
        surface=Surface.QANDA,
    )
    assert result.ok, result.report()


def test_footer_renders_licensee_and_number(biz):
    rendered = footer(biz)
    assert biz.licence.number in rendered
    assert biz.licence.licensee_name in rendered
    assert normalise(biz.compliance.responsible_service_line) in normalise(rendered)


# --------------------------------------------------------------------------
# R3 / R4 / R5 / R6 - blocklists
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "phrase",
    ["smashed", "wasted", "get on it", "drink up", "bottomless", "all you can drink",
     "skol", "sculled", "big night", "hangover cure", "pre-drinks", "session it",
     "boozy", "binge", "shots on shots", "unlimited", "free drinks"],
)
def test_irresponsible_consumption_terms_are_rejected(phrase, alcohol_post):
    result = compliance_check(alcohol_post(f"Weekend plans: {phrase} at the local."))
    assert "R3_IRRESPONSIBLE_CONSUMPTION" in rules(result)


@pytest.mark.parametrize(
    "phrase", ["schoolies", "HSC", "back to school", "cartoon", "gummy", "collect them all"]
)
def test_minor_appeal_terms_are_rejected(phrase, alcohol_post):
    result = compliance_check(alcohol_post(f"{phrase} season is here."))
    assert "R4_MINOR_APPEAL" in rules(result)


@pytest.mark.parametrize(
    "phrase", ["last hour", "beat the clock", "while you can", "power hour", "cheapest in Sydney"]
)
def test_urgency_framing_is_rejected(phrase, alcohol_post):
    result = compliance_check(alcohol_post(f"Specials on now - {phrase}."))
    assert "R5_URGENCY_DISCOUNT" in rules(result)


def test_zero_alcohol_may_not_be_sold_as_a_way_to_get_drunk():
    result = compliance_check(
        "Alcohol-free lager with all the buzz and none of the calories.",
        kind=ContentKind.ZERO_ALCOHOL,
    )
    assert "R6_ZERO_ALCOHOL_SUBSTITUTE" in rules(result)


def test_non_alcohol_copy_still_runs_rules_three_to_five():
    result = compliance_check(
        "Bottomless acai bowls, last hour only.", kind=ContentKind.NON_ALCOHOL
    )
    assert rules(result) == {"R3_IRRESPONSIBLE_CONSUMPTION", "R5_URGENCY_DISCOUNT"}


def test_blocklist_matches_on_word_boundaries_only(alcohol_post):
    """'skol' must not fire on 'Skolnick' and 'binge' must not fire on 'bingeing'
    being absent - a substring match would make the validator useless."""
    result = compliance_check(alcohol_post("New arrival from Skolnicks Distillery."))
    assert "R3_IRRESPONSIBLE_CONSUMPTION" not in rules(result)


def test_smart_punctuation_cannot_smuggle_a_blocked_phrase(alcohol_post):
    result = compliance_check(alcohol_post("One more won’t hurt."))
    assert "R3_IRRESPONSIBLE_CONSUMPTION" in rules(result)


def test_allow_phrase_is_masked_before_scanning(alcohol_post, terms):
    assert "smashed avocado" in terms["allow_phrases"]
    result = compliance_check(alcohol_post("Pairs with smashed avocado on sourdough."))
    assert "R3_IRRESPONSIBLE_CONSUMPTION" not in rules(result)


def test_allow_phrase_does_not_blanket_the_bare_term(alcohol_post):
    result = compliance_check(alcohol_post("Get smashed on sourdough."))
    assert "R3_IRRESPONSIBLE_CONSUMPTION" in rules(result)


def test_a_custom_blocklist_can_be_injected(alcohol_post):
    result = compliance_check(
        alcohol_post("Try the new sour."),
        blocklist={"irresponsible_consumption": ["sour"], "allow_phrases": []},
    )
    assert "R3_IRRESPONSIBLE_CONSUMPTION" in rules(result)


# --------------------------------------------------------------------------
# R7 - hours
# --------------------------------------------------------------------------


def test_claiming_a_closing_time_past_every_day_fails(alcohol_post):
    result = compliance_check(alcohol_post("Open till 10pm, seven days."))
    assert "R7_HOURS" in rules(result)


def test_the_same_claim_scoped_to_the_late_days_passes(alcohol_post):
    result = compliance_check(alcohol_post("Thu-Sat we are open until 10pm."))
    assert result.ok, result.report()


def test_sunday_before_ten_is_its_own_violation(alcohol_post):
    result = compliance_check(alcohol_post("Sunday doors open 8am."))
    assert "R7_SUNDAY" in rules(result)


def test_sunday_from_ten_is_fine(alcohol_post):
    result = compliance_check(alcohol_post("Sunday trading from 10am."))
    assert result.ok, result.report()


def test_licensed_ceiling_may_not_be_advertised(alcohol_post, biz):
    """5am is inside the licence but nowhere near the roller door going up."""
    assert biz.hours.window("licensed", "mon")[0] == parse_hhmm("05:00")
    result = compliance_check(alcohol_post("Open from 5am for the early shift."))
    assert "R7_HOURS" in rules(result)


@pytest.mark.parametrize("phrase", ["open 24 hours", "24/7", "always open", "open till late"])
def test_open_ended_trading_claims_are_rejected(phrase, alcohol_post):
    result = compliance_check(alcohol_post(f"We are {phrase} for you."))
    assert "R7_HOURS" in rules(result)


def test_prices_are_not_mistaken_for_times(alcohol_post):
    result = compliance_check(alcohol_post("Cold singles from $8.50, 2 for $15."))
    assert result.ok, result.report()


def test_a_time_without_an_hours_cue_is_ignored(alcohol_post):
    result = compliance_check(alcohol_post("The 6pm rush is real - we keep the queue short."))
    assert result.ok, result.report()


def test_a_day_range_that_wraps_the_week_is_understood():
    claims = extract_hours_claims("Open Sat-Mon 8am-9pm.")
    assert claims[0].days == ("mon", "sat", "sun")


def test_a_bare_range_inherits_every_day():
    claims = extract_hours_claims("Trading 8am-9pm.")
    assert claims[0].days == ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
    assert claims[0].scoped is False


def test_twentyfour_hour_clock_is_parsed():
    claims = extract_hours_claims("Open 08:00-21:00.")
    assert (claims[0].start, claims[0].end) == (480, 1260)


def test_midnight_and_midday_words_are_parsed():
    claims = extract_hours_claims("Open midday-midnight.")
    assert (claims[0].start, claims[0].end) == (720, 1440)


def test_noon_is_midday():
    claims = extract_hours_claims("Open from noon.")
    assert claims[0].start == 720


@pytest.mark.parametrize("bad", ["Open 13pm.", "Open 25:00."])
def test_impossible_clock_readings_are_not_claims(bad):
    assert extract_hours_claims(bad) == []


def test_twelve_hour_meridiem_edges():
    assert extract_hours_claims("Open from 12am.")[0].start == 0
    assert extract_hours_claims("Open from 12pm.")[0].start == 720


def test_weekend_and_weekday_scopes():
    assert extract_hours_claims("Open 8am weekdays.")[0].days == ("mon", "tue", "wed", "thu", "fri")
    assert extract_hours_claims("Open 10am on the weekend.")[0].days == ("sat", "sun")


def test_closing_cue_produces_an_end_only_claim():
    claim = extract_hours_claims("We are open until 9pm.")[0]
    assert claim.start is None and claim.end == 1260


# --------------------------------------------------------------------------
# R8 - links
# --------------------------------------------------------------------------


def test_a_known_path_passes(biz, alcohol_post):
    url = biz.website.url_for("/specials")
    assert compliance_check(alcohol_post(f"This week's specials: {url}")).ok


def test_an_unknown_path_fails(biz, alcohol_post):
    url = biz.website.canonical_url.rstrip("/") + "/beer-deals"
    assert "R8_LINK_PATH" in rules(compliance_check(alcohol_post(f"Shop {url}")))


def test_an_off_site_link_fails(alcohol_post):
    result = compliance_check(alcohol_post("Order at https://example.com/promo"))
    assert "R8_LINK_HOST" in rules(result)


def test_http_is_rejected(biz, alcohol_post):
    url = biz.website.url_for("/specials").replace("https://", "http://")
    assert "R8_LINK_SCHEME" in rules(compliance_check(alcohol_post(f"Shop {url}")))


def test_a_cta_destination_is_checked_even_when_absent_from_the_text(alcohol_post):
    result = compliance_check(
        alcohol_post("Tap through for the range."), links=["https://example.net/x"]
    )
    assert "R8_LINK_HOST" in rules(result)


def test_a_valid_cta_destination_passes(biz, alcohol_post):
    result = compliance_check(
        alcohol_post("Tap through for the range."), links=[biz.website.url_for("/full-range")]
    )
    assert result.ok, result.report()


def test_utm_parameters_do_not_break_path_validation(biz, alcohol_post):
    url = biz.website.url_for("/specials") + "?utm_source=google&utm_medium=organic"
    assert compliance_check(alcohol_post(f"Specials: {url}")).ok


def test_a_markdown_link_is_checked(alcohol_post):
    result = compliance_check(alcohol_post("[our range](https://example.org/range)"))
    assert "R8_LINK_HOST" in rules(result)


def test_a_bare_host_mention_is_accepted(biz, alcohol_post):
    assert compliance_check(alcohol_post(f"Full range at {biz.website.host}.")).ok


def test_a_www_prefixed_link_is_accepted(biz, alcohol_post):
    assert compliance_check(alcohol_post(f"Visit www.{biz.website.host}/specials")).ok


def test_trailing_punctuation_is_stripped_from_a_link(biz, alcohol_post):
    url = biz.website.url_for("/visit-us")
    assert compliance_check(alcohol_post(f"Find us here: {url}.")).ok


# --------------------------------------------------------------------------
# R9 / R10 / R11 - surfaces and service claims
# --------------------------------------------------------------------------


def test_a_review_reply_must_not_carry_the_footer(compliant_footer):
    result = compliance_check(
        f"Thanks for the kind words! {compliant_footer}",
        kind=ContentKind.NON_ALCOHOL,
        surface=Surface.REVIEW_REPLY,
    )
    assert "R9_REPLY_FOOTER" in rules(result)


@pytest.mark.parametrize("offer", ["free bottle", "drink on us", "complimentary drink"])
def test_a_review_reply_may_not_offer_alcohol_as_compensation(offer):
    result = compliance_check(
        f"Sorry about that - come in for a {offer}.",
        kind=ContentKind.NON_ALCOHOL,
        surface=Surface.REVIEW_REPLY,
    )
    assert "R10_INDUCEMENT" in rules(result)


def test_a_clean_review_reply_passes(biz):
    result = compliance_check(
        "Thanks for taking the time. That is not the experience we want - please "
        f"call us on {biz.contact.phone_display} and we will sort it out.",
        kind=ContentKind.NON_ALCOHOL,
        surface=Surface.REVIEW_REPLY,
    )
    assert result.ok, result.report()


def test_click_and_collect_may_not_be_advertised(biz, alcohol_post):
    assert biz.services.click_and_collect is False
    result = compliance_check(alcohol_post("Click and collect in five minutes."))
    assert "R11_SERVICE_CLAIM" in rules(result)


# --------------------------------------------------------------------------
# result plumbing
# --------------------------------------------------------------------------


def test_violations_are_deduplicated(alcohol_post):
    result = compliance_check(alcohol_post("Boozy boozy boozy."))
    assert len([v for v in result.violations if v.excerpt == "boozy"]) == 1


def test_report_lists_every_violation():
    report = compliance_check("Get smashed.").report()
    assert report.startswith("FAIL")
    assert "R3_IRRESPONSIBLE_CONSUMPTION" in report


def test_report_on_a_pass_is_one_line(alcohol_post):
    assert compliance_check(alcohol_post("Cold beer.")).report() == "PASS (alcohol / post)"


def test_rules_property_preserves_order():
    result = compliance_check("Get smashed, last hour only.")
    assert result.rules == ("R1_LICENCE_NUMBER", "R1_LICENSEE_NAME", "R2_UNDER18_WARNING",
                            "R3_IRRESPONSIBLE_CONSUMPTION", "R5_URGENCY_DISCOUNT")


def test_violation_str_includes_the_excerpt():
    assert str(Violation("R3", "bad", "boozy")) == "[R3] bad -> 'boozy'"
    assert str(Violation("R3", "bad")) == "[R3] bad"


def test_enforce_returns_the_text_untouched(alcohol_post):
    text = alcohol_post("Cold beer in the fridge.")
    assert enforce(text) == text


def test_enforce_raises_and_never_strips():
    with pytest.raises(ComplianceError) as excinfo:
        enforce("Get smashed tonight.", label="post 2026-01-06")
    assert "post 2026-01-06" in str(excinfo.value)
    assert "R3_IRRESPONSIBLE_CONSUMPTION" in str(excinfo.value)


def test_raise_for_status_is_a_no_op_on_a_pass(alcohol_post):
    compliance_check(alcohol_post("Cold beer.")).raise_for_status()


def test_an_unknown_surface_is_a_hard_error():
    with pytest.raises(ValueError):
        compliance_check("hi", surface="billboard")


def test_an_unknown_kind_is_a_hard_error():
    with pytest.raises(ValueError):
        compliance_check("hi", kind="mocktail")


def test_a_service_claim_is_allowed_once_the_service_exists(biz, alcohol_post):
    """Flip services.click_and_collect and the same copy passes."""
    offering = biz.model_copy(
        update={"services": biz.services.model_copy(update={"click_and_collect": True})}
    )
    result = compliance_check(
        alcohol_post("Click and collect in five minutes."), business=offering
    )
    assert result.ok, result.report()


def test_an_empty_cta_destination_is_ignored(alcohol_post):
    assert compliance_check(alcohol_post("Cold beer."), links=["  ", "."]).ok
