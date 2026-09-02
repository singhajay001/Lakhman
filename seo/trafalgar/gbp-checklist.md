# Google Business Profile — Trafalgar / Local Liquor Marsfield

Two profiles are in play:

| # | Link | Identified as |
|---|---|---|
| 1 | `maps.app.goo.gl/wyZ4GMVoe18M1fkK6` | **Trafalgar Supermarket and Cellars** — Shop 5, 1 Trafalgar Place, Marsfield NSW 2122 · `-33.767749, 151.108628` · **Verified** |
| 2 | `g.page/r/CenxQG-m-gUkEBI` | **Local Liquor Marsfield** — 5A, 1 Trafalgar Place, Marsfield NSW 2122 · `-33.767734, 151.107974` · plus code `64J5+R5` · store code `03435376679661119338` · **Verified** |

Both verified. Phones are **separate**: supermarket (02) 9868 1070, bottle shop
**0452 480 487**. That separation is useful — Google reads phone as an entity
signal, so distinct numbers reinforce two distinct listings.

**Pin separation: 60.5 m.** Measured from the supplied coordinates. Far enough
apart to read as two locations, close enough to be one complex — exactly right
for Shop 5 and Shop 5A. No risk of Google collapsing them on proximity.

### ⚠️ The two profiles format their address differently

| Profile | As entered |
|---|---|
| Trafalgar Supermarket and Cellars | `Shop 5, 1 Trafalgar Place` |
| Local Liquor Marsfield | `1 Trafalgar Pl, 5A` |

Different field order **and** `Place` vs `Pl`. Google normalises internally, but
every downstream citation copies whatever it sees, so this seeds the same
fragmentation the rest of this document is about. Normalise the liquor profile to
`5A, 1 Trafalgar Place` so both read identically. The schema files already
use that form.

### 🔴 Every directory has your opening time wrong by an hour

Owner-confirmed hours:

| Day | Supermarket | Local Liquor |
|---|---|---|
| Mon–Wed | 08:00–21:00 | 08:00–21:00 |
| Thu–Sat | 08:00–22:00 | 08:00–22:00 |
| **Sun** | **08:00**–21:00 | **10:00**–21:00 |

The two differ **only on Sunday morning**, and that difference is licence-driven:
NSW restricts packaged-liquor trading on Sunday mornings. Set the profiles
accordingly — it is a real operational difference, and it reinforces that these
are two genuinely distinct businesses.

**The problem:** aussie-hours, Shopfully and openinghoursau all publish
`09:00–21:00`. The real opening is **08:00**. Every one of them is an hour late,
seven days a week.

This costs money directly rather than in rankings — someone checking at 8:15am is
told you are shut. Fix the profiles first, then work the directories; most re-scrape
from Google over time, but the stale ones need correcting by hand. It is the
highest-value item on this list that has nothing to do with SEO.

## ✅ Shop 5 and Shop 5A settles the two-listing question

The two businesses occupy **distinct suites**. That is the strongest possible
basis for two separate profiles — distinct premises, distinct names, distinct
categories. This is not a department sharing one address that Google might merge;
it is two addressable locations.

Practical consequences:

- Model them as **two independent entities**, not one with a `department`. The
  schema files do exactly that, sharing one parent `Organization`.
- Keep `Shop 5` and `Shop 5A` **exact** everywhere. The suite letter is the thing
  distinguishing them; drop it and they collapse into one address.
- Most existing citations show `Shop 5/1 Trafalgar Place` — those are the
  **supermarket**. The bottle shop is largely uncited, so its citation profile is
  being built from scratch rather than corrected.

## 🔴 Each profile needs its own landing page

Both profiles must not point at the homepage. A GBP whose website link lands on a
generic homepage converts worse and gives Google nothing to tie the entity to.

