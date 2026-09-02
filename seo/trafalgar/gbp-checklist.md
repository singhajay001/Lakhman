# Google Business Profile — Trafalgar / Local Liquor Marsfield

Two profiles are in play:

| # | Link | Identified as |
|---|---|---|
| 1 | `https://maps.app.goo.gl/wyZ4GMVoe18M1fkK6` | **unresolved** — this session's egress proxy blocks the fetch |
| 2 | `https://g.page/r/CenxQG-m-gUkEBI` | **Local Liquor Marsfield** (from the review-link text) |

Confirm which is which before acting. The whole plan below turns on it.

---

## 🔴 The finding that matters most: five names, one shop

The business is listed under **five different names** across the web. This is
almost certainly the single largest thing suppressing local ranking, and no
amount of content or schema work will outrun it.

| Name | Where it appears |
|---|---|
| **Local Liquor Marsfield** | **the Google Business Profile** |
| Trafalgar Supermarket and Cellars | Facebook, Yelp, Cylex, dlook, aussie-hours, wheree, the .com.au domain |
| Trafalgar Cellars / Trafalgar Cellars Of Marsfield | cellars.com.au, Pink Pages |
| Friendly Grocer Marsfield | friendlygrocer.com.au, Tiendeo, Shopfully, openinghoursau |
| Trafalgar Supermarket | friendlygrocer.com.au — a **second, separate page** on the banner's own site |

Address is fragmented too: `1 Trafalgar Place` vs `Shop 5/1 Trafalgar Place`,
plus a `Shiop 5/1` typo on cellars.com.au.

Google resolves a local entity by agreement across sources. Five names and three
address formats give it five weak signals instead of one strong one. Competitors
with one consistent name will outrank this store on proximity alone.

**Consistent across every source, and therefore trustworthy:**

- Phone **02 9868 1070** — identical everywhere found
- Suburb **Marsfield NSW 2122**, City of Ryde
- Hours **9:00am – 9:00pm**, seven days (agrees across aussie-hours, Shopfully,
  openinghoursau — still confirm against the door)

## Decide the canonical name first

Everything downstream depends on this. Pick **one** legal-facing trading name and
use it byte-for-byte everywhere — GBP, website, schema, every citation.

The tension: the GBP says "Local Liquor Marsfield" while the domain and most
citations say "Trafalgar Supermarket and Cellars". One has to give.

**Recommendation:** make **Trafalgar Supermarket and Cellars** canonical for the
supermarket, and keep **Local Liquor Marsfield** as the bottle shop's own name.
It matches the registered business name, the canonical domain, and the largest
group of existing citations — so it is the cheapest to converge on.

⚠️ GBP names must reflect real-world signage. Do not add keywords ("Trafalgar
Supermarket and Cellars Marsfield Bottle Shop") — that is a name-spam violation
and risks suspension. The name on the profile should be the name on the door.

## Two profiles at one address — legitimate, but only if it stays honest

Google permits a **department** within a business to have its own profile when it
has a distinct name, category, and customer-facing presence. A bottle shop inside
a supermarket is a textbook fit — this is why the schema models it as
`GroceryStore` with a `department` of `LiquorStore`.

To keep both listings safe:

- distinct **primary categories** — Supermarket / Grocery Store vs Liquor Store
- distinct **names**, matching real signage
- **same** address and phone (or a dedicated line for the bottle shop)
- both genuinely operating, with their own hours where they differ

If the bottle shop is just an aisle with no separate identity, one listing is the
safer call. Two listings for one undifferentiated business risks both being
merged or filtered.

---

## Priority order

### 1. Claim and verify both profiles — blocks everything else
Unverified profiles cannot be edited and rank poorly. Confirm ownership of both.

### 2. Fix the categories
Primary category is the strongest single ranking lever in the pack.

| Profile | Primary | Secondary |
|---|---|---|
| Supermarket | Supermarket | Grocery Store · Convenience Store |
| Local Liquor Marsfield | Liquor Store | Wine Store · Beer Store |

One primary each. Do not stack unrelated secondaries.

### 3. Hours, including public holidays
NSW public holidays especially. A "hours might differ" label on a holiday
suppresses confidence and costs visits. Set special hours ahead of each one.

### 4. Converge the name and address everywhere
Work through, highest authority first — GBP, then the website, then:
Facebook · Instagram · Apple Maps · Bing Places · Yelp · Yellow Pages · True
Local · Cylex · dlook · Pink Pages · cellars.com.au (fix the `Shiop` typo) ·
friendlygrocer.com.au (**ask the banner to merge its two duplicate pages**) ·
Tiendeo · Shopfully · openinghoursau · aussie-hours · wheree.

The `friendlygrocer.com.au` duplicate is worth chasing: a banner site is an
authoritative citation, and it currently contradicts itself.

### 5. Photos
Storefront with signage, street view, interior, aisles, the bottle shop section,
staff. Geotagging images does nothing — Google strips EXIF. Photo *recency* and
volume do matter.

### 6. Products and services
The liquor profile especially — list stocked ranges. Feeds "near me" matching for
specific brands.

### 7. Reviews
Steady velocity beats bursts. Respond to **all**, including negatives — response
rate is itself a quality signal.

The review short-link (`g.page/r/...`) is the correct tool: print it as a QR code
at the register and on receipts. Ask every customer, in person, at the counter.

⚠️ Do not filter customers by expected rating before asking (review gating), do
not offer anything in exchange for a review, and do not post reviews for your own
business. All three violate Google's policies and risk removal of every review on
the profile, not just the offending ones.

### 8. Q&A
Seed the genuinely common questions and answer them from the business account:
parking, bottle shop hours vs supermarket hours, delivery, accepted payment.

### 9. Posts
Weekly is enough. Specials, seasonal ranges, holiday hours.

---

## What this does *not* need

National keyword strategy, blog content, topic clusters, link building. For a
suburban store the map pack decides the outcome, and the pack is decided by
proximity, prominence, and relevance — not content volume.

## Measuring it

Ranking #1 for your own business name proves nothing. Track instead:

- **GBP Insights** — direction requests, calls, website clicks
- **Discovery vs direct searches** — the ratio that shows you are being *found*
  rather than *looked up*
- **Geo-grid rank** for `bottle shop near me` and `supermarket near me` across a
  radius, via `/seo maps` once running locally

Capture these before changing anything, so the effect is provable.
