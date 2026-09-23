# Spirithaus — catalogue coverage, 23 September 2026

Measured directly against the live store through the Shopify Admin API, not
from an export. Every published product was read; nothing is sampled or
estimated.

## The counts do not say what we thought

| | |
|---|---|
| Products in the store | **351** |
| Active | 217 |
| Draft | **134** |
| **Published to a sales channel** | **205** |
| Unpublished | **146** |

The working number is **205**, not 280. Two separate gaps produce that:

- **134 drafts.** Invisible to everyone. Whether that is deliberate staging or
  an unfinished import is worth knowing — it is 38% of the catalogue.
- **12 products are active but unpublished.** Active in the admin, no
  storefront URL. These are the dangerous ones: they look finished in the
  product list and cannot be crawled, bought or linked to. Nothing in the
  admin flags them.

## 🔴 Barcodes: the markup fires on two products

| | count | share of 217 active |
|---|---|---|
| Valid barcode on every variant | **2** | 0.9% |
| Present but malformed | 0 | — |
| **No barcode at all** | **215** | **99.1%** |

The product JSON-LD emits `gtin8/12/13/14` typed by barcode length. With no
barcode there is no GTIN, so the strongest product-matching signal Google has
is absent from 215 of 217 products.

Nothing is broken. The markup is correct and is doing exactly what it should
with the data present — which is why this needed measuring rather than
inspecting. Correct markup over empty fields looks identical to correct markup
over full ones.

Not malformed is worth noting too: no barcode is currently being silently
dropped for being the wrong length. The problem is absence, not corruption.

**Retrofitting is far more expensive than importing.** Every SKU added from
here should carry its barcode at import.

## 🔴 A third of published products have no description

| | count | share of 205 |
|---|---|---|
| **Empty description** | **66** | **32.2%** |
| Under 40 words | 24 | 11.7% |
| Word count | min 13 · median 58 · max 316 | |

Sixty-six product pages give Google and an AI assistant nothing to read
beyond a title and a price. They cannot rank for anything but the exact
product name, and they cannot be cited at all — an assistant answering "what
does this taste like" has no text to answer from.

This is the largest content gap on the store and it is invisible in the admin,
where an empty description looks the same as a full one until you open it.

## ✅ Duplicate descriptions are not a problem

This was the risk worth checking at scale — supplier boilerplate pasted across
a catalogue is the standard way a large store reads as thin. It is not
happening here.

Only **6 products in 3 groups** share text, and all three are the same product
in two sizes:

- `maybe-sammy-old-fashioned` / `-500ml`
- `absolut-vodka` / `absolut-vodka-lime`
- `jim-beam-white-label` / `-kentucky-straight-bourbon-1-ltr`

Worth differentiating eventually, but this is housekeeping, not a content
problem.

## ✅ The other schema inputs are clean

| | |
|---|---|
| Missing vendor (`brand` in the schema) | **0** |
| Missing featured image | **0** |
| Missing product type | 1 |
| No SKU on any variant | 4 |
| Distinct vendors | 119 |
| Product types | Wine 58 · Whisky 38 · Gin 29 · RTD 26 · Tequila 17 · Rum 16 |

119 vendors across 205 products is a genuinely broad independent range, and
`brand` being populated on every one is what makes the product schema work at
all.

## Order of work

1. **Publish the 12 active-but-unpublished products**, or archive them on
   purpose. Free, and they are finished work that is currently invisible.
2. **Write the 66 missing descriptions.** Largest lever available. Start with
   the highest-margin or best-selling lines rather than alphabetically.
3. **Barcodes at import, from now on, without exception.** Backfill the
   existing 215 when convenient; never add a new SKU without one.
4. **Decide about the 134 drafts.** Either finish and publish them or accept
   they are not part of the store.

## Not measured here

Metafield coverage — `abv`, `volume_ml`, `standard_drinks`, `style`, `region`,
`country`, `producer`. These feed the spec table and `additionalProperty`, and
`standard_drinks` in particular is what an AI assistant answers with. They need
a separate metafield query; the counts above say nothing about them.
