"""Open Location Code round trips. The store's coordinates are cross-checked
against its plus code, so this arithmetic has to be right."""

from __future__ import annotations

import pytest

from llm_seo import plus_code as olc
from llm_seo.paths import project_root


def test_encodes_the_google_example():
    """Google's canonical worked example: the Sydney Opera House."""
    assert olc.encode(-33.857, 151.215, length=8).startswith("4RRH4")


def test_encode_decode_round_trip():
    lat, lng = -33.76776563906253, 151.10798431534218
    code = olc.encode(lat, lng)
    lat_lo, lat_hi, lng_lo, lng_hi = olc.decode(code)
    assert lat_lo <= lat <= lat_hi
    assert lng_lo <= lng <= lng_hi


def test_a_cell_is_about_fourteen_metres():
    lat_lo, lat_hi, lng_lo, lng_hi = olc.decode("4RRH64J5+R5")
    height = olc.haversine_m((lat_lo, lng_lo), (lat_hi, lng_lo))
    assert 13.0 < height < 15.0


def test_shorten_drops_the_area_prefix():
    assert olc.shorten("4RRH64J5+R5") == "64J5+R5"


def test_shorten_rejects_a_short_code():
    with pytest.raises(ValueError):
        olc.shorten("64J5+R5")


@pytest.mark.parametrize("bad", ["64J5+R5", "4RRH64J5", "4RRH64J5+R", "not a code", "4RRH64I5+R5"])
def test_decode_rejects_anything_that_is_not_a_full_code(bad):
    assert olc.is_full_code(bad) is False
    with pytest.raises(ValueError, match="plus code"):
        olc.decode(bad)


def test_encode_rejects_an_odd_length():
    with pytest.raises(ValueError):
        olc.encode(0.0, 0.0, length=7)


def test_the_north_pole_does_not_overflow_the_alphabet():
    assert olc.encode(90.0, 0.0)


def test_haversine_against_a_known_distance():
    """One degree of latitude is ~111 km anywhere on the globe."""
    assert 110_000 < olc.haversine_m((0.0, 0.0), (1.0, 0.0)) < 112_000


def test_haversine_is_zero_for_the_same_point():
    assert olc.haversine_m((-33.7, 151.1), (-33.7, 151.1)) == pytest.approx(0.0)


def test_the_shipped_coordinates_agree_with_the_shipped_plus_code(biz):
    """The invariant the schema enforces, asserted directly on the real config."""
    lat, lng = biz.geo.require()
    gap = olc.distance_to_cell_m(biz.geo.plus_code, lat, lng)
    assert gap <= biz.geo_plus_code_tolerance_m


def test_the_store_sits_in_the_expected_locality(biz):
    """Marsfield NSW 2122 is inside this bounding box. A transposed coordinate,
    a dropped minus sign or a swapped lat/lng all fall outside it."""
    lat, lng = biz.geo.require()
    assert -33.85 < lat < -33.70
    assert 151.03 < lng < 151.18
    assert project_root().is_dir()
