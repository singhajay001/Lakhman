# Spirithaus — building the wine range from ALM, not from a wishlist

**Date:** 2026-09-26. Spirithaus only.
**Source:** `ProductExport_71349307` dated 26-09-26 — 6,477 rows, wine only.
This is the complete ALM wine range. The file used until now was a 159-row
fine-wine subset, which is why so much read as "not available".

## The original question: delete the drafts not at ALM?

**I would not delete on the evidence available, and the matching is why.**

Matching 248 draft wines back to ALM produced confident-looking nonsense:

| Our draft | Matched to | Reality |
|---|---|---|
| Penfolds **Bin 707** | PENFOLDS BIN **389** | different wine, ~$700 vs ~$130 |
| Penfolds Bin 707 (first pass) | PENFOLDS **K/HILL** CAB SAV | Koonunga Hill, ~$20 |
| **Wendouree** Cabernet | **GOSSIPS** CAB SAUVIGNON | different producer entirely |
| **Bass Phillip** Reserve Pinot | **ZONZO ESTATE** RESERVE PINOT | different producer |
| Vasse Felix **Tom Cullity** | VASSE FELIX **FILIUS S/BLC** | different wine, wrong colour |
| **Turkey Flat Grenache** | TURKEY FLAT **ROSE** | different wine |

Varietal words — cabernet, shiraz, pinot noir, reserve, estate — appear in
hundreds of rows, so token overlap pairs almost anything with something.
Requiring the brand to match removed the worst of it but still passed
Bin 707 → Bin 389, because the brand *is* stocked and only the wine differs.

A deletion run driven by this would remove wines ALM carries and keep wines it
does not. Deletion is irreversible; the matching is not reliable enough to
justify it.

**If the wishlist drafts should go, archive rather than delete.** Shopify's
ARCHIVED status removes them from the working catalogue and is reversible in
one click. Almost nothing is lost either way — the 95 with no ALM match have
no cost, no image, no SEO fields and a $0.00 price, so the invested work is a
title and a handle.

## The better approach, and the finding that makes it work

Working forward from ALM means every product is available, costed and
sourceable by construction. And the export splits cleanly:

| | Lines | Barcodes on file |
|---|---:|---:|
| **ALM Warehouse** | 2,258 | **2,258 — all of them** |
| ALM Connect | 4,219 | **0 — none** |

That is not a coincidence in the data, it is the distinction that matters.
Warehouse lines are ALM's own stock: quicker, more reliable, and the only ones
we hold a GTIN for. A barcode is what makes a product eligible for Google
Shopping, valid in the product schema, and scannable at goods-in.

**Build the range from ALM Warehouse.** Everything else needs a barcode chased
before it can be listed properly.

## What was produced

**`worksheets/alm-core-wine-range-2026-09-26.csv` — 131 products.**
A range you can say yes to, not a catalogue to wade through.

Filters applied: ALM Warehouse only · not already stocked (matched on barcode)
· no casks, kegs, magnums, minis, multipacks or mixed packs · unit cost ≥ $6 ·
recognised brand · capped at 4 SKUs per brand so no one house dominates.

| Category | Count |
|---|---:|
| Still red | 45 |
| Still white | 40 |
| Sparkling white | 18 |
| Still rosé | 11 |
| Champagne | 10 |
| Sparkling rosé | 4 |
| Moscato | 2 |
| Port | 1 |

Unit cost $8.84–$123.11, median $16.87. One carton of each would be about
**$19,768 ex GST across 822 cartons** — that is the full-commitment figure, not
a recommendation; most lines would start as single cartons or special order.

Every row carries: brand, ALM description, supplier, item code, **barcode**,
carton size, unit cost ex GST, retail at 25% GP ex GST, and whether it is
currently on promotion.

**`worksheets/alm-wine-range-candidates-2026-09-26.csv` — 1,351 products.**
The full recognised-brand warehouse range behind the shortlist, same columns,
for when you want to go deeper in a category.

## Two honest caveats

**"Best selling" is not in this file.** Cartons, Units, QDA and BNS are all
empty, so there is no sales signal at all. The ranking is brand recognition —
my judgement — plus whether ALM has the line on promotion, which tends to track
volume brands. Treat it as a well-informed starting range, not a sales rank.
Your own POS history would beat it, but that sits on the Trafalgar side.

**Two of these were already identified as gaps.** Penfolds Bin 389 and Bin 128
both appear in the core list, and both were flagged earlier this session as
missing from the range. That is a good sign the shortlist is pointing at the
right things.
