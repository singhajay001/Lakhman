# Spirithaus — pricing the 160 drafts, 24 September 2026

## Correction first

Earlier today I wrote that the drafts "are an unpriced import" and "cannot be
published because they have no prices." That was drawn from a sample the
`VARIANT_PRICE < 50` rule happened to surface, and it is **wrong for a quarter
of them.**

All 160 were read individually. They are three distinct groups, not one:

| | count | can it go live? |
|---|---|---|
| **No price and no cost** | **114** | No |
| **Priced, but no cost** | **23** | Yes — margin is invisible |
| **Priced and costed** | **23** | **Yes, today** |

## 🟢 23 are finished and sitting invisible

Nineteen of them are the everyday wine block, and every one already clears the
20% floor set this morning:

| | Price | Cost | Margin |
|---|---|---|---|
| Rawson's Retreat Shiraz Cabernet | $8.99 | $6.17 | 31.4% |
| Stoneleigh Marlborough Sauvignon Blanc | $12.99 | $9.05 | 30.3% |
| Elephant in the Room Pinot Noir | $12.99 | $9.05 | 30.3% |
| 821 South Marlborough Sauvignon Blanc | $15.99 | $11.28 | 29.5% |
| De Bortoli Rose Rose | $13.99 | $9.91 | 29.2% |
| Squealing Pig Marlborough Sauvignon Blanc | $16.99 | $12.04 | 29.1% |
| Mud House Marlborough Sauvignon Blanc | $14.99 | $10.68 | 28.8% |
| Wynns The Siding Cabernet Sauvignon | $14.99 | $10.73 | 28.4% |
| Da Luca Prosecco | $19.99 | $14.35 | 28.2% |
| Taylors Estate Shiraz / Cabernet / Chardonnay | $19.99 | $14.38 | 28.1% |
| La Vieille Ferme Rose | $18.99 | $13.69 | 27.9% |
| Wyndham Estate BIN 555 / BIN 888 | $13.99 | $10.30 | 26.4% |
| Tatachilla White Admiral Pinot Grigio / Rose | $8.99 | $6.68 | 25.7% |
| Upside Down Sauvignon Blanc / Rose | $9.99 | $7.45 | 25.4% |

Plus Penfolds Grandfather Rare Tawny ($99.99 / $70.00, 30%), Tequila Blu
(34%), Morris of Rutherglen (see below) and Lark Devil's Storm (10%, the
owner's own figures).

**These have been draft since 12 September.** Nothing is missing from them —
price, cost, margin, images and descriptions are all in place. They are better
margined than most of the *active* gin range, which sits at 20–30% after this
morning's repricing. Whether that is a deliberate hold or an unfinished publish
is the owner's to say, but it is revenue not being offered.

### ✅ One repriced to the floor

**Morris of Rutherglen Old Premium Rare Muscat** was $119.99 on a $98.00 cost —
**18.3%**, below the 20% floor. Moved to **$122.99** (20.3%). It is a draft, so
nothing customer-facing changed.

Lark Devil's Storm stays at 10%. That margin came from the owner's own figures
and was already flagged; it is a decision, not an error.

## 🔴 114 have no price at all — and they are all fine wine

Not a random backlog. It is a single fine-wine import, and it is coherent:

| Group | Count |
|---|---|
| Cabernet & Bordeaux blends | 13 |
| Pinot Noir | 10 |
| Grenache & Rhône | 10 |
| Chardonnay | 10 |
| Sauvignon Blanc | 10 |
| Riesling | 10 |
| Pinot Gris / Grigio | 10 |
| Rosé | 10 |
| Prosecco | 10 |
| Australian sparkling | 8 |
| Champagne | 7 |
| Fortified | 6 |

Ten per style, almost exactly — someone built a fine wine range by category and
never got to the prices. It includes Penfolds Grange, Yattarna and Bin 707,
Henschke, Moss Wood, Mount Mary, Bass Phillip, Giaconda, Leeuwin Art Series,
Grosset Polish Hill, Cloudy Bay Te Koko, Krug, Dom Pérignon, Pol Roger Sir
Winston Churchill and Château de Beaucastel.

**These cannot be priced from here, and should not be.** Fine wine is not
cost-plus: allocation, vintage and scarcity set the price, and a Grange vintage
can move hundreds of dollars between years. Guessing would produce numbers that
look authoritative and are wrong on a $900 bottle.

What they need is one of:

- a **fine wine distributor's price file** — the same treatment the ALM gin
  file got, and the fastest route
- the **owner's own RRP** per bottle, where the wine is already stocked
- **deletion**, if this range was aspirational rather than real. 114 products
  is a third of the catalogue; if the stock does not exist, they are better
  gone than sitting as drafts forever.

## The worksheet

`seo/spirithaus/worksheets/draft-pricing-2026-09-24.csv` — 137 rows, grouped by
style, with blank `Cost ex GST` and `Sell price` columns to fill.

**Fill it and hand it back rather than importing it.** A Handle-keyed Shopify
product CSV treats the rows it contains as the complete variant set, which has
already deleted 23 variants across 17 products on this store once. Writing the
values back through the API per variant avoids that entirely, and
`tools/check-barcodes.py --against` exists to catch the import shape if a CSV
route is ever used anyway.

## 🔴 The risk that needs a guard

Publishing any of the 114 while they sit at $0.00 puts a bottle on a public
storefront, orderable, for nothing. That has already happened once on this
store — a single malt went live at $0.00 for a few minutes on 23 September —
and the exposure then was one product. Here it is 114, including Grange.

Two things make this likely rather than theoretical: the products look complete
in the admin product list, and bulk status changes are one click. **Nothing in
Shopify blocks publishing a $0.00 product.**

The rule to hold: **price before publish, verified by reading the price back**
— never the two in one action. Same rule the 23 September incident earned.
