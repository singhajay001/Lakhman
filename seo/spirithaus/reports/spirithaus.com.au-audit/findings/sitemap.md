# Sitemap & indexable-surface analysis — spirithaus.com.au

**2026-09-24.** Source: Shopify Admin API, not a crawl. See *Method* at the end.

## What Shopify will put in `sitemap.xml`

| Resource | In sitemap | Excluded | Why excluded |
|---|---|---|---|
| Products | **209** | 142 | 141 `DRAFT`, 1 `ARCHIVED` |
| Collections | **29** | 0 | — |
| Pages | **7** | 0 | all published |
| Blog | **1** | 0 | — |
| Articles | **6** | 0 | all published, all dated today |
| **Total** | **~252 URLs** | | |

No product carries a `seo.hidden` metafield, so nothing is being suppressed from
the sitemap by that route — checked directly, not inferred.

---

## CRITICAL — `/collections/fine-wine` is an empty page with full SEO copy

**139 products in the collection. 0 of them are live.** Every single one is a
draft.

The collection has a hand-written title and meta description:

> **Fine Wine — Hill of Grace, RunRig, The Armagh | Spirithaus**
> Collectable Australian fine wine: Henschke, Torbreck, Jim Barry, Clonakilla,
> Cullen and d'Arenberg. Sydney metro delivery.

That URL goes in the sitemap. Google crawls it, finds a collection page with no
products, and holds a meta description naming eight wines that cannot be bought.
This is a textbook soft 404, and it is worse than an ordinary one because the
sitemap is actively nominating it and the metadata is actively promising
inventory.

**Do not fix this by writing more copy.** The page is empty because the products
are drafts, and the products are drafts because 114 of them are priced $0.00.

---

## The wine side of the catalogue is hollow

| Collection | Products in collection | Live | Draft |
|---|---|---|---|
| Fine Wine | 139 | **0** | 139 |
| Fortified & Dessert | 12 | **2** | 10 |
| Champagne | 14 | **4** | 10 |
| Rosé | 16 | **6** | 10 |
| White | 50 | **10** | 40 |
| Red | 60 | **11** | 49 |
| Sparkling | 49 | **19** | 30 |
| Wine (parent) | 191 | **52** | 139 |
| Moscato | 4 | 4 | 0 |

Compare the spirits side, which is healthy:

| Collection | Products | Live | Draft |
|---|---|---|---|
| Spirits | 153 | 150 | 2 (+1 archived) |
| Whisky | 37 | 35 | 2 |
| Gin | 29 | 29 | 0 |

A visitor landing on `/collections/red` from a search for Barossa shiraz sees
11 bottles, not 60. The collection description says the range "runs from under
$10 to Henschke Hill of Grace" — Hill of Grace is one of the 139 drafts.

**Every one of these is the same root cause.** 139 of the 141 drafts are wine.

---

## HIGH — two collections are in the sitemap with nothing in them

| Collection | Rule | Live products |
|---|---|---|
| New This Month | `TAG EQUALS "new"` | **0** — nothing is tagged `new` |
| Specials | `IS_PRICE_REDUCED IS_SET` | **1** |

`New This Month` has a written title and meta description and matches nothing at
all. It is a second soft 404, and unlike Fine Wine it will not fix itself when
the drafts publish — no product carries the `new` tag, so the rule can never
match until something is tagged.

`Specials` working as designed is fine; a one-product specials page is not. The
collection description makes a virtue of this ("If it is empty, nothing is on
special today"), which is honest, but a near-empty page in the sitemap still
spends crawl budget and offers nothing to rank.

The `Home page` / `frontpage` collection holds 1 product. Shopify's handling of
`/collections/frontpage` in the sitemap varies; worth confirming against the live
file once the store is reachable.

---

## MEDIUM — no product has a custom SEO title or meta description

All 20 products sampled (and the 5 before them) return `seo.title: null` and
`seo.description: null`. Shopify falls back to the product title and the opening
of the body copy, which is serviceable but leaves the single highest-leverage
snippet on the page unwritten across all 209 live products.

This matters more here than it usually would. The profile records that
`spirithaus` is a homophone of `spirithouse.com.au`, an established Sunshine
Coast restaurant, and that brand queries are not a viable channel. Product
queries are. A written meta description is where `buy yamazaki 12 australia`
gets answered in the SERP.

The product metafields are in good shape by contrast — `abv`, `country`,
`producer`, `region`, `standard_drinks`, `style`, `volume_ml` and a written
`why_we_stock_it` are all populated on the sample.

---

## Method, and what this analysis could NOT check

Built from the Shopify Admin API, which is the system that *generates*
`sitemap.xml` — so the URL inventory above is authoritative, more so than a crawl
of the rendered file would be.

**This session's egress proxy blocks all outbound page fetches** (`curl` to
`https://www.spirithaus.com.au/sitemap.xml` returns `CONNECT tunnel failed,
response 403`). The following therefore could not be checked and are **not**
covered by any statement above:

- Whether `sitemap.xml` is actually being served, and what it contains
- `robots.txt` contents and whether it permits crawling
- **Whether the storefront is still password-protected.** The profile records it
  as password-protected as of 2026-09-10. The Admin API exposes no field for
  this, so it could not be confirmed or ruled out. If it is still on, none of
  the above has reached Google yet — which makes these cheap to fix now rather
  than expensive to fix after indexing.
- Canonical tags, hreflang, rendered HTML, Core Web Vitals
- Current index coverage (the profile records `site:spirithaus.com.au` returning
  zero results as of 2026-09-10)

The live theme is `spirithaus-theme/main`, role `MAIN`, last updated
2026-09-18 — so the custom theme is published, not a draft.

Run the live-fetch half from Claude Code in a local terminal.
