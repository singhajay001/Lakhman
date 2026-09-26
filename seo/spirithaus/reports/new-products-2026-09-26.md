# Spirithaus — 47 products created from the image queue
2026-09-26

Two completed rounds of the image queue came back with front images uploaded to
Shopify Files, Dan Murphy's product facts, and Dan Murphy's shelf price. This is
what was built from them, and the one finding that matters more than any of it.

## 1. The finding: ALM list cost does not support mainstream pricing

The Dan Murphy's column is the first real competitive benchmark this catalogue
has had. On the mainstream spirits and champagne it says our prices cannot work.

| | Our price | Dan Murphy's | Premium | GP at Dan Murphy's price |
|---|---|---|---|---|
| Bacardi Carta Blanca 1L | $106.99 | $69.00 | **+55%** | −15.2% |
| Moet & Chandon Imperial 750ml | $99.99 | $68.95 | +45% | −8.4% |
| Gordon's Gin 1L | $92.99 | $64.95 | +43% | −6.7% |
| Johnnie Walker Red 1L | $92.99 | $64.90 | +43% | −6.7% |
| Jameson 700ml | $77.99 | $54.90 | +42% | −5.5% |
| Jack Daniel's Old No. 7 1L | $108.99 | $76.90 | +42% | −6.1% |
| Veuve Clicquot Yellow Label | $118.99 | $89.99 | +32% | +1.4% |
| Grey Goose 700ml | $91.99 | $73.95 | +24% | — |
| Patron Silver 700ml | $105.99 | $85.99 | +23% | — |

Median premium across the 54 benchmarked lines: **+30%**. On **12 of 32** in the
first round, selling at Dan Murphy's price on ALM **list** cost is a *loss per
bottle*. On 24 of 32 it lands under a 20% GP.

This is not a pricing mistake — the prices are correct arithmetic on the cost we
have. It is a **cost** problem. We already know list cost is a ceiling, not the
real number: the Bacardi invoice came in at $33.41 against a $49.36 list. Until
the real invoice cost is in, mainstream spirits and champagne cannot be priced
to sell.

**What is needed:** actual landed cost for the mainstream lines, from invoices
rather than the ALM price list. Everything else about these products is done and
waiting.

## 2. What went live (19 products)

Published to the Online Store — price at or near Dan Murphy's, image attached,
original copy, SEO, barcode, cost:

**New products (11):** Pepperjack Barossa Shiraz, De Bortoli King Valley
Prosecco, Brown Brothers Moscato, Brown Brothers Prosecco, Andrew Garrett
Sparkling Shiraz, Divas VKAT, Bundaberg Underproof 700ml, St Agnes VS Brandy
150ml, Banrock Station Moscato 1L, Yellow Tail Bubbles Rose, Olmeca Altos Plata.

**Also new (3):** Hardys VR Shiraz 1L (**$10.99 vs Dan Murphy's $11.99 — we are
cheaper**), Wolf Blass Red Label Tawny, Sheep Dog Peanut Butter Whiskey.

**Existing drafts, image attached and published (5):** San Polo Brunello
Vignavecchia, Champagne Deutz Amour de Deutz, Brokenwood Graveyard Shiraz,
Poggio al Tesoro Dedicato a Walter, Kaesler Old Bastard Shiraz. Deutz and
Brokenwood are both *below* Dan Murphy's.

## 3. What is built but held as DRAFT (30 products)

Complete in every respect — image, two-paragraph original copy, SEO title and
description, barcode, ALM cost, spec metafields, tags — and one click from live.
Held only because the price is 23–66% above Dan Murphy's:

Bacardi 1L, Moet Imperial, Gordon's 1L, Bundaberg 1L, Captain Morgan Spiced Gold
(1L and 700ml), Smirnoff Red (1L and 700ml), Jim Beam White 1L, Jameson (700ml
and 1L), Aperol, Oyster Bay Sauvignon Blanc, Jack Daniel's 1L, Espolon Blanco,
Mumm Cordon Rouge, Chivas Regal 12, Veuve Clicquot, Kraken, Sailor Jerry,
Yellowglen Pink Sparkling Rose, Johnnie Walker Red 700ml, Campari, Squealing Pig,
Jacob's Creek Chardonnay Pinot, Yellowglen Red, Yellowglen Pink 65, Bombay
Sapphire (700ml and 1L), Grey Goose, Patron Silver.

Plus two existing fine-wine drafts held on price: **Perrier-Jouet Belle Epoque
Blanc de Blancs** ($662.99 vs $399.99, +66%) and **Joseph Drouhin
Gevrey-Chambertin** ($380.99 vs $245, +55%).

## 4. Data faults found and handled

- **Excel destroyed 27 of 32 barcodes**, rewriting them as scientific notation
  (`5.01068E+12`). None of those were written to Shopify. Every barcode was
  recovered from the ALM APN extract using the item code instead. **Format the
  barcode column as Text before editing this file again.**
- **5 products have no barcode at all** — Bombay Sapphire 700ml and 1L, Grey
  Goose, Patron Silver, Sheep Dog. These are ALM **Connect** lines, and no
  Connect line carries a barcode on file. They will need scanning in.
- **One image did not upload**: `brown-brothers-moscato-rose-750ml-01`. The
  product was created with everything else; it just needs the image.
- **Dan Murphy's "Country" is often the bottling country, not origin** — Captain
  Morgan reads Australia at 1L and Jamaica at 700ml; Olmeca Altos reads
  Australia; Kraken reads United States. Country was left blank on those rather
  than recorded wrongly.
- **Smirnoff ABV conflict**: Dan Murphy's says 37.5%, ALM's own description says
  37%. Used 37% — the supplier is the better source for the Australian product.
- **No Dan Murphy's copy was reused.** Their text supplied facts only — ABV,
  standard drinks, volume, country, region, style — which went into the spec
  metafields. Every description is original prose.

## 5. Outstanding

- `worksheets/to-add-remaining-2026-09-26.csv` — **160 products still to add**,
  all P3/P4 (77 spirits, 75 wine, 8 RTD). Every P1 and P2 to-add row is now done.
- `worksheets/drafts-awaiting-image-2026-09-26.csv` — **147 existing drafts**
  with copy and SEO already written, waiting only on an image to publish.
- Real invoice cost for the 30 held drafts (section 1).
- Barcodes for the 5 ALM Connect lines.
