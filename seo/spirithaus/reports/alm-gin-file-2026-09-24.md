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

---

# Done: costs loaded, gin range repriced to a 20% floor

Owner's instruction: load the costs, hold a minimum margin, reprice everything
that needs it and change nothing else. Floor set at **20%**.

## Costs loaded — 20 of 29 active gins

`inventoryItem.unitCost` was null on all 29. Twenty now carry ALM's carton cost
divided by carton size. Verified by reading every gin back after the write.

**The cost figure is ALM's `Carton Cost (Incl Taxes & Allowance)`, as stated —
GST-inclusive, and not converted.** Transforming a supplier's financial figure
on an assumption is not this tool's job. It matters in one direction only: both
the cost and the retail price include GST, so the margin *percentages* below
are correct either way, but Shopify's profit reports compare cost against
ex-tax revenue and will therefore read low. Worth settling with the accountant
before trusting the dashboard — especially given GST registration is already an
open question on this store.

Nine gins have no cost, because ALM's file could not be matched to them with
confidence: Applewood (absent from the file), Archie Rose Distiller's Strength
(only an ambiguous "STRAIGHT D/GIN" line), Edinburgh Classic (only Lemon &
Jasmine and Cannonball), Four Pillars Navy Strength (absent), Hendrick's
Neptunia, Ink Gin (50mL only), Karu Pourtrait (10L only), and both Never Nevers
(the store's SKUs say 500mL, ALM lists 700mL). A guess on any of these would
have produced a wrong margin, which is worse than a blank one.

## Repriced — 12 of 20

| Gin | Was | Now | Cost | Margin was | Margin now |
|---|---|---|---|---|---|
| Manly Spirits Australian Dry | $65.00 | **$79.99** | $63.70 | 2.0% | 20.4% |
| Monkey 47 Dry 500mL | $84.99 | **$102.99** | $81.70 | 3.9% | 20.7% |
| Archie Rose Signature Dry | $66.00 | **$77.99** | $62.24 | 5.7% | 20.2% |
| Hendrick's Gin | $72.00 | **$80.99** | $64.11 | 11.0% | 20.8% |
| Tanqueray London Dry | $59.99 | **$66.99** | $52.81 | 12.0% | 21.2% |
| Gordon's London Dry | $55.00 | **$59.99** | $47.61 | 13.4% | 20.6% |
| Four Pillars Olive Leaf | $84.99 | **$89.99** | $71.96 | 15.3% | 20.0% |
| The Botanist Islay Dry | $89.99 | **$94.99** | $75.83 | 15.7% | 20.2% |
| Poor Toms Sydney Dry | $74.99 | **$77.99** | $62.33 | 16.9% | 20.1% |
| Bombay Sapphire | $65.00 | **$66.99** | $53.48 | 17.7% | 20.2% |
| Gin Mare | $86.99 | **$87.99** | $70.18 | 19.3% | 20.2% |
| Four Pillars Bloody Shiraz | $84.99 | **$85.99** | $68.29 | 19.6% | 20.6% |

Prices round **up** to the next `.99`, so no line lands a fraction under the
floor through rounding. Every one was read back and checked against 20%.

Eight already cleared it and were left alone: Four Pillars Rare Dry (21.7%),
Karu Affinity (20.9%), Karu Lightning (20.3%), Brookie's Byron Slow (23.5%),
Brookie's Byron Dry (26.5%), Melbourne Gin Co (28.1%), Roku (28.8%), Tanqueray
No. TEN (30.2%).

## `compareAtPrice` deliberately left null

Setting the old price as a strikethrough would show "was $65, now $79.99" on a
price that went **up**. That is an inflated RRP, which this store's own alcohol
advertising rules prohibit outright, and it would be a false saving claim under
Australian consumer law. Prices changed; nothing is presented as a discount.

## What the owner should know

Three of the twelve moved a long way — Manly Spirits +31%, Monkey 47 +28%,
Archie Rose Signature +26%. They were at 2%, 3.9% and 5.7%, so the floor could
not be reached gently. Those three were not mispriced so much as badly bought:
at $63.70 landed on a $65 bottle, the buy price is the problem and no retail
price fixes it. Instructions were to reprice and flag nothing, so they are
repriced — but the buying decision is still there to be made.

Lastly: the ALM file is dated 5 September and several allowances in it have
already expired, so these costs are what ALM charged three weeks ago, not
necessarily today.
