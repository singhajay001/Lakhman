# Spirithaus — product spec metafields complete
2026-09-27

Processed the completed audit workbook. **353 values written across 190 products,
every call with zero errors.** ABV and standard drinks are now populated on all
439 products in the store.

## Final coverage

| Metafield | LIVE (257) | Drafts (182) |
|---|---|---|
| `abv` | **257 / 257** | **182 / 182** |
| `standard_drinks` | **257 / 257** | **182 / 182** |
| `country` | **257 / 257** | 178 / 182 |
| `producer` | **257 / 257** | 181 / 182 |
| `style` | **257 / 257** | **182 / 182** |
| `volume_ml` | 256 / 257 | **182 / 182** |
| `region` | 256 / 257 | 180 / 182 |
| `why_we_stock_it` | **257 / 257** | 2 / 182 |
| **all six core together** | **256 / 257** | **177 / 182** |

Before this session's work began, the same figures were 242/257 live and 27/182
on the drafts.

## Validation done before writing

The standard-drinks column was recomputed independently from volume and ABV.
**161 of 162 matched to within 0.05** — the exception being the bag of peanuts,
which has no volume. That is a clean internal-consistency pass.

I also spot-checked two values against published sources, because I had doubted
them:

- **Campari at 25%** — correct for the Australian bottling, and 13.8 standard
  drinks matches the 14 that retailers publish.
- **Cloudy Bay Te Koko at 13.5%** — matches the current release; only the 2015
  vintage ran at 14%.

I had initially read the distribution as suspicious: 162 values across only 14
distinct numbers, 99% landing exactly on .0 or .5. That reasoning was wrong.
Australian and New Zealand wine labels overwhelmingly declare ABV in 0.5%
increments, so a tight, round distribution is what a correct dataset looks like
here. The spot checks confirmed it.

## Also resolved

**Tar & Roses Local Hero Barolo.** The producer/appellation conflict I flagged
earlier is settled — the workbook confirms Italy, Barolo, Piedmont, so country,
region and style are now written. The `producer` field is still empty because the
vendor field reads "Tar & Roses", which is an Australian Heathcote producer. It
is most likely an importer or range name on an Italian wine. **One field, one
question, and it is the last open item on this product.**

**Nobby's Salted Peanuts** is now 0% ABV and 0 standard drinks rather than blank,
which stops it appearing as a gap. `volume_ml` stays empty because 170g is a
weight, not a volume.

## Two values held back

- **Smirnoff Red 1L and 700ml** — the workbook gives region "United Kingdom", but
  `country` is already "Australia" on both, from the ALM record for the
  Australian-bottled product. Writing UK would contradict the country on the same
  spec table, so both were held. Worth confirming which is right.
- **Captain Morgan (both sizes), Kraken and Sailor Jerry** keep an empty
  `country`. All three are blends of Caribbean rums, and `region` now reads
  "Caribbean", which carries the meaning honestly. A single country on a
  multi-origin blend would not.

## Standing caveat, recorded deliberately

The workbook's own note applies and should stay on the record: **ABV can move by
vintage and by whisky batch.** Two cases are worth naming.

**Aberlour A'bunadh** is bottled at cask strength and every batch differs. 61.2%
is a real batch figure, but it is not necessarily the batch on the shelf.

**The vintage wines** — the Barolos, Brunellos, Bordeaux, Burgundies and
Australian fine reds — carry a current-release figure that will drift as vintages
turn over.

This matters more than an ordinary spec field because standard drinks is a
regulated declaration. The figures are internally consistent and match the
sources checked, but they are not label reads. When stock is handled, the label
is the authority.

## What is still outstanding

- **282 products have no barcode**, 148 of them live. A fabricated GTIN fails its
  own check digit and matches someone else's product in Merchant Center, so these
  need scanning. This is now the largest remaining data gap and the one with the
  clearest commercial cost.
- **38 live products have no cost**, so margin on them is unknown.
- **180 drafts have no `why_we_stock_it`** — editorial copy, not spec, and only
  needed when each is published.
