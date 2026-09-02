# Google Business Profile audit — Trafalgar Supermarket and Cellars

Status: **not yet observed.** Every other profile in this workspace has been
checked against live data; this one has not. The values below are what the
profile *should* say, drawn from owner-confirmed facts. Open the profile, work
down the table, and record what is actually there.

Profile: `maps.app.goo.gl/wyZ4GMVoe18M1fkK6`
Coordinates: `-33.767749, 151.108628` · **Verified**

Do this from a browser signed in as the profile owner, not from a search result —
a search result hides several of the fields below.

---

## The audit

| # | Field | Should be | Live | OK? |
|---|---|---|---|---|
| 1 | Name | `Trafalgar Supermarket and Cellars` | | ☐ |
| 2 | Primary category | **Supermarket** | | ☐ |
| 3 | Secondary categories | Grocery store. **Nothing liquor.** See below. | | ☐ |
| 4 | Address | `Shop 5, 1 Trafalgar Place, Marsfield NSW 2122` | | ☐ |
| 5 | Phone | `(02) 9868 1070` | | ☐ |
| 6 | Sun–Wed hours | 08:00 – 21:00 | | ☐ |
| 7 | Thu–Sat hours | 08:00 – 22:00 | | ☐ |
| 8 | Website | see "the website field" below | | ☐ |
| 9 | Attributes | In-store shopping, Delivery, Wheelchair-accessible entrance, Free parking | | ☐ |
| 10 | Products / services | Groceries, fresh produce, deli, bakery | | ☐ |
| 11 | Description | 750 characters, mentions Marsfield and Trafalgar Place | | ☐ |
| 12 | Photos | Owner photos present, most recent within 3 months | | ☐ |
| 13 | Reviews | Every review has an owner reply | | ☐ |
| 14 | Q&A | Seeded with at least 3 real questions, answered | | ☐ |
| 15 | Posts | At least one in the last 30 days | | ☐ |
| 16 | Duplicate listings | Search "Friendly Grocer Marsfield" and "Trafalgar Supermarket" on Maps | | ☐ |

---

## 🔴 Row 3 is the one that matters: keep liquor categories off this profile

The two businesses are 60.5 m apart and share a street address. The only things
holding them apart in Google's index are name, suite number, phone, category and
website. Category is the weakest of the five and the easiest to break.

If this profile carries **Liquor store**, **Bottle shop**, **Wine store** or
similar as a secondary category, it enters the same local pack as Local Liquor
Marsfield. Two of your own listings then compete for one slot, and Google picks
one — usually the older, better-reviewed one, which is the supermarket. The
bottle shop is the listing you are trying to grow, so it loses.

**Check this first. If a liquor category is on there, remove it.**

## ⚠️ The name contains "Cellars", and that pulls the same way

`Trafalgar Supermarket and Cellars` is the real registered trading name, so it
stays — a name that does not match the signage is a worse problem than this one.
But be aware of the trade-off: the word "Cellars" makes this profile
partially relevant to liquor queries whether or not the category says so.

Two things follow:

1. **Do not reinforce it.** No liquor categories, no liquor products, no bottle
   photos, no posts about spirits on this profile. Liquor content belongs on
   Local Liquor Marsfield.
2. **Do reinforce the other side.** Groceries, produce, deli, bakery, and the
   Friendly Grocer relationship. The more clearly this profile reads as a
   supermarket, the less it competes.

This is why `seo/trafalgar/citations/` retires "Trafalgar Cellars" as a separate
entity everywhere it appears. The name on the GBP is the one instance that has to
stay.

## The website field

`trafalgarsupermarketandcellars.com.au` is the canonical domain, but the site is
still being built on MyFoodLink and is `noindex` while under construction.

**Do not point the profile at a noindex page.** Until the supermarket site
launches, leave the website field as it is. When it launches:

1. Remove the `noindex`.
2. 301 `trafalgar-grocery.myfoodlink.com` → the canonical domain.
3. Then set the GBP website field.

Do them in that order. Setting the field first sends your most motivated visitors
to a page Google has been told to ignore.

Note this is the opposite of the advice for Local Liquor Marsfield, where the
website field is empty and the site is ready — that one should be set the day the
site goes live.

## Row 16 — the duplicates

`friendlygrocer.com.au` carries two pages for this store
(`/friendly-grocer-marsfield` and `/trafalgar-supermarket`). If that duplication
is also present on Google Maps as two listings, the fix is different and more
urgent: request removal of the wrong one through the profile, rather than a
merge request to the banner.

Search Maps for both names before assuming it is only a website problem. The
draft merge request for the website is in
`seo/trafalgar/citations/correction-requests.md` §3.

---

## When you have filled this in

Record what was actually live, the way `gbp-live-audit.md` does for the bottle
shop. An audit sheet with empty "Live" cells is a plan, not a record — and the
last time this workspace assumed a profile's contents rather than looking, the
phone number was wrong across 47 places on the site.
