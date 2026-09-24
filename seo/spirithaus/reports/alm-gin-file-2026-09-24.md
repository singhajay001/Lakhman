# ALM file, 24 September 2026 — what it can and cannot do

`ProductExport_71349307-user_05-09-26` — supplied to backfill the 215 missing
barcodes.

## It cannot do that. There are no barcodes in it.

| | |
|---|---|
| Rows | 913 |
| Columns | Warehouse, Supplier Name, Category, **Item code**, Description, Carton Size, Carton Cost, Allowance, Cartons, Units, Promo Start, Promo Ends, Parcel Buy, QDA, BNS |
| Barcode / EAN / GTIN column | **none** |
| Categories | **one** — `SPIRITS / GIN ALL / GIN` |

It is a trade price and promotions file, not a product-data file, and it covers
the gin range only. A full backfill needs one export per category *and* a
column ALM did not include here.

**What to ask ALM for:** the EAN or GTIN column on the product export, across
all categories. They hold it — it is how the warehouse scans stock. It is a
different report from this one.

## 🔴 `Item code` is not a barcode, and it is dangerous precisely because it looks like one

| | |
|---|---|
| Item codes that are 8 digits | **650** of 913 |
| ...that would pass an EAN-8 check digit **by chance** | **58 (9%)** |

An ALM item code like `31342922` is 8 digits, all numeric, and would be typed
by the product schema as `gtin8` without complaint. Map this column to the
barcode field and 592 rows get caught — and **58 go live as a confident,
well-formed, entirely wrong GTIN**, claiming your gin page is some other
product.

The check digit catches most of it and cannot catch all of it. Roughly one in
ten arbitrary 8-digit numbers passes by luck. So the defence is not validation,
it is never making the mapping.

`tools/check-barcodes.py` now handles both ends:

- given this file, it refuses outright and names the trap: *"`Item code` is a
  SUPPLIER code, not a barcode… Do not map one to the other."*
- given the same column relabelled `Barcode`, it rejects 116 of the first 120
  rows on the check digit and raises a warning on the rest: *"EAN-8 is rare in
  retail and supplier item codes are commonly 8 digits."*

Verified by doing exactly that to the file.

## What the file IS good for: margin

The gin range costed against ALM. Thirteen lines matched confidently on brand
**and** bottle size — a fuzzy match was tried first and discarded, because it
paired Gordon's with an Echuca gin and Bombay Sapphire with a carton of 50mL
miniatures.

| Gin | Sell | ALM unit | Margin | Allowance / promo end |
|---|---|---|---|---|
| **Monkey 47 Dry Gin 500mL** | $84.99 | $81.70 | **3.9%** | — |
| **Hendrick's Gin** | $72.00 | $64.11 | **11.0%** | $68.72, ended 27 Sep |
| **Tanqueray London Dry** | $59.99 | $52.81 | **12.0%** | $78.44, ended 15 Sep |
| The Botanist Islay Dry | $89.99 | $75.83 | 15.7% | $14.00 |
| Poor Toms Sydney Dry | $74.99 | $62.33 | 16.9% | — |
| Bombay Sapphire | $65.00 | $53.48 | 17.7% | $64.30, ended 27 Sep |
| Gin Mare | $86.99 | $70.17 | 19.3% | — |
| Four Pillars Bloody Shiraz | $84.99 | $68.29 | 19.6% | $85.00, ended 13 Sep |
| Karu Lightning | $98.00 | $78.10 | 20.3% | — |
| Four Pillars Rare Dry | $79.95 | $62.61 | 21.7% | $140.00, ends 11 Oct |
| Brookie's Byron Dry | $82.00 | $60.27 | 26.5% | $18.00, ends 3 Nov |
| Roku Gin 43% | $77.00 | $54.85 | 28.8% | $40.51, ended 13 Sep |
| Tanqueray No. TEN | $89.99 | $62.82 | 30.2% | $186.68, ends 3 Nov |

**Eight of thirteen sit under 20% gross margin. Monkey 47 is at 3.9%** — after
card fees and delivery that line is being sold at a loss.

Caveats, because this is someone's pricing and it should not be acted on
loosely:

- ALM's carton cost is GST-inclusive. So are the retail prices, so the margin
  *percentages* hold either way — the GST cancels — but the dollar figures are
  gross, not net.
- These are ALM's terms. Another supplier, or a deal, may beat them.
- **The file is dated 5 September and several promos have already ended**
  (13, 15 and 27 September). The live ones are Four Pillars Rare to 11 October,
  and Tanqueray No. TEN and Brookie's Byron to 3 November.

## 🔴 None of this is visible in Shopify today

**Zero of the 29 active gins have a unit cost recorded.** `inventoryItem.unitCost`
is null on every one.

That is why a 3.9% line can sit on the site unnoticed: Shopify cannot show
margin, flag a loss-maker or report profit on an order, because it has not been
told what anything costs. The two products that *do* carry a cost — Tequila Blu
and Devil's Storm — have it only because the owner supplied the figures by hand
on 23 September.

This is the higher-value thing in the file. Barcodes improve how a product is
matched by search engines. Cost prices tell you which products are worth
selling at all, and one carton-cost column loaded against the catalogue would
answer that across the range.
