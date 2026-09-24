# Action plan — spirithaus.com.au sitemap surface

**2026-09-24.** Derived from `findings/sitemap.md`. Partial audit — sitemap and
indexable surface only. See *Coverage* below.

## Phase 1 — before anything is indexed

1. **Confirm whether the storefront is still password-protected.**
   Everything else changes meaning depending on the answer. If it is, these are
   pre-launch fixes and cost nothing. If it is not, `/collections/fine-wine` has
   been crawlable as an empty page for some time. Two minutes in
   Admin → Online Store → Preferences.

2. **Price and publish the 139 wine drafts, or unpublish the collections that
   depend on them.** One or the other — the current state is the worst of both.
   The blocker is the 114 products at $0.00; the worksheet is at
   `seo/spirithaus/worksheets/draft-pricing-2026-09-24.csv`.
   This single action fixes Fine Wine, Red, White, Sparkling, Champagne, Rosé,
   Fortified & Dessert and Wine simultaneously.

3. **Decide what `New This Month` is for.** Its rule is `TAG = "new"` and no
   product is tagged `new`. Either tag recent arrivals, or delete the collection.
   Leaving a permanently empty collection in the sitemap with written SEO copy
   is the one thing not to do.

## Phase 2 — once the catalogue is whole

4. **Write meta descriptions for the top ~40 products by intended traffic.**
   All 209 live products currently have none. Start with the bottles that carry
   real search demand — Yamazaki 12, Hibiki, Lagavulin 16, Four Pillars, Archie
   Rose, Monkey 47 — and write for `buy <brand> <expression> australia`, since
   the profile establishes brand queries are lost to spirithouse.com.au and
   product queries are not.

5. **Resolve the duplicate Hibiki listing.** `hibiki-japanese-harmony` is
   ARCHIVED and holds the cleaner handle; `hibiki-japanese-harmony-700ml` is
   ACTIVE and holds the traffic. Delete the archived one and take its handle.

6. **Re-check `/collections/frontpage`** against the live sitemap once fetchable.

## Phase 3 — the rest of the audit

7. Run the remaining categories from a local terminal, where egress works:
   technical, content, schema, performance, visual, GEO, SXO, e-commerce.
   None of them could run in this session.

## Coverage

**Ran:** sitemap / indexable surface, from the Shopify Admin API.

**Did not run** — this session's proxy blocks all outbound page fetches
(`CONNECT tunnel failed, response 403`), which rules out every category that
needs to load a URL: `seo-technical`, `seo-content`, `seo-schema`,
`seo-performance`, `seo-visual`, `seo-geo`, `seo-sxo`, `seo-ecommerce`,
`seo-cluster`, `seo-backlinks`, `seo-google`, `seo-drift`.

**No health score is given.** Scoring 100 points across seven weighted
categories when six of them could not be measured would be a number with
nothing behind it.
