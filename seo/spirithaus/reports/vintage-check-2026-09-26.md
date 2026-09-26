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

---

# Part 2 — current-release research for the 22

Owner's decision: keep them live, research the likely current release for each.
Done. Worksheet: `seo/spirithaus/worksheets/vintage-research-2026-09-26.csv`

**Read this as "the vintage a customer would expect to receive if you ordered
today", not as a statement about your stock.** For a retailer ordering on
demand that is usually the same thing, but it is an inference, not a fact.

| Confidence | Count |
|---|---:|
| HIGH — a dated release announcement or the producer's own current-release page | 6 |
| MEDIUM — cited as current by a reputable source, no release date found | 9 |
| LOW — conflicting or thin evidence | 4 |
| NONE — could not establish | 3 |

## HIGH confidence — 6

| Product | Vintage | Basis |
|---|---|---|
| Henschke Hill of Grace | **2022** | 2022 Single Vineyard Collection released globally 6 May 2026 |
| Krug Vintage | **2013** | Krug's own July 2026 release list |
| Taittinger Comtes de Champagne | **2008** | Described Jan 2026 as just out of the cellar |
| Cullen Diana Madeline | **2024** | Released May–June 2026 at Cullen's Icon Release dinners |
| Clonakilla Shiraz Viognier | **2024** | Clonakilla's own 2024 release page |
| Tapanappa Whalebone | **2021** | Current release per the producer |

Hill of Grace at **2022** also sanity-checks against your $949.99 — that is
about right for the current release, which is a good sign the price was set
against the right wine.

## MEDIUM — 9

Dom Pérignon Rosé 2009 · Jim Barry The Armagh 2023 · Howard Park Abercrombie
2023 · Irvine Grand Merlot 2016 · Duckhorn Napa Valley Merlot 2023 · Petaluma
Coonawarra 2021 · Yalumba The Menzies 2022 · Chandon Vintage Brut 2019 ·
Jansz Vintage Cuvée 2021

## LOW — 4. Do not publish these years without checking.

- **Louis Roederer Cristal** — 2016 was cited as latest in 2025, but a 2008
  late release also launched in June 2026. Genuinely conflicting.
- **Veuve Clicquot La Grande Dame** — the house lists 2018, 2015, 2012 and 2008
  together without marking which is current.
- **Torbreck RunRig** — the only dated evidence is a 2016–2021 vertical pack.
- **Best's Thomson Family** — made roughly six times a decade, so vintages skip
  and "most recent found" is unreliable.

## NONE — 3

**Yalumba The Octavius** and **d'Arenberg The Dead Arm** — searches were
inconclusive.

**Woodlands Cabernet Merlot** — a different problem. Woodlands make several
cabernet merlots at different tiers (Wilyabrup Valley, the Margaret Reserve
Cabernet Merlot Malbec). At $41.99 ours is presumably the entry Wilyabrup, but
**the product itself is ambiguous, not just the vintage.** Worth confirming
which wine this listing actually is before worrying about the year.

## Two things worth acting on beyond vintages

**Irvine Grand Merlot may be under-priced.** The 2016 is listed overseas around
$199. Ours is $119.99 with no cost recorded, so the margin is unknown and
possibly negative. Check this one against your invoice before anything else.

**Tapanappa Whalebone is not what the title says.** The current release is
53.5% cabernet sauvignon, 16% merlot, 16% cabernet franc and 14.5% shiraz — a
four-variety blend. Our title calls it "Merlot Cabernet Franc", which describes
an older bottling.

## Recommendation

Apply the 6 HIGH-confidence vintages to titles and SEO once you give the nod —
that turns `Henschke Hill of Grace` into `Henschke Hill of Grace 2022`, which
is both accurate and the query people actually search.

Leave the 9 MEDIUM until you have checked a bottle or an invoice. Do not touch
the 4 LOW or the 3 NONE.
