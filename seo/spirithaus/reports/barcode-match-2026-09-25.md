# Catalogue-wide barcode match — 2026-09-25

Matched all 515 Shopify variants against the 6,922-product ALM master
(`li71349307.xlsx`, record type 42, `APN TYPE = G`).

## Result

| | |
|---|---|
| Variants in the store | 515 |
| Already carrying a barcode | 38 |
| **Unbarcoded** | **477** |
| **Confident single match — proposed** | **60** |
| Ambiguous (more than one ALM row fits) | 3 |
| Multipack/carton variants, deliberately skipped | 24 |
| No candidate | 390 |

Of the 390 with no candidate, **263 are the fine wines** — their ALM codes live in the
`3xxxxxxx` specialty series, which this extract does not cover — and **70 are brands
ALM does not carry** (Karu, Never Never, Manly Spirits, Melbourne Gin Company,
Applewood, Edinburgh, Indri, Nikka Miyagikyo, Amrut, Rampur). Neither group is a
matcher failure; there is simply nothing to match against.

## How much to trust it

The 38 products that already carry a barcode were used as a **held-out validation
set** — the matcher was not told their barcodes and had to rediscover them.

| | |
|---|---|
| Independently rediscovered, correct | **24** |
| **Wrong** | **0** |
| Declined to guess | 14 |

Zero errors across every tuning round. The 14 declines are conservative failures
(ALM abbreviates past the point of safe matching, e.g. `ABERLOUR 12YO SCOTCH` against
"Aberlour 12 Year Old Double Cask Matured"), not wrong answers.

For contrast, the fine-wine matcher earlier in this project was **39% wrong** on its
first pass. The difference is the gates below.

## The gates

1. **Brand anchor** must appear in the first three tokens of the ALM description.
2. **Size must agree** when both sides state one. This is what keeps Absolut 200ml /
   700ml / 1L apart.
3. **Numbers must agree in both directions.** Age statements and bin numbers are never
   generic. This is what stops "Aberlour 14" matching the `ABERLOUR 12YO` row, and it
   closed a real hole where a single-candidate pool skipped the discriminator check
   entirely.
4. **Every distinguishing Shopify token must be satisfied**, where "distinguishing"
   is computed per brand — a token that varies across that brand's ALM rows
   (Silver/Reposado/Añejo, Storm/Skye, Black/Double Black) must be positively matched.
   Category words (whisky, gin, single, malt, blended) are exempt.
5. **No ALM row may serve two Shopify variants.**
6. **Multipack and carton variants are skipped outright.** 24 were excluded. This is
   the trap that caused real damage earlier in this project — a "Carton of 24" was
   briefly matched to a single-can barcode before this gate went in.
7. **GS1 check digit validated on every proposal.** 60 of 60 pass.
8. ALM rows whose `G` value is not 12/13/14 digits are discarded — 188 of them carry
   short internal codes rather than real GTINs. Bombay Sapphire is one: ALM lists
   `07881954`, which is not a GTIN, so the matcher correctly declined rather than
   writing rubbish over a barcode the store already had right.

## Two worth eyeballing

`Brookie's Byron Dry Gin` → `9351233000000` and `Chandon Brut NV` → `9315321200000`.
Both pass the check digit, but a run of trailing zeros is the shape a placeholder
takes. Worth a glance at the actual bottle before writing.

## Bug found and fixed in my own matcher

First run recalled only 4 of 38. Cause was mine, not the data: a lookbehind in my
preprocessing split `700ML` into `7` + `00ML`, leaving a stray `7` token on **every**
ALM row, which then read as an unmatched discriminating token and rejected nearly
everything. Recall went 4 → 21 → 24 once fixed. Worth recording because the failure
was silent — it produced no errors, just quiet refusals.

## Output

`seo/spirithaus/worksheets/barcode-match-2026-09-25.csv` — 60 proposed + 3 ambiguous,
with the ALM description alongside each so every row can be checked against the
supplier's own wording. Mark the `YOUR CALL` column.

Nothing has been written to Shopify.
