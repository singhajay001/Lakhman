# ALM barcode master — what it settles

Source: `li71349307.xlsx`, ALM full product extract, generated 2026-09-25T10:45:37,
supplier account 71349307, NSW. 38,643 records across 13 record types.

## The finding that matters

Record type **42** carries an explicit **`APN TYPE`** column:

| APN TYPE | Meaning |
|---|---|
| `G` | consumer / retail unit — **this is the one that goes on a Shopify product** |
| `T` | trade unit — the outer carton |

This is the discriminator I have been saying all along could only come from a column
label, never from the number itself. It is now available as data.

Integrity of the file is clean:

- 11,901 barcode rows over **6,922 distinct products**
- **exactly one `G` per product** — zero products carry two consumer barcodes
- **zero products carry a `T` with no `G`** — nothing is outer-only
- 4,979 products carry both; 1,943 carry a consumer barcode only

Pack variants are not encoded as a second barcode on the same product. They get their
own `PRODUCT NUMBER` with a `PARENT PRODUCT CODE` and their own `G`
(e.g. `00002659` Mornington Pale Ale 375ML → `00002691` the 6-pack → `00002772` the 24).

## Coverage limit — read this before relying on it

The extract covers product codes **`00002243`–`00999254`** only. That is ALM's core
warehouse range.

Every fine-wine item code is in the **`3xxxxxxx` specialty series** and is **absent**.
So this file **cannot** barcode the 139 fine-wine drafts just loaded — only 20 of the
159 ALM wine rows appear here at all. To barcode the fine wine book we need a second
extract covering the specialty range, which is worth adding to the outstanding ALM
request.

What it *can* barcode is the existing core catalogue.

## Verification of the 25 barcodes already written

| Result | Count |
|---|---|
| Confirmed as ALM consumer (`G`) | **18** |
| Found to be an outer (`T`) | **0** |
| Not in ALM at all | 7 |

**Nothing already written to the store is an outer barcode.** The 7 unmatched are
brands ALM does not carry — Hibiki, Amrut, Rampur, Aberlour ×2, Chivas Regal 12,
Sierra Silver, Tanqueray No Ten. Those came from the POS export, so their absence from
an ALM file is expected and is not evidence against them.

## The 6 open decisions — 3 of my proposals were wrong

| Product | I proposed | ALM `G` | Verdict |
|---|---|---|---|
| Laphroaig Oak Select 700 | `5010019637529` | `5010019637529` | ✅ **exact match, write it** |
| Johnnie Walker Black Label 700 | `5000267098463` / `...470` | `5000267189611` | ❌ **use ALM's** |
| Royal Salute 21YO 700 | `9300601363537` | `9300727010414` | ❌ **use ALM's** |
| Jose Cuervo Especial Reposado 700 | `7501035042131` | `0082000491651` | ❌ **use ALM's** — see below |
| Sierra Tequila Reposado 700 | `4062400543125` | `4062400159203` | ❌ **use ALM's** — see below |
| Indri Trini 700 | `8908005173939` | *not carried* | still open — read it off the bottle |

### Jose Cuervo — the exact failure mode I warned about

My `7501035042131` was **derived**. ALM's Especial Gold 700ML carries
outer `T = 17501035042138`. Strip the indicator digit, recompute the check digit, and
you get `7501035042131` — my number. It is a GTIN-13 manufactured out of a carton code.

ALM says the real consumer barcode for that bottle is **`0082000491651`**.
The derivation produced a number that does not exist.

This is the concrete proof of the rule: **there is no arithmetic that turns an outer
into a consumer GTIN.** The only safe source is a column that says which it is.

The POS line reads `JOSE CUERVO ESP GOLD TEQ 700ML` and Especial Gold *is* the
reposado, so `0082000491651` is the bottle on the shelf. (If it is instead the bottle
labelled Reposado, ALM's 35% 700ML is `7501035011762`.)

### Sierra Reposado — cross-checked against what is already written

ALM carries the 700ml Reposado at two strengths:

- 38% → `4062400159203`
- 35% → `4062400182003`

Sierra **Silver** is already written to the store as `4062400159104` — the **38%**
block. The Reposado sibling from the same block is `4062400159203`, so that is the
recommendation. My `4062400543125` sits one check digit away from ALM's *outer*
`04062400543118`, which is a strong sign it came out of a carton block.

### Royal Salute

ALM stocks exactly one: `CHIVAS ROYAL SALUTE21YO N700ML`. Since the range comes
through ALM, the 21YO is right and the barcode is `9300727010414`.

## Recommendation

Write the five ALM-confirmed barcodes. They are supplier-authoritative for stock bought
through ALM, which this stock is. Leave Indri open.
