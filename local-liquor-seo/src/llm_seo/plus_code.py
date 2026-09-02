"""Open Location Code (Google "plus code") encode/decode.

Google shows a plus code on every Business Profile, so it is a free second
opinion on the store's coordinates: if the code and the lat/lng disagree by more
than a building, one of them is wrong. `business.yaml` carries both and the
schema cross-checks them.

Pair encoding only (codes up to 10 digits, ~14 m). The grid-refinement digits
beyond that are not needed here.
"""

from __future__ import annotations

import math
import re

ALPHABET = "23456789CFGHJMPQRVWX"
BASE = len(ALPHABET)
SEPARATOR = "+"
SEPARATOR_POSITION = 8
_CODE = re.compile(r"^[23456789CFGHJMPQRVWX]{8}\+[23456789CFGHJMPQRVWX]{2}$")

EARTH_RADIUS_M = 6_371_000.0


def encode(lat: float, lng: float, length: int = 10) -> str:
    """Encode a point as a full plus code. Length must be even, 2-10."""
    if length % 2 or not 2 <= length <= 10:
        raise ValueError("length must be an even number between 2 and 10")
    lat = min(max(lat, -90.0), 90.0)
    if lat == 90.0:
        lat -= 1e-9
    lat_value, lng_value = lat + 90.0, (lng + 180.0) % 360.0

    digits, resolution = "", 20.0
    for _ in range(length // 2):
        lat_digit, lng_digit = int(lat_value / resolution), int(lng_value / resolution)
        digits += ALPHABET[lat_digit] + ALPHABET[lng_digit]
        lat_value -= lat_digit * resolution
        lng_value -= lng_digit * resolution
        resolution /= BASE
    return digits[:SEPARATOR_POSITION] + SEPARATOR + digits[SEPARATOR_POSITION:]


def is_full_code(code: str) -> bool:
    return bool(_CODE.match(code.strip().upper()))


def decode(code: str) -> tuple[float, float, float, float]:
    """Full 10-digit code -> (lat_lo, lat_hi, lng_lo, lng_hi) of its cell."""
    cleaned = code.strip().upper()
    if not is_full_code(cleaned):
        raise ValueError(
            f"{code!r} is not a full 10-digit plus code. Google shows a short code "
            "(e.g. '64J5+R5 Marsfield'); prepend the 4-character area prefix."
        )
    digits = cleaned.replace(SEPARATOR, "")
    lat, lng, resolution = -90.0, -180.0, 20.0
    for index in range(0, len(digits), 2):
        lat += ALPHABET.index(digits[index]) * resolution
        lng += ALPHABET.index(digits[index + 1]) * resolution
        resolution /= BASE
    size = resolution * BASE
    return lat, lat + size, lng, lng + size


def centre(code: str) -> tuple[float, float]:
    lat_lo, lat_hi, lng_lo, lng_hi = decode(code)
    return (lat_lo + lat_hi) / 2, (lng_lo + lng_hi) / 2


def shorten(code: str) -> str:
    """The form Google displays beside a locality: '4RRH64J5+R5' -> '64J5+R5'."""
    if not is_full_code(code):
        raise ValueError(f"{code!r} is not a full plus code")
    return code.strip().upper()[4:]


def haversine_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    """Great-circle distance in metres. Also used by the rank grid."""
    lat1, lng1 = math.radians(a[0]), math.radians(a[1])
    lat2, lng2 = math.radians(b[0]), math.radians(b[1])
    dlat, dlng = lat2 - lat1, lng2 - lng1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(h))


def distance_to_cell_m(code: str, lat: float, lng: float) -> float:
    """How far a point sits from the centre of a plus code's cell, in metres."""
    return haversine_m(centre(code), (lat, lng))
