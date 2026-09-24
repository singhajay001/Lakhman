# Barcodes from the Trafalgar POS, 24 September 2026

`product_report.dat` — 11,528 rows, tab-separated, from the **Trafalgar
Supermarket & Cellars POS**. Groceries, health and beauty and confectionery
alongside **530 spirits, 771 wine and 351 beer**.

## Why a Trafalgar file is legitimate here

The routing rule in this repository says never to merge the two businesses.
That rule is about identity — NAP, phone, address, brand. **A barcode is a
property of the bottle, not of the business.** Tanqueray 700mL scans the same
whether Trafalgar sells it over a counter or Spirithaus ships it. Using the
POS barcode for a product both businesses stock is not a merge.

**What was deliberately not taken: Trafalgar's prices and costs.** The file
carries `Recommended Retail Price`, `Sell Price 1-4`, `Unit Cost`,
`Carton Cost`, `Stock On Hand`, twelve months of sales history and four
competitor price columns. All of that is Trafalgar's trading data. Different
business, different market, different margins. Only the `Plu` column crossed
over.

## 🔴 The file proves the outer/consumer distinction in the store's own data

| Column | Example | What it is |
|---|---|---|
| `Plu` | `9339423003505` | the barcode on **the bottle** |
| `Tun Code` | `19339423003502` | the same GTIN as a **carton** — GTIN-14 with a leading indicator digit |

9,197 rows carry a Tun Code and **7,363 of them are 14 digits**. GTIN-14 is a
valid barcode length, and the theme's product schema would type it as `gtin14`
without complaint.

This is exactly the trap identified from the ALM screen a few hours ago, now
confirmed in a second, independent system. `Tun Code` was never read.

## Written: 12 barcodes

| Handle | Barcode | POS description |
|---|---|---|
| four-pillars-rare-dry-gin | 9349749000164 | FOUR PILLARS RARE DRY GIN 700ML |
| jameson-stout-edition | 5011007025410 | JAMESON CASKMATES STOUT 700ML |
| jameson-ipa-edition | 5011007025960 | JAMESON CASKMATES IPA ED 700ML |
| starward-two-fold | 9346943000174 | STARWARD TWO-FOLD 700ML |
| talisker-skye | 5000281038094 | TALISKER SKYE 45.8% 700ML |
| patron-silver | 721733000739 | PATRON SILVER 700ML |
| don-julio-blanco | 7506064300160 | DON JULIO BLANCO 38% 700ML |
| patron-anejo | 721733000715 | PATRON ANEJO 700ML |
| bombay-sapphire-gin | 5010677714006 | BOMBAY SAPPHIRE GIN 700ML |
| gordons-london-dry-gin | 9310495069514 | GORDONS DRY GIN 37% 700ML |
| hendricks-gin | 5010327755014 | HENDRICKS GIN 700ML |
| roku-japanese-craft-gin | 4901777305359 | ROKU GIN 43% 700ML |

Every one validated: correct length, digits only, **check digit computed and
confirmed**, no barcode claimed twice. Two are 12-digit UPC-A (both Patrón);
the rest EAN-13. Products carrying a GTIN went from **2 to 14**.

Audit trail: `seo/spirithaus/worksheets/barcodes-from-pos-2026-09-24.csv`.

## 🔴 Twelve out of ninety-seven, and the reason is the point

The matcher was written three times, because the first two produced confident
wrong answers that only a human reading the output would catch.

**Pass 1 — 23 "confirmed", at least 3 wrong.** `archie-rose-single-malt-whisky`
scored **100%** against `ARCHIE ROSE SIG DRY GIN`. The cause was my own
stopword list: it discarded "gin", "whisky", "malt" and "single" as noise, and
those were the only words distinguishing a gin from a whisky by the same
distiller. Both El Jimadors landed on one barcode.

**Pass 2 — 15 proposed, 3 wrong.** `1800-reposado` matched **PATRON REPOSADO**,
`sierra-tequila-silver` matched **1800 SILVER**. Cause: pure-digit tokens were
being stripped, so "1800" — a brand — vanished, leaving only "reposado" and
"tequila" to match on. `tanqueray-no-ten-gin` matched plain `TANQUERAY GIN`.

**Pass 3 — 13 proposed, 1 wrong.** `archie-rose-distillers-strength-gin` matched
`ARCHIE ROSE SIG DRY GIN`. Caught by reading the list; dropped by hand.

