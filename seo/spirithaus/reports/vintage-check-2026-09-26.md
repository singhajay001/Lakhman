# Spirithaus — can ALM tell us the vintages?

**Date:** 2026-09-26. Spirithaus only.
**Question asked:** which vintage is the Henschke Hill of Grace we have live at $949.99?

## Short answer

**ALM cannot tell us.** Hill of Grace does not appear anywhere in either ALM
file — not the 6,922-row core extract, not the 159-row fine-wine export.

More broadly, ALM is a poor vintage source: only **39 of 7,081 rows** carry an
explicit four-digit year.

## What ALM could supply — 4 of 30

| Product | Vintage | ALM source row |
|---|---|---|
| Penfolds Grange | **2017** | `PENFOLDS GRANGE SHZ 17GB 750ML` |
| Bollinger La Grande Année | **2015** | `BOLLINGER LA GRANDE ANNEE 2015 750ML` |
| Moët & Chandon Dom Pérignon | **2015** | `DOM PERIGNON 2015 GB EOY LIMITED EDITION 750ML` |
| Krug Grande Cuvée | **NV** | `KRUG GRANDE CUVEE NV GIFT750ML` |

Grange's year is encoded as `SHZ 17`, not a four-digit year — the two-digit
form after the variety code. That pattern is why a naive year search misses it.

### ⚠️ Two flags on those four

**Dom Pérignon was costed from a gift box, not a plain bottle.** The source row
is `DOM PERIGNON 2015 GB EOY LIMITED EDITION` — an end-of-year limited-edition
gift pack. Our product is listed as the plain bottle at $590.99. Either the
product should say it is the gift edition, or the cost is for the wrong SKU.

**These are ALM's listings, not your stock.** ALM saying it lists the 2017
Grange tells you what was orderable when the extract was taken. It does not
confirm which vintage you would actually receive, and vintages roll. Treat them
as strong candidates to verify, not as confirmed facts.

## What ALM cannot supply — 22 live products

All live, all vintage-dependent, all currently sold with no year stated:

Krug Vintage ($982.99) · Dom Pérignon Rosé ($971.99) · **Henschke Hill of Grace
($949.99)** · Louis Roederer Cristal ($529.99) · Veuve Clicquot La Grande Dame
($456.99) · Taittinger Comtes de Champagne ($450) · Jim Barry The Armagh
($419.29) · Torbreck RunRig ($330) · Best's Thomson Family Shiraz ($249.99) ·
Yalumba The Octavius · Cullen Diana Madeline · Clonakilla Shiraz Viognier ·
Howard Park Abercrombie · Irvine Grand Merlot · Duckhorn Napa Valley Merlot ·
Tapanappa Whalebone · Petaluma Coonawarra · d'Arenberg The Dead Arm · Yalumba
The Menzies · Chandon Vintage Brut · Jansz Tasmania Vintage Cuvée · Woodlands
Cabernet Merlot

Three of those (Krug Vintage, La Grande Dame, Dom Pérignon Rosé) **are** in ALM,
but the description carries no year — `KRUG VINTAGE GB 750ML`. A wine whose
name is literally "Vintage" and whose year is unrecorded is the clearest case
for confirming from the bottle or the invoice.

## No vintage needed — 6

Solera-aged or non-vintage by definition, so nothing to confirm:
Penfolds Grandfather (20YO), Penfolds Great Grandfather (30YO), Morris Old
Premium Rare Muscat, Yalumba Antique Tawny, Krug Grande Cuvée, Tequila Blu.

## Method note

The first pass joined products to ALM rows on cost alone, which produced
nonsense — "Casali del Barone Barolo 2020" matched `HAVANA CLUB ANOS 7YO`
because the costs happened to be equal. Cost is not a unique key. Adding a
name-match guard rejected 68 spurious matches and left 45 verified ones, of
which 11 added a vintage not already in the product title.

## Worksheet

`seo/spirithaus/worksheets/vintage-confirm-2026-09-26.csv` — all 30 live
`to-confirm` products, with the ALM vintage pre-filled where it exists, the ALM
source row for checking, and blank columns for the actual vintage and any
missing cost.
