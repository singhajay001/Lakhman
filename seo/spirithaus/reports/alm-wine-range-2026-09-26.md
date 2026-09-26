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

---

# Part 2 — real sales data arrives

**Owner supplied** `Top_Sellers_AU.pdf` — ALM Portal Top 25 Sellers by Segment,
**national, data to 26 July 2026**. 12 pages, parsed to **791 ranked rows**
carrying item code, description, rank this year, rank last year and segment
share.

This replaces the brand-recognition ranking in Part 1 with measured data. It is
a strict upgrade: my list could only surface brands I already thought of.

| Category | Ranked rows |
|---|---:|
| WINE | 277 |
| SPIRITS | 267 |
| BEER | 122 |
| RTDS | 50 |
| CIDER | 50 |
| Non-alcoholic | 25 |

## Three worksheets

| File | Rows |
|---|---:|
| `alm-topsellers-wine-2026-09-26.csv` | 277 |
| `alm-topsellers-spirits-2026-09-26.csv` | 267 |
| `alm-topsellers-rtd-nonalc-2026-09-26.csv` | 75 |

Each row carries rank this year and last, segment share, ALM item code,
**barcode**, supplier, stock type, carton size and unit cost ex GST. Sorted by
segment then rank, so the top of each segment is the top of the list.

## A finding that matters for sourcing

**Every one of the 228 wine top-sellers held at ALM is a Warehouse line.
Not one spirits, RTD, beer or cider top-seller is.**

Wine you can buy from ALM's own stock. The spirits top-sellers are ALM Connect
or outside the wine export entirely, which means supplier-direct ordering and
no barcode on file for a third of them. That is a real difference in how much
work each category takes to list, and it argues for leading the range build
with wine.

## What I could not determine, and why

**"Which top sellers are you missing" cannot be answered reliably yet.**

Only **52 of 791** can be confirmed as already stocked, by exact barcode match.
The obstacle is on our side: just **106 of 486 products carry a barcode**, so
most of the catalogue cannot be matched exactly at all.

Name matching was attempted and **discarded**. It produced:

| ALM line | Matched to | Reality |
|---|---|---|
| J/DANIEL BLACK LABEL | Johnnie Walker Black Label | different distillery |
| J/DANIEL GENTLEMAN JACK | Jack Daniel's Old No. 7 | different expression |
| WILD TURKEY 81 PROOF | Wild Turkey 101 | different expression |
| JOSE CUERVO MARGARITA MIX | Jose Cuervo Especial Silver | a mixer, not a tequila |
| MCGUIGAN ZERO SHIRAZ | McGuigan Sparkling Shiraz | zero-alcohol vs alcoholic |

It claimed 194 stocked against a true confirmed 52. Shared words like BLACK,
LABEL and the brand name are not enough to identify a bottle. This is the
third time fuzzy matching has failed on this catalogue; the pattern is now
clear enough to treat as a rule rather than a surprise.

**So the worksheets flag only barcode-confirmed matches, and leave the rest
blank rather than guessing.** A blank means unknown, not missing.

**The fix is barcodes.** 380 products lack one. Filling them — from the ALM
APN file where the item code is known — would make every future comparison
exact instead of speculative. That is now the highest-value data job on the
store, ahead of the range build it unblocks.

## Still worth having: the NSW list

This file is national. Spirithaus delivers Sydney metro only, so NSW
sell-through is the better signal, and where the two disagree NSW should win.

---

# Part 3 — the add list, built for image sourcing

`worksheets/to-add-shortlist-2026-09-26.csv` — **240 products**, ranked by ALM
national sales, excluding anything confirmed already stocked.

| | Products | Segments |
|---|---:|---|
| Wine | 108 | 9 |
| Spirits | 120 | 10 |
| RTDs | 12 | 1 |

**209 of the 240 already have a barcode**, which means most can be created with
a valid GTIN from day one — no repeat of the backfill problem.

Excluded: casks, kegs, miniatures, PET and 1.5 L+ formats — top sellers
nationally, but wrong for a premium online retailer delivering Sydney metro.
Capped at 12 per segment so one category cannot swamp the list.

Each row carries a **readable product name** and a matching **image filename**
in the store's existing convention, so downloaded images drop straight in. ALM
descriptions are abbreviated past usefulness for image searching —
`W/BLASS GRY LBL CAB SHZ 750ML` is expanded to
`Wolf Blass Grey Label Cabernet Shiraz 750mL`.

`worksheets/to-add-topsellers-2026-09-26.csv` holds the unfiltered 542 behind
the shortlist.

## A filter bug worth recording

The first cut returned 38 wines instead of 108. The small-format filter
`(50|100|200|375)ML$` was matching **750ML** — the string "750ML" ends with
"50ML". It was silently removing almost every 750 mL wine, which is to say
almost the entire wine range.

Fixed with a negative lookbehind, `(?<!\d)(50|100|200)ML$`, and the filter now
carries assertions so it cannot regress:

```
assert not bad_format('BROWN BRO MOSCATO 750ML')     # must survive
assert bad_format('JIM BEAM WHITE LBL 37%MINS50ML')  # must not
```

It only surfaced because the wine count looked wrong against the spirits
count. A filter that silently drops the right answer is worse than one that
errors.
