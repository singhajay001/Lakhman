# Spirithaus — barcode cross-reference

**2026-09-24.** Every Spirithaus product still missing a barcode, against the
Trafalgar POS export and the ALM supplier screens. 50 products.

Mark the **YOUR CALL** column in
`worksheets/barcode-cross-check-2026-09-24.csv`, or just tell me the
exceptions — I have pre-filled a verdict for every row.

**Nothing in the `y` / `y*` / ASK sections has been written to Shopify yet.**

---

## Already written (5) — confirmed against an ALM supplier screen

These came off the ALM product detail screens you pasted, which print the
**Consumer GTIN** explicitly. That is the only source so far that states which
GTIN is the single bottle rather than the carton.

| Product | Size | Barcode | POS / source line | Basis |
|---|---|---|---|---|
| Aberlour 12 Year Old | 700 | `3047100056251` | ABERLOUR 12YO SCOTCH 700ML | ALM screen: Consumer GTIN |
| Aberlour Abunadh | 700 | `5010739261523` | (POS had no A'bunadh) | ALM screen: Consumer GTIN |
| Aberlour 14 Year Old | 700 | `5000299620915` | (POS had no 14YO) | ALM screen: Consumer GTIN |
| Archie Rose Signature Dry Gin | 700 | `9350657004779` | ARCHIE ROSE SIG DRY GIN 700ML | ALM screen confirms POS |
| Archie Rose Single Malt Whisky | 700 | `9350657000757` | (POS had only the gin) | ALM screen: Consumer GTIN |

---

## Recommend YES (17) — exact name, exact size, no competing candidate

| Product | Size | Barcode | POS / source line | Basis |
|---|---|---|---|---|
| Yamazaki 12 Year Old | 700 | `4901777165755` | YAMAZAKI WHISKY 12YO 43% 700ML | exact name + size |
| Hakushu 12 Year Old | 700 | `4901777256149` | HAKUSHU WHISKY 12YO 3S 700ML | exact name + size |
| Talisker 10 Year Old | 700 | `5000281005416` | TALISKER MALT 10YO 700ML | exact, vs Storm/Skye |
| Talisker Storm | 700 | `5000281032733` | TALISKER MALT STORM 700ML | exact, vs 10YO/Skye |
| Laphroaig 10 Year Old | 700 | `5010019640260` | LAPHROAIG 10YO MALT 40% 700ML | exact, vs Select |
| Glenfiddich 12 Year Old | 700 | `5010327115115` | GLENFIDDICH MALT 12YO 700ML | exact, vs Special Reserve |
| Monkey Shoulder | 700 | `5010327105215` | MONKEY SHOULDER SCOTCH 700ML | exact name + size |
| Dimple 12 Year Old | 700 | `5000281012872` | DIMPLE SCOTCH 12YO 700ML | exact name + size |
| Rampur Double Cask | 700 | `8902147004052` | RAMPUR DBL CASK SGLE MALT 700ML | exact name + size |
| Amrut Fusion | 700 | `8901193004122` | AMRUT FUSION IND SNGL MALT | exact expression, vs Raj Igala |
| 1800 Silver | 700 | `7501035013117` | 1800 SILVER TEQUILA 700ML | exact, vs Reposado/Coconut |
| 1800 Reposado | 700 | `7501035013124` | 1800 REPOSADO TEQUILA 700ML | exact, vs Silver/Coconut |
| Jose Cuervo Especial Silver | 700 | `7501035042308` | JOSE CUERVO ESP SILV TEQ 700ML | exact, vs Gold |
| Sierra Tequila Silver | 700 | `4062400159104` | SIERRA TEQUILA BLANCO 38% 700ML | blanco = silver, vs Gold/plain |
| El Jimador Reposado | 700 | `7501145269107` | EL JIMADOR TEQUILA REPOS 700ML | exact, vs Blanco |
| El Jimador Blanco | 700 | `7501145268100` | EL JIMADOR TEQUILA BLANC 700ML | exact, vs Reposado |
| Tanqueray London Dry Gin | 700 | `5000291020706` | TANQUERAY GIN 700ML | exact, vs No. Ten |

---

## Recommend YES, with a repair (3) — leading zero restored

The POS `Plu` field is 11 characters wide. A US **UPC-A** is 12 digits
beginning with `0`, so the POS stores it with the zero chopped off, and the
check digit then fails. Restore the zero and all three validate.

These are US-market barcodes found in an Australian store. They are correct for
the bottle Trafalgar scanned; if Spirithaus sources the same product through a
different importer the bottle may carry an EAN-13 instead. Worth one physical
scan check.

| Product | Size | Barcode | POS / source line | Basis |
|---|---|---|---|---|
| Hibiki Japanese Harmony 700Ml | 700 | `080686934035` | HIBIKI WHISKY HARMONY 700ML | exact name+size; zero restored |
| Chivas Regal 12 | 700 | `080432402931` | CHIVAS REGAL SCOTCH 12YO 700ML | exact name+size; zero restored |
| Tanqueray No Ten Gin | 700 | `088110158606` | TANQUERAY N0. TEN GIN | exact expression; zero restored |

---

## Need your call (6) — plausible, but I will not guess

| Product | Size | Barcode | POS / source line | Basis |
|---|---|---|---|---|
| Laphroaig Oak Select | 700 | `5010019637529` | LAPHROAIG SELECT 40% 700ML | is your 'Oak Select' the Laphroaig Select? |
| Indri Trini | 700 | `8908005173939` | INDRI IND SINGLE MALT WHISKY 700 | POS doesn't say Trini - only Indri you range? |
| Royal Salute 21 Year Old | 700 | `9300601363537` | CHIVAS REGAL ROYAL SALUTE | POS doesn't say 21 - Royal Salute has 21/24/38 |
| Johnnie Walker Black Label | 700 | `5000267098463 / 5000267098470` | JOHNNIE WALKER BLACK (x2, no size) | two POS lines, same text - which is the 700? |
| Jose Cuervo Especial Reposado | 700 | `7501035042131` | JOSE CUERVO ESP GOLD TEQ 700ML | Cuervo Especial Gold IS a reposado - same bottle? |
| Sierra Tequila Reposado | 700 | `4062400543125` | SIERRA GOLD TEQUILA 700ML | Sierra Reposado is sold as Gold - same bottle? |

---

## Recommend NO (19) — the POS does not stock this bottle

Every one of these was produced by an automated matcher as a "candidate" and is
wrong. Left unchecked they would have put the Rare Dry Gin barcode on three
different Four Pillars gins and a Korean soju barcode on Ink Gin.

| Product | Size | Barcode | POS / source line | Basis |
|---|---|---|---|---|
| Chivas Regal 18 | 700 | `-` | POS has 12YO, XV(15), Royal Salute only | no 18YO in the POS |
| Glenfiddich 18 Year Old | 700 | `-` | POS has 12YO + Special Reserve only | no 18YO in the POS |
| Jameson Black Barrel | 700 | `-` | POS has IPA, Stout, standard Irish | no Black Barrel in the POS |
| Johnnie Walker 18 Year Old | 700 | `-` | POS has Black only | wrong expression |
| Johnnie Walker Double Black | 700 | `-` | POS has Black only | wrong expression |
| Makers Mark | 1000 | `-` | MAKERS MARK BOURBON 700ML | size mismatch: you list 1L, POS is 700 |
| 1800 Anejo | 700 | `-` | POS has Silver, Reposado, Coconut | no Anejo in the POS |
| 1800 Cristalino | 700 | `-` | POS has Silver, Reposado, Coconut | no Cristalino in the POS |
| Patron Xo Cafe | 750 | `-` | POS has Anejo, Reposado, Silver (700) | wrong expression AND size |
| Archie Rose Distillers Strength Gin | 700 | `-` | POS has Signature Dry only | need the ALM screen |
| Four Pillars Bloody Shiraz Gin | 700 | `-` | POS has Rare Dry only | wrong expression |
| Four Pillars Navy Strength Gin | 700 | `-` | POS has Rare Dry only | wrong expression |
| Four Pillars Olive Leaf Gin | 700 | `-` | POS has Rare Dry only | wrong expression |
| Gin Mare Mediterranean Gin | 700 | `-` | POS has Archie Rose, Bombay Sapphire | no Gin Mare in the POS |
| Hendricks Neptunia Gin | 700 | `-` | HENDRICKS GIN 700ML | that is standard Hendrick's, not Neptunia |
| Ink Gin | 700 | `-` | GOOD DAY PINK (x3) | matcher noise - unrelated product |
| Monkey 47 Schwarzwald Dry Gin | 500 | `-` | MONKEY SHOULDER SCOTCH 700ML | matcher noise on the word 'monkey' |
| Bundaberg Original | 700 | `-` | BUNDABERG SPICED RUM | Original is not Spiced |
| Bundaberg Small Batch | 700 | `-` | BUNDABERG SPICED RUM | Small Batch is not Spiced |

---

## What closes the rest

One email to ALM: **product export, all categories, including Consumer GTIN,
cost and unit size.** That single file closes the 19 `n` rows, the 114
unpriced fine-wine drafts and the missing costs in one pass. Pasting screens
one at a time works, but it is five minutes per product.
