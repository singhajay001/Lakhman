# Fine Wine load — 2026-09-25

"Load the lot as drafts." Done. Store went from 347 products to **486**; drafts now 280.

## What was created

**139 new products**, all `status: DRAFT`, `productType: Wine`, 750ml, one default
variant each, created with `productSet(synchronous: true)`. Zero user errors across
all five batches.

Each carries:

- price at the **25% GP floor** on the ALM landed cost
- `inventoryItem.cost` = ALM cost per bottle (`tracked: false`)
- `sku` = `SH-FINE-<HANDLE>-750`
- metafield `custom.volume_ml = 750`

## Why 139 and not 159

| | |
|---|---|
| ALM sourceable fine wines | 159 |
| less: already in the catalogue (updated instead of duplicated) | 15 |
| less: ALM duplicate — Eileen Hardy Pinot Noir listed twice at the same $102.88 cost | 1 |
| less: rows with no producer name at all — "Chianti Classico Gran Selezione DOCG", "Chianti Classico Riserva DOCG" | 2 |
| less: competing/duplicate ALM rows resolved to one | 2 |
| **created** | **139** |

The collision check ran against all existing handles *before* any write. `productSet`
without an `id` errors on an existing handle rather than duplicating, which was the
safety net underneath that.

## The 15 existing drafts — 4 were priced wrong

These already existed, so they were **updated**, not duplicated. Applying real ALM cost
exposed four genuine pricing defects:

| Product | Was | Now | Problem |
|---|---|---|---|
| Bollinger La Grande Année | $199.99 | **$359.99** | cost is $269.61 — **it was priced $70 below cost** |
| Penfolds St Henri Shiraz | $124.99 | **$135.99** | 18.7% GP — under the 25% floor |
| Greywacke Wild Sauvignon | $46.99 | **$51.99** | 18.1% GP — under the floor |
| Penfolds Grandfather | $99.99 | **$100.99** | recorded cost $70.00 was wrong; real cost $75.49 → 24.5% |

Seven more had a $0.00 placeholder price and now carry a real one: Dom Pérignon
$536.99, Krug $536.99, Grange $1,099.99, Esclans Garrus $306.99, Oakridge 864
$114.99, Seppeltsfield Para 21 $108.99, Minuty Rosé et Or $67.99.

One was cost-only: Penfolds Great Grandfather kept $350.00 (25.5% GP, already above
the floor); only the missing cost was written.

Three were already correct and were left untouched: Veuve Clicquot La Grande Dame,
Cloudy Bay Te Koko, Cloudy Bay Sauvignon Blanc.

## Known cosmetic imperfections

Titles are derived from ALM descriptions and some carry supplier shorthand —
`Bollinger PN Tx20`, `Lacourte-Godbillon Mont Ames-Migreats`, a few truncated vendor
fields. Three mojibake rows (`PERRIER-JOU?T`, `?POQUE`, `ROS?`) were repaired by
pattern. These are drafts; prune and tidy in Shopify.

## The one blocker to publishing

**Every fine wine has zero images.** That is the only thing standing between this and a
live Fine Wine collection. `/collections/fine-wine` is live and empty right now.

The ALM barcode master just supplied cannot help here — it covers only the core
warehouse range, not the `3xxxxxxx` fine-wine series. See
`alm-barcode-master-2026-09-25.md`.