| Profile | Website link | Schema |
|---|---|---|
| Trafalgar Supermarket | `/supermarket` | `schema/supermarket.jsonld` |
| Local Liquor Marsfield | `/local-liquor` | `schema/local-liquor.jsonld` |

Each page carries the exact profile name in its `<h1>`, its own address with the
suite number, its own hours, and the matching JSON-LD. The homepage carries the
umbrella `Organization` and links to both.

If MyFoodLink cannot host two distinct pages with custom JSON-LD, that is a
material constraint — establish it early with their support.

---

## 🔴 Still the biggest problem: five names, one address

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

**Settled.** Profile 1 reads **Trafalgar Supermarket and Cellars**, which matches
the canonical domain and the largest citation cluster. So the identity is:

| Tier | Name | Where |
|---|---|---|
| Umbrella / legal | Trafalgar Supermarket and Cellars | domain, `Organization` schema, homepage |
| Location 1 | **Trafalgar Supermarket and Cellars** | GBP 1, `/supermarket`, citations |
| Location 2 | **Local Liquor Marsfield** | GBP 2, `/local-liquor`, citations |

The umbrella and the supermarket share a name, which is fine and in fact
convenient — it means the domain, the `Organization`, the supermarket profile and
most existing citations already agree. The convergence work is therefore smaller
than first estimated: retire **Trafalgar Cellars** (cellars.com.au, Pink Pages)
and get **friendlygrocer.com.au** to merge its two duplicate pages. That is most
of it.

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
- **distinct phone numbers** — already the case, and a genuine strength
- both genuinely operating, with their own hours where they differ

If the bottle shop is just an aisle with no separate identity, one listing is the
safer call. Two listings for one undifferentiated business risks both being
merged or filtered.

---

## Priority order

### 1. Claim and verify both profiles — blocks everything else
Unverified profiles cannot be edited and rank poorly. Confirm ownership of both.

### 2. Point each profile at its own landing page
Not the homepage. See the table above.

### 3. Fix the categories
Primary category is the strongest single ranking lever in the pack.

| Profile | Primary | Secondary |
|---|---|---|
| Supermarket | Supermarket | Grocery Store · Convenience Store |
| Local Liquor Marsfield | Liquor Store | Wine Store · Beer Store |

One primary each. Do not stack unrelated secondaries.

### 4. Hours, including public holidays
NSW public holidays especially. A "hours might differ" label on a holiday
suppresses confidence and costs visits. Set special hours ahead of each one.

### 5. Converge the name and address everywhere
Work through, highest authority first — GBP, then the website, then:
Facebook · Instagram · Apple Maps · Bing Places · Yelp · Yellow Pages · True
Local · Cylex · dlook · Pink Pages · cellars.com.au (fix the `Shiop` typo) ·
friendlygrocer.com.au (**ask the banner to merge its two duplicate pages**) ·
Tiendeo · Shopfully · openinghoursau · aussie-hours · wheree.

The `friendlygrocer.com.au` duplicate is worth chasing: a banner site is an
authoritative citation, and it currently contradicts itself.

### 6. Photos
Storefront with signage, street view, interior, aisles, the bottle shop section,
staff. Geotagging images does nothing — Google strips EXIF. Photo *recency* and
volume do matter.

### 7. Products and services
The liquor profile especially — list stocked ranges. Feeds "near me" matching for
specific brands.

### 8. Reviews
Steady velocity beats bursts. Respond to **all**, including negatives — response
rate is itself a quality signal.

The review short-link (`g.page/r/...`) is the correct tool: print it as a QR code
at the register and on receipts. Ask every customer, in person, at the counter.

⚠️ Do not filter customers by expected rating before asking (review gating), do
not offer anything in exchange for a review, and do not post reviews for your own
business. All three violate Google's policies and risk removal of every review on
the profile, not just the offending ones.

### 9. Q&A
Seed the genuinely common questions and answer them from the business account:
parking, bottle shop hours vs supermarket hours, delivery, accepted payment.

### 10. Posts
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
