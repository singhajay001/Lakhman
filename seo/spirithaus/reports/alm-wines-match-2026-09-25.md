# Spirithaus — ALM wine export matched against the 114 drafts

**2026-09-25.** Source: `ProductExport_71349307-user_25-09-26_09-56-09.csv`,
6,486 rows, all WINE category.

## Headline: ALM covers 17 of the 114, and the 20% floor does not survive contact

| Outcome | Count |
|---|---|
| Matched, cost usable | **12** |
| Matched then **rejected** on inspection | 1 |
| Competing candidates — needs your call | 4 |
| Not in the ALM wine book at all | **97** |

## What the file does and does not carry

Columns: Warehouse/Connect · Supplier · Category · Item code · Description ·
Carton Size · **Carton Cost (Incl Taxes & Allowance)** · Allowance · Promo dates.

**No Consumer GTIN and no unit-size column.** So barcode matching — the safe
route — was not available, and size had to be parsed out of the description
(successful on 6,465 of 6,486 rows). Name matching was the only option, which is
the route that has burned this project twice.

`Carton Cost (Incl Taxes & Allowance)` already contains WET and GST, so it is a
landed cost directly comparable to a shelf price. No tax adjustment needed.

## The matcher, and why the first pass was thrown away

First pass: 18 "single candidates". **Seven were wrong** — a 39% error rate on
the group that looked safest. The same proportion as the barcode matcher.

| Draft | Matched to | Reality |
|---|---|---|
| Crawford River Riesling | HENTLEY FARM **MT CRAWFORD** RIESLING | different producer |
| Domaine Vacheron Sancerre | **DOMAINE CHRISTIAN SALMON** SANCERRE | different producer |
| Alois Lageder **Porer** Pinot Grigio | ALOIS LAGEDER CANTINA **RIFF** | entry label, not the single vineyard |
| Billecart-Salmon **Brut Rosé** | BILLECART SALMON **SOUS BOIS** | different cuvée |
| Villa Sandi **Cartizze** | VILLA SANDI **IL FRESCO** PROSECCO | different wine |
| House of Arras **Grand Vintage** | HOUSE OF ARRAS **EJ CARR** | same row already claimed |
| Paringa Estate **The Paringa** | PARINGA ESTATE PINOT NOIR | estate range, not the flagship |

Three gates fixed it:

1. **Brand anchor must appear in the first three tokens** of the ALM
   description — kills "MT CRAWFORD" and "DOMAINE CHRISTIAN SALMON".
2. **Every distinguishing token must be satisfied**, not all-but-one — kills
   Porer/Riff, Brut Rosé/Sous Bois, Cartizze/Il Fresco.
3. **One ALM row may not serve two products** — kills the duplicate Arras.

Vintage years, `GB`, `GIFT BOX`, `SC`, `VERTICAL` and appellation noise are
stripped before comparison; ALM's abbreviations (`SHZ`, `CHARD`, `SAUV`,
`RIES`, `PROSEC`, `DISGOR`) are expanded.

## The 12 usable costs — and the problem with them

| Wine | ALM cost/btl | At your 20% floor | Typical AU shelf |
|---|---|---|---|
| Dal Zotto Pucino Prosecco | $16.60 | $20.75 | $18–22 |
| Chrismont La Zona Pinot Grigio | $17.74 | $22.17 | $20–24 |
| Turkey Flat Rosé | $23.07 | $28.84 | $24–28 |
| Shaw + Smith Sauvignon Blanc | $25.27 | $31.59 | $26–30 |
| Katnook Estate Merlot | $34.91 | $43.64 | $28–35 |
| Greywacke Wild Sauvignon | $38.50 | $48.12 | $42–48 |
| Shaw + Smith M3 Chardonnay | $41.57 | $51.96 | $42–48 |
| Cloudy Bay Sauvignon Blanc | $42.94 | $53.67 | $38–48 |
| Cloudy Bay Te Koko | $73.54 | $91.92 | $70–80 |
| Penfolds St Henri Shiraz | $101.65 | $127.06 | $100–135 |
| House of Arras EJ Carr Late Disgorged | $185.89 | $232.36 | $180–220 |
| Veuve Clicquot La Grande Dame | $311.14 | $388.92 | $300–380 |

**Nine of the twelve price above the market at a 20% margin.** Only the two
cheapest and St Henri land inside it.

The shelf figures above are my own estimates, not verified against live
listings — treat them as indicative and check the ones that matter. But the
pattern holds across the whole set and is not a rounding question: at ALM
warehouse rates on branded wine, a 20% gross margin puts you above the
discounters on exactly the labels shoppers price-check.

This is why **no price has been written.** The 20% floor was set for spirits,
where the catalogue markup is a comfortable 1.35×. Branded wine bought through
a general wholesaler does not carry that. The decision is yours:

- **Accept a lower floor on branded wine** (10–15% is normal on known labels
  used as traffic drivers), or
- **Do not range the ones that do not clear the floor** — the file says ALM is
  not a competitive source for Cloudy Bay, Katnook or Grande Dame.

Either way it is a pricing-policy call, not something to infer.

## The 4 competing — quick decisions

| Draft | ALM rows |
|---|---|
| Krug Grande Cuvée | plain $382.30 · GB $401.46 · NV gift $402.46 |
| Moët & Chandon Dom Pérignon | Luminous $517.93 · 2015 GB EOY $402.66 · V/Champ GB $391.15 · **Rosé $662.31 (a different wine)** |
| Oakridge 864 Chardonnay | 864 Drive Block · 864 Henk — both $86.09, different single vineyards |
| Penfolds Grange | SHZ 17GB $824.59 · Gift Box 2018 $816.42 — different vintages |

## The 97 not in ALM

Confirms what was recorded when the ALM email was drafted: allocated prestige
wine is not a general wholesaler's business. Absent include Henschke Hill of
Grace, Torbreck RunRig, Jim Barry The Armagh, Mount Mary, Bass Phillip,
Giaconda, Wendouree, Bindi, By Farr, Ochota Barrels, Egly-Ouriet, Jacquesson,
Pol Roger Winston Churchill, Didier Dagueneau, Vieux Télégraphe and Beaucastel.

These need a fine-wine merchant or direct allocation, not ALM.

Worksheet updated: `worksheets/fine-wine-pricing-2026-09-24.csv` — costs filled
for the 12, notes on the rest.
