# Spirithaus — overnight work, 2026-09-24

**This report was rewritten after a correction. See section 1.**

---

## 1. CORRECTION — I was wrong about the prices, and I broke three variants

### What I got wrong

I queried products with `variants(first: 1)` throughout. **25 of the 209 live
products have multiple variants** — Single Can / Pack of 4 / Carton of 24, or
100ml / 500ml, or 200ml / 700ml / 1 Litre. Shopify returned whichever variant
came first, which for several products was the **carton**.

So a correctly priced Carton of 24 at $236.99 looked to me like a single 130ml
can at $236.99. I reported seven products as "cannot sell at their current
price". **None of them was wrong.** Every one was a carton or multipack, priced
correctly.

The tell was there and I missed it: the costs tracked the prices at the same
1.35 markup as the whole catalogue. A genuine price error would not have had a
matching cost error behind it. I read that as evidence of a systematic
carton-cost import defect. It was evidence that nothing was wrong.

### What I broke, and the repair

I changed three variants before the error was caught:

| Product | Variant | I set it to | Restored to |
|---|---|---|---|
| Naked Life Classic G&T | Carton of 24 | $16.99 / cost $12.60 | **$100.99 / cost $75.60** |
| Naked Life Passionfruit Martini | Carton of 24 | $16.99 / cost $12.60 | **$100.99 / cost $75.60** |
| Curatif Negroni | Carton of 24 | $12.99 / cost $7.39 | **$236.99 / cost $177.36** |

All three are restored to their exact original values and verified by read-back.
For roughly twenty minutes, a carton of 24 Curatif Negroni was purchasable for
$12.99. **Check orders placed in that window.**

### Knock-on: 12 SEO titles named a size the product does not uniquely have

Because I believed each product had one size, I put that size in the title.
Wrong for the 12 multi-variant products where the variants *are* the sizes:

- **Absolut Vodka** was titled "…700ml" but sells in 200ml, 700ml and 1 Litre
- **11 Maybe Sammy cocktails** were titled "…100ml" but each sells in 100ml and 500ml

All 12 rewritten to name both sizes. The other multi-variant products
(Curatif, Naked Life, Bellarine, Brookie's, Four Pillars Yuzu) are fine as
written — their titles carry the *can* size, which is constant across the pack
variants.

Two product titles I had renamed to "… 500ml" are reverted to their originals.

---

## 2. Margin audit, redone correctly — clean

Re-run across **every variant**, not one per product.

| | |
|---|---|
| Multi-variant products | 24 |
| Variants checked on those | 55 |
| Single-variant products with a cost | 143 |
| **Variants below the 20% floor** | **0** |

The pack ladder is also sound. Every Carton of 24 is priced at or below the
equivalent number of singles or 4-packs — no case where buying the carton costs
more than buying the units:

| Product | 4-pack × 6 | Carton of 24 |
|---|---|---|
| Naked Life (all three) | $101.94 | $100.99 |
| Bellarine Tarty Ted | $257.94 | $256.99 |
| Curatif Pina Colada | $239.94 | $236.99 |
| Brookie's Gin & Tonic | $179.94 | $129.99 |
| Four Pillars Yuzu | $185.94 | $139.99 |

**66 of 209 products still carry no cost at all**, so their margin cannot be
checked — Yamazaki, Hibiki, Lagavulin, Royal Salute, Glenfiddich 12 and 18, the
Patrón and 1800 ranges, Jameson ×3, Johnnie Walker ×3. The ALM export closes
most of this.

One small thing, a question rather than a defect: **Curatif Negroni's Single Can
is $9.99 while every other Curatif single is $12.99.** Margin is fine at 26%.
Deliberate, or a leftover?

---

## 3. SEO metadata on the 7 content pages — written

All seven pages had no SEO title and no meta description. The six blog articles
already had good `title_tag` / `description_tag` metafields and were left alone.

| Page | Now targets |
|---|---|
| Delivery areas and times | `sydney alcohol delivery` — commercially the most valuable |
| Photo ID on delivery | `do I need ID for alcohol delivery` |
| Contact | brand + category |
| Responsible service of alcohol | NSW licence obligations |
| Returns and refunds | broken bottle / wrong item |
| Terms of sale | Australian Consumer Law |
| Privacy policy | data handling |

---

## 4. `New This Month` — now populated

Was 0 products: the rule is `TAG = "new"` and nothing carried the tag. The
14-product bourbon range added 11 September is now tagged. Verified at 14.

---

## 5. Aberlour A'bunadh metafield

`volume_ml` set to 700 (confirmed by SKU and the ALM screen). `abv` and
`standard_drinks` deliberately left empty — A'bunadh is cask strength and the
ABV changes every batch.

---

## 6. Still open

1. **Check orders** placed while the three carton prices were wrong.
2. **Duplicate Maybe Sammy products.** `maybe-sammy-jasmine-negroni` and
   `maybe-sammy-jasmine-negroni-500ml` are two separate products with the same
   title and the same 100ml/500ml variants at the same prices. Same for the two
   Old Fashioneds. One of each pair should go — but which is the keeper is your
   call, not mine.
3. **Duplicate Hibiki** — `hibiki-japanese-harmony` is ARCHIVED and holds the
   clean handle; the ACTIVE one carries the barcode and SEO copy.
4. **114 fine-wine drafts at $0.00** — still the largest single lever.
5. **Send the ALM email** — closes the 66 missing costs and 19 missing barcodes.
6. **Six barcode decisions** in `worksheets/barcode-cross-check-2026-09-24.csv`.
7. **Confirm the storefront password state.**

---

## Note for whoever picks this up next

**Never read a Shopify product's price, cost or barcode through
`variants(first: 1)`.** This store uses variants for pack size on 25 products.
Query `variantsCount` first, or fetch all variants and check `variant.title`
before drawing any conclusion about a price.
