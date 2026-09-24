# Spirithaus — overnight work, 2026-09-24

Everything below is done and verified in Shopify unless it says otherwise.

---

## 1. The price defect has a root cause, and it is not "someone typed it wrong"

Cost data settles it. **Store prices are cost × 1.35** — the median markup across
all 143 products that carry a cost is 1.353, and every one of the "impossible"
prices sits on that same ratio.

So the prices were generated correctly from the costs. **The costs were loaded as
carton costs for some products**, and the markup faithfully turned a carton cost
into a carton price. Fixing the price alone would have left a wrong cost and a
wrong margin behind it.

### Fixed — proven by exact arithmetic against a sibling product

| | was | now | proof |
|---|---|---|---|
| **Curatif Negroni** 130ml can | $236.99, cost $177.36 | **$12.99**, cost **$7.39** | $177.36 ÷ $7.39 = **24.000000**. Four sibling Curatif cans all cost $7.39 and sell for $12.99. |
| **Naked Life Classic G&T** 250ml | $100.99, cost $75.60 | **$16.99**, cost **$12.60** | $75.60 ÷ $12.60 = **6.000000**. Naked Life Pink Paloma, same brand, same 250ml can, costs $12.60 and sells for $16.99. |
| **Naked Life Passionfruit Martini** 250ml | $100.99, cost $75.60 | **$16.99**, cost **$12.60** | identical to the above |

No number was invented. The corrected cost is the sibling's cost; the corrected
price is the sibling's price. Resulting margins are 43.1% and 25.8%, both above
the 20% floor.

### NOT fixed — no sibling to divide against, so any figure would be a guess

| Product | Cost held | Why it cannot be derived |
|---|---|---|
| **Bellarine Tarty Ted** 250ml | $192.01 | ÷16 = $12.00 and ÷24 = $8.00 are *both* clean. No second Bellarine product to check against. |
| **Brookie's Gin & Tonic** 275ml | $96.96 | ÷16 = $6.06, ÷24 = $4.04. Both plausible. |
| **Maybe Sammy Jasmine Negroni 500ml** | $14.47 | Cost is too **low**, not too high — the 100ml costs $13.33, so the 500ml should be roughly 5×. Comparable 500ml bottled cocktails: Starward Whisky Negroni costs $48.27, Karu Outcask sells at $69. **This bottle is being sold at $19.99 when it is probably a $65 bottle.** That is a loss on every sale, not a lost sale. |
| **Maybe Sammy Old Fashioned 500ml** | $14.77 | same |
| **Maker's Mark 1 Litre** | none | No cost at all, priced $59.99 — below its own 700ml at $62.99. Jim Beam's 1L/700ml price ratio suggests ~$88, Jack Daniel's suggests ~$78. Too wide a spread to pick. |
| **Four Pillars Yuzu Gin & Soda** 250ml | $14.40 | Cost is in line with other single cans. The *price* of $30.99 is 2.15× cost against a catalogue norm of 1.35. Possibly a 4-pack listed as a can. |

**The two Maybe Sammy 500ml bottles are the urgent ones** — they are the only
items in the store losing money on every sale rather than simply failing to sell.

Also found: **Jack Daniel's 1 Litre carries the same cost as the 700ml** ($48.45
for both). The 1L cost is wrong, so its stated 39% margin is overstated.

---

## 2. Margin floor: clean

Checked all 143 live products that carry a cost against the 20% gross margin
floor. **Zero products fall below it.** The floor is being held everywhere it can
be measured.

**66 of 209 live products carry no cost at all**, so their margin cannot be
checked. Among them: Yamazaki 12, Hakushu 12, Hibiki, Lagavulin 16, Talisker ×3,
Royal Salute 21, Glenfiddich 12 and 18, the whole 1800 and Patrón ranges, Jameson
×3, Johnnie Walker ×3. These are some of the highest-value bottles in the store.
The ALM export already drafted closes most of this.

---

## 3. SEO metadata on the 7 content pages — written

All seven pages had **no** SEO title and **no** meta description. Shopify was
falling back to the bare page title.

The six blog articles already had good `title_tag` / `description_tag`
metafields, so those were left alone.

| Page | Now targets |
|---|---|
| Delivery areas and times | `sydney alcohol delivery` — commercially the most valuable of the seven |
| Photo ID on delivery | `do I need ID for alcohol delivery` — a real question people search |
| Contact | brand + category |
| Responsible service of alcohol | NSW licence obligations |
| Returns and refunds | broken bottle / wrong item |
| Terms of sale | Australian Consumer Law |
| Privacy policy | data handling |

---

## 4. `New This Month` — now populated

Was 0 products, because its rule is `TAG = "new"` and nothing in the store
carried the tag. The 14-product bourbon range added 11 September is now tagged.
**Verified: the collection holds 14 products.**

---

## 5. Aberlour A'bunadh metafield

`volume_ml` was missing; set to 700 (confirmed by the SKU and the ALM screen).

`abv` and `standard_drinks` were deliberately **left empty**. A'bunadh is cask
strength and the ABV changes with every batch — a fixed number there would be
wrong more often than right.

---

## 6. Inventory: worth a decision, not a defect

207 of 209 live products have inventory tracking **off**, so they are always
purchasable. Two do not: Four Pillars Rare Dry Gin (12 units, tracked) and one
other. When those 12 sell, that product goes out of stock while everything
around it never does.

Either is a valid way to run the store. Having both at once is not.

---

## What is waiting for you

1. **Six price figures** — the two Maybe Sammy 500ml bottles first, then
   Bellarine, Brookie's G&T, Maker's Mark 1L, Four Pillars Yuzu.
2. **Send the ALM email** (`correspondence/alm-product-export-request-2026-09-24.md`).
   It closes the 66 missing costs, the 19 missing barcodes and much of the wine
   pricing in one file.
3. **114 fine-wine drafts at $0.00** — still the largest single lever. It is why
   `/collections/fine-wine` holds 139 products and shows none.
4. **Six barcode decisions** in `worksheets/barcode-cross-check-2026-09-24.csv`.
5. **Confirm the storefront password state** — it changes the urgency of
   everything in the sitemap audit.