The final gates: **size must match exactly, category must match, expression
words must agree on both sides, the brand anchor must appear in the
description, and the check digit must pass.**

Twelve is a low yield from ninety-seven, and that is the correct outcome. A
wrong GTIN claims this page is that product and hands the listing to someone
else's bottle. Eighty-five rejections cost nothing; one bad accept is live and
silent.

## What the other 85 need

Mostly they simply are not in the POS: Trafalgar is a supermarket bottle shop
and Spirithaus carries an independent spirits range — Karu, Never Never, Poor
Toms, Manly Spirits, Applewood, Lark, Amrut, Indri, Rampur. The POS has none of
them.

Some are near-misses worth a manual look, where the POS clearly has the
product but the description differs too far for a safe automatic match —
Yamazaki 12, Hakushu 12, Lagavulin 16, Talisker 10, Laphroaig 10, Aberlour 12,
Glenfiddich 12, Dimple 12, Monkey Shoulder, Tanqueray, Grey Goose.

Two carry malformed Plus in the POS itself and should be corrected there
first: `HIBIKI WHISKY HARMONY 700ML` at 11 digits and
`JOSE CUERVO ESP GOLD TEQ 700ML` at 11 — both look like UPC-A values with a
leading zero lost somewhere in an export.

---

# Owner-confirmed: 7 more written. GTIN coverage 14 → 21.

Presented for review because the matcher would not write them: in each the POS
description names the same expression as the Spirithaus product, but the
wording differs too far for an automatic accept.

| Handle | Barcode | POS row |
|---|---|---|
| yamazaki-12-year-old | 4901777165755 | YAMAZAKI WHISKY 12YO 43% 700ML |
| hakushu-12-year-old | 4901777256149 | HAKUSHU WHISKY 12YO 3S 700ML |
| aberlour-12-year-old | 3047100056251 | ABERLOUR 12YO SCOTCH 700ML |
| monkey-shoulder | 5010327105215 | MONKEY SHOULDER SCOTCH 700ML |
| dimple-12-year-old | 5000281012872 | DIMPLE SCOTCH 12YO 700ML |
| rampur-double-cask | 8902147004052 | RAMPUR DBL CASK SGLE MALT 700ML |
| archie-rose-signature-dry-gin | 9350657004779 | ARCHIE ROSE SIG DRY GIN 700ML |

All seven revalidated before writing — length, digits, check digit, no
duplicate inside the set — and each read back by handle afterwards.

**Note for anyone verifying this:** a `barcode:*` product-variant search run
straight after the write returned only 18 of the 21, missing four that had just
been written. The search index lags; reading each product by handle is
authoritative. Same lesson as `productsCount` on 23 September — do not use a
search or a counter to confirm a write took effect.

## 🔴 Eight marked "none" — and why single-candidate is not a signal

Fifteen products had exactly one candidate, same size, valid check digit. That
combination looks like confidence and is not: **eight of the fifteen were the
wrong bottle.**

| Spirithaus product | Only candidate offered | |
|---|---|---|
| Aberlour 14 Year Old | ABERLOUR 12YO SCOTCH | the 12 |
| Aberlour A'bunadh | ABERLOUR 12YO SCOTCH | the 12 |
| Archie Rose Single Malt Whisky | ARCHIE ROSE SIG DRY GIN | a gin |
| Archie Rose Distiller's Strength Gin | ARCHIE ROSE SIG DRY GIN | the Signature |
| Four Pillars Bloody Shiraz Gin | FOUR PILLARS RARE DRY GIN | the Rare Dry |
| Four Pillars Navy Strength Gin | FOUR PILLARS RARE DRY GIN | the Rare Dry |
| Four Pillars Olive Leaf Gin | FOUR PILLARS RARE DRY GIN | the Rare Dry |
| Hendrick's Neptunia Gin | HENDRICKS GIN | the standard |

Trafalgar stocks the brand and not that variant, so the only row carrying the
brand is a different bottle. Had "one candidate, size matches, check digit
passes" been treated as sufficient, **three separate Four Pillars gins would
now share the Rare Dry barcode** and two Aberlours would carry the 12's.

The rule this earns: a single candidate is evidence of a thin shelf, not of a
match. The expression has to be read.
