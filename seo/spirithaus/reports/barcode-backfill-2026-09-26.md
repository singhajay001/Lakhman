# Spirithaus — barcode backfill

**Date:** 2026-09-26. Spirithaus only.

## Result

**10 barcodes written. 409 variants had none; 399 still do.**

That is a deliberately low yield, and the reason matters more than the number.

## The rule applied

A wrong barcode is worse than no barcode: it misidentifies the product in the
Shopping feed, puts a false GTIN in the product schema, and scans as the wrong
item at goods-in. So a barcode was written only where **three independent
things agreed**:

1. **Exact unit cost match** against an ALM row, to the cent.
2. **Brand match** — the distinctive words of our title present in the ALM
   description, with varietal words excluded, since "cabernet" and "reserve"
   match hundreds of rows.
3. **Valid GS1 check digit**, computed rather than assumed.

Then a fourth, applied by eye: the **GS1 country prefix had to fit the
product's origin**. All ten do — 93 Australia for the Penfolds and Four
Pillars lines, 3 France for Ruinart, Moët and Pol Roger, 750 Mexico for the
1800 tequila.

## Written

| Product | Barcode | Prefix |
|---|---|---|
| Penfolds Grange | 9310297026517 | Australia |
| Penfolds St Henri Shiraz | 9310297057610 | Australia |
| Penfolds Grandfather Rare Tawny | 9310297000005 | Australia |
| Penfolds Bin 28 Shiraz | 9310297065301 | Australia |
| Four Pillars Navy Strength Gin | 9349749000201 | Australia |
| Ruinart Blanc de Blanc SS | 3185370712009 | France |
| Moët & Chandon Vintage | 3185370769270 | France |
| Pol Roger Brut Non Vintage | 3260923012000 | France |
| 1800 Cristalino Tequila | 7501048814008 | Mexico |
| Patrón XO Cafe Coffee Liqueur | 0721733000036 | US |

## Held back deliberately

**Lark Classic Cask** matched on cost and name, and its APN
`04618379` passes the GS1 check digit — but it is a **GTIN-8**, the format
reserved for very small packages. On a 500 mL whisky bottle that is
implausible enough to be a data artifact rather than the real barcode. Not
written; it is in the review file.

## Why only 10 of 409 — and what actually fixes it

| Reason | Count |
|---|---:|
| **No cost recorded, so nothing to anchor the match to** | **131** |
| Matched an ALM row but no APN on file for that item code | 104 |
| Cost matched but the brand did not | 71 |
| Several ALM rows share the same cost *and* brand | 23 |
| Cost not present in any ALM row | 69 |

Review worksheet: `worksheets/barcode-review-2026-09-26.csv` — 199 rows with
up to three ALM candidates each and a column to fill.

### The real problem is structural

**Barcode backfill is gated on cost.** 131 variants cannot be matched at all
because they have no cost, and cost is the only reliable anchor available.
That is the same 39-live-plus-drafts costing job already on the list — so the
cost worksheet is the prerequisite for the barcode worksheet, not a parallel
task.

**And nothing in Shopify records which ALM product a product *is*.** Every
join in this session has been reconstructed from cost and name, which is why
fuzzy matching has failed repeatedly today — Bin 707 to Bin 389, Jack Daniel's
to Johnnie Walker, Turkey Flat Grenache to Turkey Flat Rosé.

**Recommendation: store the ALM item code on every product.** A
`custom.alm_item_code` metafield, filled when a product is ranged, makes every
future join exact and instant — barcodes, costs, availability, promotions, the
top-seller comparison. It is a few minutes of setup and it permanently retires
a class of error that has cost real time today.

Two faster routes for the bulk, both outside this session:

- **Ask ALM for an export with a barcode column.** The current product export
  has none; the APNs used here came from a separate extract and cover only
  2,258 of the codes. One better export would resolve most of the 104.
- **Scan the bottles.** For anything physically in the building, a phone
  scanner is faster and more certain than any match.
