# Spirithaus — a Fine Wine range rebuilt from ALM stock

**2026-09-25.** Instead of sourcing 114 aspirational wines ALM does not carry,
this is a Fine Wine range built from what ALM actually stocks.

## First, a correction

Yesterday I wrote that "allocated prestige wine is not a general wholesaler's
business" and that the 97 unmatched drafts would need a fine-wine merchant.
**That was too sweeping and it is wrong for this book.**

ALM's wine file carries, at 750ml:

| | Cost/btl |
|---|---|
| Penfolds Grange | $824.59 |
| Penfolds Bin 707 | $597.43 |
| Penfolds Bin 169 | $242.92 |
| Penfolds RWT | $164.93 |
| Penfolds Yattarna | $164.16 |
| Krug Grande Cuvée | $382.30 |
| Dom Pérignon | $391.15 |
| Maison Tramier Corton Grand Cru | $188.55 |
| Joseph Drouhin Gevrey-Chambertin | $259.68 |
| San Polo Brunello di Montalcino Riserva | $174.90 |
| Brokenwood Graveyard Shiraz | $301.54 |
| Kaesler Old Bastard Shiraz | $249.98 |

Plus **Château d'Esclans Garrus** ($230.20) and **Seppeltsfield 21YO Para
Tawny** ($81.38) — two wines from the original 114 list that my name matcher
reported as absent. It missed them because the ALM descriptions are
`ESCLANS GARRUS` and `SEPPELTSFIELD 21YO PARA TAWNY 2003`: the brand anchor
gate required the producer in the first three tokens, and "Château" and the
year placement defeated it. The gate was right to be strict — it is what
stopped seven bad matches — but it has a false-negative cost, and this is it.

## How the range was selected, and the false start

**First attempt: stratified by price.** Take N wines from each cost band so the
range spans price points. It produced 107 bottles and it was wrong, because
*expensive* is not *fine*. It selected **Harveys Bristol Cream** at $56.99 and
"Nangkita Wine Vintage Tawny" — high unit cost, no place on a fine wine page.
It also filed a **Bergström Pinot Noir** under White, because ALM has that row
miscategorised and the filter propagated the error.

**Second attempt: select on producer and appellation.** Iconic producers,
classified appellations (Grand Cru, Premier Cru, Barolo, Brunello, Bolgheri,
Châteauneuf, Hermitage, Sancerre), and cellar-grade designations. 207 bottles,
all genuinely fine wine — but concentrated, with twenty-plus Penfolds.

**Final: capped per producer** — at most 3 reds, 3 whites or 2 Champagnes from
any one house, taking the top, middle and entry bottle so a producer is
represented by its range rather than only its flagship.

Red-grape rows sitting in ALM's WHITE category are dropped rather than
re-filed; an ALM categorisation error is worth knowing about, not silently
patching.

## The proposal

**159 bottles from 74 producers.**

| Group | Count |
|---|---|
| Red | 79 |
| White | 38 |
| Champagne | 24 |
| Fortified | 6 |
| Rosé | 5 |
| Sparkling rosé | 4 |
| Sparkling | 3 |

| | |
|---|---|
| Price span | $47.99 – $1,099.99 |
| Median | $111.99 |
| Under $100 | 73 bottles |
| $100–250 | 66 bottles |
| $250+ | 20 bottles |

All priced at the **25% GP floor**, rounded up to the next `.99`.

One of each would be **$18,281.91 at cost**. That is a range plan, not an order
— the point of a fine wine page is that most of it is available rather than
warehoused, and ALM's carton sizes mean committing to 3, 6 or 12 of anything
you stock.

## Compared with the 114 it replaces

| | Old list | This list |
|---|---|---|
| Sourceable | 17 of 114 | **159 of 159** |
| Has a cost | 12 | **159** |
| Priced | 12 | **159** |
| Has an image | 0 | 0 |

The old list was a wishlist. This one is a range you can actually buy, price
and publish.

## What this does not solve

**Images.** Still zero. 159 products with no photograph is the same blocker as
114 with no photograph, and it is now the only thing standing between this list
and a live Fine Wine collection.

**The market question stands.** Every price here is the 25% floor. The same
tension applies as with the twelve: on labels shoppers price-check, ALM's cost
may not leave room. Less acute at this end — nobody comparison-shops a Corton
Grand Cru the way they do a Cloudy Bay — but worth checking the well-known
names before publishing.

Worksheet: `worksheets/fine-wine-from-alm-2026-09-25.csv` — 159 rows with ALM
item code, carton size, cost, price and a `Range? (y/n)` column.
