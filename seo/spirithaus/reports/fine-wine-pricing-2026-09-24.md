# Spirithaus — pricing the fine wine drafts

**2026-09-24.** Asked to price the 114. Here is what I found and why I have not
written a single price.

## The 141 drafts are three groups, not one

| Group | Count | State |
|---|---|---|
| Fine wine, **priced** | **25** | Has a price. 24 have an image, 1 does not. |
| Non-wine, priced | 2 | Lark Devil's Storm No. 183 ($199.99), Tequila Blu ($75.99) |
| Fine wine, **$0.00** | **114** | No price, **no cost**, and **no image at all** |

## Why I cannot price the 114

**There is no cost anywhere.** Every one of the 114 returns `unitCost: null`.
I checked the drafts directly rather than assuming — the earlier margin work
only ever looked at active products.

The catalogue's pricing rule is knowable: across the 143 costed live products
the markup is a consistent **cost × 1.35** (median 1.353). Given a cost I could
price any of these in seconds and hold the 20% floor exactly. Without one, the
formula has no input.

**The ALM export will not fill this gap.** ALM is a broad-range liquor
wholesaler; allocated prestige wine — Grange, Hill of Grace, Krug, Dom Pérignon,
Château de Beaucastel — is bought direct from the producer or through a fine-wine
merchant. That was already recorded when the ALM email was drafted.

**Inferring a retail price from market data would not be safe.** These are
$50–$1000 bottles where the price moves with vintage and allocation. A figure
scraped from another retailer is not your cost, so it cannot be checked against
your margin floor — it could sit below cost and I would have no way to know.
On a Grange or a Cristal that is a four-figure error per case.

This is the same class of mistake as the carton-price episode earlier today: a
confident pattern, applied without the one piece of data that would have
falsified it.

## What unblocks it

Any **one** of these, and all 114 are priced the same day:

1. **A supplier price list or invoice** covering the fine wine range — cost ex
   GST per bottle. Best option: it feeds the markup rule directly and the floor
   is guaranteed.
2. **Your own RRP list**, if you already price these by recommended retail
   rather than by cost. I would write them as given and flag any where the
   implied margin looks thin once costs arrive.
3. **Tell me to research market RRP** for a named subset. I can do this, but it
   produces a *market reference*, not your cost — you would need to sanity-check
   each one against what you actually pay. Useful for 10–20 headline bottles,
   not for all 114.

Worksheet ready for option 1 or 2:
`worksheets/fine-wine-pricing-2026-09-24.csv` — 114 rows, grouped by style so a
supplier list can be matched section by section.

| Group | Count |
|---|---|
| Prosecco & Cartizze, Chardonnay, Riesling, Sauvignon Blanc, Pinot Gris, Rosé, Pinot Noir, Cabernet & Bordeaux | 10 each |
| Red — Grenache & Rhône | 9 |
| Sparkling — Australian | 8 |
| Champagne | 7 |
| Fortified | 6 |
| Red — Shiraz | 4 |

## What can be done today without inventing anything

**Publish the 25 fine wines that already have prices.** That takes
`/collections/fine-wine` from **0 products to 25** and closes the live
soft-404 — which was the actual reason the 114 became urgent.

Two things to decide first:

- **24 of the 25 use screenshots as their product image** — filenames like
  `Screenshot2026-09-12at1.11.24am.png`. That is acceptable on a $42 Woodlands.
  On a **$949.99 Henschke Hill of Grace** or a **$529.99 Cristal** it undercuts
  the price point badly. These are the bottles that justify the fine-wine page
  existing.
- **Wendouree Cabernet Sauvignon ($250.99) has no image at all.** Publishing it
  shows a placeholder.

My recommendation: publish the 25, and replace the screenshots on the top
half-dozen by value first. An imperfect photo on a live, buyable page beats a
collection page that promises eight wines and shows none.

## Also worth knowing

**None of the 114 has an image either.** Even with prices tomorrow, they would
publish as 114 pages with no product photo. Sourcing images is a parallel task,
not a follow-on — worth starting now rather than after the prices land.
