# RRP comparison instead of compare-at — 2026-09-26

## What was asked, and why I did not do it

The instruction was: *"reprice to ALM and mark it on special at 25% GP making it
attractive."* The literal implementation is `compare_at_price = ALM RRP`.

I did not do that. Two reasons, and the second is the serious one.

### It would have done nothing on the storefront

The theme already carries a guard, `snippets/sh-reduced.liquid`, written for exactly
this. Before any strikethrough renders it requires:

- `compare_at_price > price`
- `custom.previous_price_from` — the date the store **started charging** that price
- held **≥ 30 days**
- not past `custom.special_ends`

An RRP satisfies none of those. The guard would have nulled it. From the file:

> *"Under the Australian Consumer Law a struck-through 'was' price is a
> representation that the product was actually offered at that price for a
> reasonable period immediately before... **Discipline is not a control.**
> `compare_at_price` is a free text box in admin and nothing stops anyone typing a
> number into it, so this snippet requires the price to carry evidence."*

### It would have done real damage in the sales channels

**Shopify's sales channels read `compare_at_price` directly and bypass the theme.**
shop.app — the one Google surface this brand currently has — would have begun
advertising *"was $238.99, now $159.99"* on Lagavulin 16, a price the store never
charged.

**62 of the 77 affected products are live**, and ten would have shown a discount
deeper than 25%:

| | Price | RRP | Implied |
|---|---|---|---|
| Lagavulin 16 | $159.99 | $238.99 | **−33%** |
| De Bortoli Rosé | $13.99 | $20.99 | **−33%** |
| Upside Down Sauv Blanc | $9.99 | $14.79 | −33% |
| Bacardi Carta Blanca | $49.00 | $68.99 | −29% |
| Monkey Shoulder | $59.99 | $82.99 | −28% |

The theme guard protects the storefront. Nothing protects the feeds. So the version
that looks inert is the dangerous one.

## What was done instead

An RRP comparison **is** legitimate — it just is not a was-price, and
`compare_at_price` is the was-price field. The two claims were separated.

| | |
|---|---|
| `custom.rrp` (money) | Holds the supplier RRP. **77 products written.** Definition description says never to copy it into `compare_at_price`. |
| `snippets/sh-rrp.liquid` | Decides whether it may be shown. Same output contract as `sh-reduced`. |
| `snippets/price.liquid` | Renders it as plain labelled text under the price. No `<s>`, no sale badge. |

Display ships in **PR #6** — https://github.com/singhajay001/spirithaus-theme/pull/6.
The metafield values are already live but render nothing until it merges, so there is
no window where a half-applied change is visible.

### When the RRP is withheld

- no `custom.rrp`
- RRP not above the price — never invent a saving
- **multi-variant products** — one RRP cannot describe a 200ml and a 1L
- **a genuine evidenced special is running** — the was-price is the stronger claim

The two mechanisms compose: run a real special and the RRP steps aside; end it and
the RRP returns.

### Verification

`patches/rrp.py`, 9 assertions, all passing. The three that matter most prove a
`compare_at_price` failing `sh-reduced`'s evidence test does **not** suppress the RRP
— otherwise a stray number typed into admin would silently remove a legitimate
comparison.

## Also recorded

**Lagavulin 16 cost corrected to $130.00.** Owner bought 6 bottles on a supplier
special; the $171.48 on file was ALM's standard landed cost. At $159.99 retail that
is **18.7% GP** — still under the 20% spirits floor, but a real margin rather than
the loss the stale cost implied.

This is one of the 181 variants carrying no cost or a wrong one. Until those are
filled, every margin number in this project is an estimate.
