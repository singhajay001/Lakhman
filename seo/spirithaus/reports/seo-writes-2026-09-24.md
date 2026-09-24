# Spirithaus — on-page SEO written to Shopify

**2026-09-24.** What changed in the store, and what still blocks sales.

## Done: SEO titles and meta descriptions on all 209 live products

Before this pass, **every live product had `seo.title` and `seo.description`
unset.** Shopify was falling back to the product title plus the shop name, and
truncating the body copy for the snippet.

All 209 now carry a hand-written title and description. Verified by re-reading
the first 100 alphabetically and the 8 most recent — no nulls remain.

| Category | Products |
|---|---|
| Whisky (Scotch, Irish, Japanese, Indian, Australian) | 35 |
| Gin | 29 |
| Tequila | 16 |
| Rum | 16 |
| Vodka | 16 |
| Bourbon & Tennessee | 15 |
| Ready to drink / bottled cocktails | 26 |
| Wine, sparkling, Champagne, rosé, fortified | 53 |
| Liqueur | 2 |
| Bar snacks | 1 |
| **Total** | **209** |

### How they were written

Titles target the pattern the profile identifies as the viable channel:
`buy <brand> <expression> australia` and bottle-specific long tail. Brand queries
are conceded to `spirithouse.com.au`, the Sunshine Coast restaurant that owns the
homophone, so nothing was written to chase the bare brand name.

Every title carries brand + expression + size, kept under 60 characters.
Descriptions run 120–160 characters and use the real values already in the
product metafields — ABV, region, style — so no two read alike. Where a metafield
was missing, the fact was left out rather than invented.

## Done: three catalogue defects fixed in passing

1. **ALL-CAPS title.** `BELLARINE DISTILLERY TARTY TED - SPARKLING COCKTAIL
   250ML` → `Bellarine Distillery Tarty Ted Sparkling Cocktail 250ml`.
2. **Two pairs of products with byte-identical titles.** Maybe Sammy Jasmine
   Negroni and Maybe Sammy Old Fashioned each existed twice — 100 mL and 500 mL —
   under the same title, competing with themselves for the same query. The 500 mL
   of each is now titled with its size.
3. **`New This Month` matched nothing.** The smart-collection rule is
   `TAG = "new"` and no product in the store carried that tag, so a collection
   with a written meta description sat in the sitemap with zero products. The
   bourbon range added on 11 September — 14 products, a genuine new category —
   is now tagged. The collection fills itself from here.

## CORRECTED — the "seven mispriced products" finding was wrong

An earlier version of this report listed seven live products as unsellable at
their price, and two size/price relationships as inverted. **All of it was
wrong.** Those products have variants — Single Can / Pack of 4 / Carton of 24,
or 100ml / 500ml — and the figures I read were correctly priced cartons. I had
queried `variants(first: 1)` and Shopify returned the carton.

Three variants were changed before the error was caught and have been restored
to their exact original values. See `overnight-2026-09-24.md` section 1.

Twelve SEO titles written in this pass named a size the product does not
uniquely have (Absolut Vodka, and 11 Maybe Sammy cocktails). All twelve have
been rewritten to name both sizes. The two product titles renamed to "… 500ml"
are reverted.

The margin audit has been redone across all 55 variants of the 24 multi-variant
products: zero fall below the 20% floor.

## Still open

- **114 fine-wine drafts at $0.00**, and with them `/collections/fine-wine`,
  which holds 139 products of which 0 are live. See
  `reports/barcode-cross-reference-2026-09-24.md` and
  `reports/spirithaus.com.au-audit/`.
- **Duplicate Hibiki.** `hibiki-japanese-harmony` is ARCHIVED and holds the clean
  handle; `hibiki-japanese-harmony-700ml` is ACTIVE and carries the barcode,
  price and now the SEO copy. Deleting the archived one frees the better URL.
- **`Nobby's Salted Peanuts 170g`** is live on a spirits and wine store, typed
  `snack`. Written up as a bar snack add-on, which is the only reading that makes
  sense — confirm that is intended.
- **Product schema** lives in the theme repo (`singhajay001/spirithaus-theme`)
  and is tracked separately by the owner's instruction.
- Everything requiring a live page fetch is still blocked in remote sessions.
