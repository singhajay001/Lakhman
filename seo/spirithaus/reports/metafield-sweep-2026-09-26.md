# Spirithaus — full metafield sweep, all 439 products
2026-09-26

Dumped every product in the store via a bulk operation (439 products, 3,363
objects) and checked each against the nine `custom` metafield definitions the
theme's spec table reads. Then filled every gap that could be filled from a
verifiable fact.

## Headline

**Live products: 257. Every one has an image, a description, an SEO title and an
SEO description — no gaps at all on those four.**

On the six core spec metafields, live coverage after this sweep:

| Metafield | Before | After | Missing |
|---|---|---|---|
| `country` | 251/257 | **257/257** | 0 |
| `producer` | 250/257 | **257/257** | 0 |
| `style` | 249/257 | **257/257** | 0 |
| `volume_ml` | 255/257 | 256/257 | 1 |
| `abv` | 244/257 | 245/257 | 12 |
| `standard_drinks` | 243/257 | 245/257 | 12 |
| `region` | 242/257 | 248/257 | 9 |
| **All six together** | **242/257** | **245/257** | **12** |

## What was filled this sweep

32 metafield values written across 10 products, all with zero errors:

- **Brokenwood Graveyard Shiraz**, **Deutz Amour de Deutz**, **San Polo Brunello
  Vignavecchia**, **Poggio al Tesoro Dedicato a Walter** — these are the fine
  wines published yesterday with an image but no specs. Country, region,
  producer and style added to all four.
- **Kaesler Old Bastard Shiraz** — the full six, including ABV 14.5% and 8.5
  standard drinks, both sourced from the Dan Murphy's capture rather than guessed.
- **Dom Perignon Rose** — region, producer, style.
- **Veuve Clicquot La Grande Dame** — style.
- **Squealing Pig Rose** — style (its only gap).
- **Tequila Blu** — had *no* metafields at all. Volume, country, producer, style added.
- **Lark Devil's Storm No. 183** — standard drinks **derived arithmetically**
  from the ABV and volume already on file (700ml x 42% x 0.789 = 23.2). This was
  the only product in the store where the figure could be computed rather than
  looked up.

## The 12 live products still missing ABV and standard drinks

These were deliberately left blank rather than filled with a plausible number.

**Vintage wine and champagne (8)** — ABV legitimately changes from vintage to
vintage, so a single stored figure would be the same overclaim the
`current_vintage` disclaimer was built to avoid: Brokenwood Graveyard, Deutz
Amour de Deutz, San Polo Vignavecchia, Poggio Dedicato a Walter, Dom Perignon
Rose, Moet & Chandon Dom Perignon, Penfolds Grange, Veuve Clicquot La Grande Dame.

**Batch-variable (1)** — **Aberlour A'bunadh** is cask strength and every batch
is bottled at a different ABV. There is no correct single value.

**Genuinely unknown (2)** — **Divas VKAT** (the Dan Murphy's capture had no ABV)
and **Tequila Blu**.

**Not applicable (1)** — **Nobby's Salted Peanuts 170g** is a snack, not a drink.
ABV, volume and standard drinks should stay empty; the store carries a small
number of non-alcohol lines and they should be excluded from this expectation.

All eleven of the first three groups need the bottle in hand. They are listed in
the worksheet with blank columns to write into.

## The 171 products not yet live

155 of 182 non-live products are missing the core set. This is not a defect — it
is the pipeline in its normal state. These are the drafts waiting on an image,
and the image queue's "Additional Info" column is precisely how their specs get
captured. `volume_ml` is already at **182/182** because it comes from the product
title; everything else needs the label.

Coverage on non-live: `volume_ml` 182/182, `producer` 52, `style` 50, `country`
47, `abv` 32, `standard_drinks` 32, `region` 31.

## Two other gaps worth naming

- **148 of 257 live products have no barcode.** Without a GTIN, Google Merchant
  Center match rates drop and the `Product` schema is weaker. Most of these are
  ALM Connect lines, which carry no barcode on file at all, so these have to be
  scanned off the bottle.
- **39 of 257 live products have no cost.** Margin on those is unknown.

## Editorial fields, for completeness

`why_we_stock_it` is on 209 of 257 live products (48 missing) and `rrp` on 63 of
257. Neither is a spec field and neither affects schema — `why_we_stock_it` is
merchandising copy and `rrp` only matters where a compare-at price is being shown.

## Worksheet

`worksheets/metafield-gaps-2026-09-26.csv` — 189 rows, sorted live-first, with
the missing fields named per product and blank columns for ABV, standard drinks,
country, region, producer and style. 18 live rows, 171 not-live.
