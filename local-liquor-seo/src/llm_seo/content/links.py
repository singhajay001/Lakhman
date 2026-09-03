"""Link construction and UTM tagging.

Every outbound URL in generated copy goes through `tag_url()`. Hand-written
tags drift - a stray `utm_campaign=gbp-post` and GA4 splits the channel in two
without telling you.
"""

from __future__ import annotations

import re
import unicodedata
from urllib.parse import urlencode

from ..business import Business

# One campaign per GBP surface so GA4 can separate them.
CAMPAIGN_POST = "gbp_post"
CAMPAIGN_PRODUCT = "gbp_product"
CAMPAIGN_QANDA = "gbp_qanda"
CAMPAIGN_PROFILE = "gbp_profile"

UTM_SOURCE = "google"
UTM_MEDIUM = "organic"

_SLUG_STRIP = re.compile(r"[^a-z0-9]+")


def slugify(text: str, *, max_length: int = 60) -> str:
    """'Just landed: Example Pale Ale' -> 'just-landed-example-pale-ale'."""
    folded = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    slug = _SLUG_STRIP.sub("-", folded.lower()).strip("-")
    if len(slug) <= max_length:
        return slug
    return slug[:max_length].rsplit("-", 1)[0].strip("-")


def tag_url(business: Business, path: str, *, campaign: str, content: str) -> str:
    """A canonical site URL with UTM parameters attached.

    Raises if `path` is not in website.site_paths - a CTA to a 404 is worse than
    no CTA, so this fails the build rather than shipping a dead link.
    """
    base = business.website.url_for(path)
    query = urlencode(
        {
            "utm_source": UTM_SOURCE,
            "utm_medium": UTM_MEDIUM,
            "utm_campaign": campaign,
            "utm_content": slugify(content),
        }
    )
    return f"{base}?{query}"


def profile_url(business: Business) -> str:
    """The URL for the GBP profile's website field. Deliberately untagged.

    Tagging the profile's main website field pollutes every click Google sends
    from the listing, including ones that have nothing to do with a campaign.
    """
    return business.website.canonical_url


def answer_url(business: Business, path: str) -> str:
    """A link for a GBP Q&A answer. Untagged - answers do not carry UTMs reliably."""
    return business.website.url_for(path)
