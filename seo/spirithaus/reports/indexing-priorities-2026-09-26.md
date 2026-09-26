# Spirithaus — indexing priorities and what was done

**Date:** 2026-09-26. Spirithaus only.

## Correction to the earlier advice

I previously said the next action was to publish the fine-wine drafts now that
they were costed and priced. That was wrong, and checking the store showed why:
**zero of the 280 drafts were publish-ready.** 278 had no SEO title or
description, 251 had no body copy, 248 had no image. Publishing them would have
put thin, image-less pages in front of Googlebot — which is what earns
"Crawled – currently not indexed" rather than an index entry.

## Store state at the start

| | Live (206) | Draft (280) |
|---|---:|---:|
| No or thin body copy | 23 | 251 |
| Missing SEO title or description | 0 | 278 |
| No image | 0 | 248 |
| A variant with no barcode | 121 | 264 |
| A variant with no cost | 19 | 115 |
| A variant at $0.00 | 0 | 94 |

## Priority order

| # | Item | Count | Owner | Status |
|---|---|---:|---|---|
| 1 | Live products with zero body copy | 23 | me | **done** |
| 2 | Drafts needing only copy + SEO | 32 | me | **done** |
| 3 | Backlinks — the root cause of discovery | — | owner | open |
| 4 | Drafts with no image | 248 | owner | blocked on photography |
| 5 | Drafts at $0.00 / no cost | 94 / 115 | owner | blocked on fine-wine quote sheet |
| 6 | Mangled product handle | 1 | me | **done** |
| 7 | Live variants with no barcode | 121 | me | open |
| 8 | Verify theme deploy | 2 | me | **done** |

## 1. The 23 live pages with no copy — fixed

Every live product now has body copy. These were the only pages Google could
already crawl and was declining, so they were the first thing worth fixing.

Four are Karu Distillery products, which are obscure enough that writing from
memory would have risked inventing detail. Those were researched first — the
Pourtrait botanical list, the Outcask second maturation in ex-whisky barrels,
and the Morita & Grapefruit finger lime and lake salt are all from the
distillery's own published material, not guessed.

**ABV was deliberately left out.** The existing SEO descriptions on other
products carry an ABV figure, but there is no ABV field anywhere in this store
and inventing one on an alcohol product is a labelling risk. If you supply the
figures, or I read them off the bottles, they can be backfilled.

## 2. The 32 drafts — fixed

These 32 already had an image and a real price, so copy and SEO fields were all
that stood between them and publication. All 32 now have an SEO title and
description; the six that also lacked body copy (Grange, Krug Grande Cuvée,
Krug Vintage, Dom Pérignon, Dom Pérignon Rosé, La Grande Dame) now have it.

SEO fields follow the pattern already in the store: `Name 750ml | Region or
category` for the title, and `Name, 750ml. One-line hook.` for the description.

**They have not been published.** Inventory is not tracked on these products
(`tracked: false`), so publishing makes them immediately orderable whether or
not the stock exists — including Grange at $1,209.99. That is a commercial
call, not an SEO one. See the open question below.

## 6. Handle fault — one, not four

An earlier note claimed four accent-mangled handles. Checking all 30
accented-title products, only **one** was actually broken:
`mo-t-and-chandon-dom-perignon` — the `ë` in Moët was dropped, leaving `mo-t`.
Renamed to `moet-chandon-dom-perignon`, matching the `moet-chandon-*`
convention already used by the Rosé and Vintage.

The others flagged earlier (`patron-silver`, `1800-anejo`, `patron-xo-cafe`,
`moet-et-chandon-brut-imperial-nv`) are deliberately shortened handles, not
faults, and were left alone. No 301 was needed: the renamed product is a draft,
so nothing was indexed under the old handle.

## 8. Theme deploy — verified

Both merged PRs are confirmed on the live (MAIN) theme
`spirithaus-theme/main`, read back through the Admin API rather than assumed:

- `templates/robots.txt.liquid` carries the merged PR #5 version, with the
  `wildcard_rules` capture re-emitted inside each AI crawler group. This is the
  RFC 9309 fix — groups do not inherit, so a bare `Allow: /` would have left
  those crawlers unrestricted across `/search`, `/cart` and the faceted
  `/collections` space.
- `snippets/sh-rrp.liquid`, `snippets/price.liquid` and
  `snippets/sh-reduced.liquid` are all present from PR #6.

The rendered pages could not be fetched — this session's egress proxy blocks
`spirithaus.com.au` — so the file contents are confirmed but the rendered
`/robots.txt` and the RRP line on a product page still want one look from a
local terminal.

## Published — and a trap worth recording

Owner confirmed: publish all 32. Done. The store now has **238 live products**,
up from 206.

**Setting `status: ACTIVE` was not enough.** After the status change, Grange and
Krug still returned `onlineStoreUrl: null` — they were ACTIVE and published to
Point of Sale and Shop, but never to the **Online Store** sales channel. A
product in that state has no public URL at all: Googlebot gets a 404, and no
amount of sitemap submission or SEO metadata makes any difference.

It took a second mutation (`publishablePublish` against publication
`199293468918`) to give them real URLs. Worth remembering for every future
product: in this store, newly created products are not on the Online Store
channel by default.

A store-wide check afterwards confirmed **all 238 active products now carry an
`onlineStoreUrl`** — no pre-existing product was silently in this state.

### The 32 now live

Best's Thomson Family Shiraz · Bollinger La Grande Année · Chandon Vintage Brut ·
Clonakilla Shiraz Viognier · Cullen Diana Madeline · Dom Pérignon Rosé ·
Duckhorn Napa Valley Merlot · Henschke Hill of Grace · Howard Park Abercrombie ·
Irvine Grand Merlot · Jansz Tasmania Vintage Cuvée · Jim Barry The Armagh ·
Krug Grande Cuvée · Krug Vintage · Lark Devil's Storm No. 183 ·
Louis Roederer Cristal · Morris Old Premium Rare Muscat · Moët & Chandon Dom
Pérignon · Penfolds Grandfather · Penfolds Grange · Penfolds Great Grandfather ·
Petaluma Coonawarra · Taittinger Comtes de Champagne · Tapanappa Whalebone ·
Tequila Blu · Torbreck RunRig · Veuve Clicquot La Grande Dame · Woodlands
Cabernet Merlot · Yalumba Antique Tawny · Yalumba The Menzies · Yalumba The
Octavius · d'Arenberg The Dead Arm Shiraz

Inventory is untracked on all of them, so they are orderable as special orders.

## Next

1. **Backlinks** — still the binding constraint on discovery.
2. **Images for the remaining 248 drafts** — the bottleneck on the rest of the catalogue.
3. **Costs for the 115 uncosted / 94 unpriced drafts** — from the fine-wine quote sheet.
4. Shopify regenerates `sitemap.xml` automatically, so the 32 new URLs will
   appear there shortly. Worth a re-fetch in GSC once they do.
5. Delete the erroneous homepage-as-sitemap row in GSC.
6. ABV backfill across the catalogue, if you want the SEO descriptions to carry it.
