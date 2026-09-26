# Spirithaus — SEO profile

> Status: **partially confirmed.** Platform verified from the theme repository.
> Fields marked `TODO` still need filling.

## Identity

| Field | Value |
|---|---|
| Website | `spirithaus.com.au` — **`www` is the primary host**, canonicals carry the www prefix |
| Platform | **Shopify** — Dawn theme v16.0.0 (verified) |
| Theme repo | `singhajay001/spirithaus-theme` @ `7ae5c95` |
| Catalogue size | 350 products: 209 live, 141 draft. 25 products use variants for pack size. |
| Store status | **LIVE — password removed 2026-09-18** (owner-confirmed; an earlier note said 24 Sept and was wrong). Theme `spirithaus-theme/main` is published (role MAIN), deployed via Shopify's GitHub integration on `main`. |
| Indexation | **Zero pages indexed as of 2026-09-26.** GSC confirmed the homepage as *"URL is unknown to Google"* — never crawled, not rejected. Cause was discovery: no backlinks, no submitted sitemap. **Fixed 2026-09-26** — domain property verified, `sitemap.xml` submitted (Success, sitemap index), homepage + 5 collections placed in the priority crawl queue. Every technical blocker was ruled out first. See `reports/not-indexed-2026-09-25.md`. |
| Ships to | **Sydney metro only** (owner-confirmed 2026-09-26). Not AU-wide. Photo ID on delivery, strictly 18+. |
| Liquor licence | **NSW Packaged Liquor Licence LIQP700301260.** Rendered by the `spirithaus-compliance` section as a schema setting, with the statutory warning and photo-ID notice in the footer of every page — verified in the theme, not hardcoded. |
| Physical presence | TODO — the business presents as delivery-led. Confirm before building any local/GBP strategy. |

### ⚠️ Theme settings: edit in Shopify, never in git

`config/settings_data.json` in `singhajay001/spirithaus-theme` **runs behind the live
store.** Shopify's GitHub integration syncs `main` bidirectionally, but theme-editor
changes commit back with a delay.

Observed 2026-09-26: the YouTube social link was corrected in the theme editor and,
minutes later, the repo still held the old broken value. Committing an edit to
`settings_data.json` at that moment would have deployed the stale file and silently
reverted the fix.

**Rule: change theme *settings* in the Shopify theme editor. Change theme *code* in
git.** Before ever editing `settings_data.json` in a commit, pull `main` and confirm
it already reflects every recent editor change.

### Social profiles — the `sameAs` entity signal

`sameAs` is emitted from `settings.social_*_link` by `sections/header.liquid`, and it
is doing the real work of separating this domain from `spirithouse.com.au`.

| Profile | Value | Note |
|---|---|---|
| Facebook | `https://www.facebook.com/spirithausau` | Vanity handle created 2026-09-26, replacing a numeric ID (`1345008665356257`) that did not match the live page (`profile.php?id=61594122853424`) |
| Instagram | `https://www.instagram.com/spirithaus.com.au` | |
| YouTube | `https://www.youtube.com/@SpiritHausAU` | Was missing `https://`, so it rendered as a non-URL string and was discarded by Google |

Each must be an **absolute URL**. A protocol-less value passes Shopify's field
validation, renders into the JSON-LD as a bare string, and is silently dropped —
costing an entity signal with no visible error anywhere.

## 🔴 Name collision — never assume a "spirithaus" result is you

`spirithaus.com.au` and **`spirithouse.com.au`** are homophones. Spirit House is
a long-established Sunshine Coast restaurant with a blog, an online shop and
years of accumulated authority. Searching `spirithaus` returns *them*.

Consequences, recorded so they are not rediscovered:

- **Brand queries are not a viable channel.** Contested by an older entity with a
  near-identical name.
- **Product queries are.** `buy <brand> <expression> australia` and
  bottle-specific long tail are uncontested by a restaurant.
- **Entity markup matters more than usual.** `Organization`, `sameAs` and
  consistent naming are doing real disambiguation work here.
- When checking rankings, confirm the domain. A result for "spirit house" is a
  different business, the same way IGA Trafalgar VIC is not Trafalgar Marsfield.

Verified 2026-09-10: `site:spirithaus.com.au` returns zero results; the engine
substitutes spirithouse.com.au.

### Sydney metro delivery changes the answer to the collision

Confirmed 2026-09-26: delivery is **Sydney metro only**. That is a materially
different SEO position from national e-commerce and it opens a route the brand
query does not.

- **Geo-qualified product terms become winnable.** `spirits delivery sydney`,
  `whisky delivery sydney`, `same day alcohol delivery sydney` are contested by
  other Sydney retailers, not by every national spirits site — a far softer field
  than `buy <brand> australia`, and far softer than the `spirithouse` homophone.
- **Spirit House is in Yandina, Queensland.** Any Sydney qualifier separates the
  two entities immediately. The collision costs nothing on a geo term.
- The delivery radius is a genuine differentiator to state on-page, not a
  limitation to hide. "Delivered across Sydney metro" is the kind of concrete,
  checkable fact that both classical ranking and AI answers reward.
- **Do not** chase national head terms. The catalogue cannot outrank Dan Murphy's
  or BWS on `buy whisky online australia`, and the delivery footprint means a
  national visitor cannot buy anyway — the traffic would not convert.

## What winning looks like

This is **e-commerce**. Revenue comes from people searching for a product,
anywhere in the shipping radius. The queries that matter are commercial:

- `buy <brand> <spirit> online australia`
- `<brand> <expression> price`
- `best <category> under $X`
- Long-tail bottle-specific searches — the highest-converting and least contested

The battleground is **product and collection pages**, not blog posts.

## Status: product schema RESOLVED

Fixed. See `schema/APPLY.md` and `schema/product-schema.patch`. Summary below
kept for the record.

## Original finding — product schema was thin

`sections/main-product.liquid:855` emits structured data via Shopify's built-in
filter:

```liquid
<script type="application/ld+json">
  {{ product | structured_data }}
</script>
```

This produces `name`, `description`, `image`, and `offers` (price, availability,
url), plus `brand` when the product has a vendor set. It does **not** emit:

- `gtin` / `gtin13` — spirits carry real barcodes; GTIN is one of the strongest
  product-matching signals Google has. Its absence is the largest single
  structured-data gap on the store.
- `aggregateRating` / `review` — no review stars in results
- `hasMerchantReturnPolicy` / `shippingDetails` — increasingly expected on
  product rich results

Fixing this is a theme edit in `spirithaus-theme`, not a Shopify limitation.
Treat it as the first concrete task.

## Priority order

1. ~~**Product schema enrichment**~~ — done. Remaining: supply real returns and
   shipping terms so `hasMerchantReturnPolicy` / `shippingDetails` can be added
   without inventing data.
2. **Collection page architecture** — by category, brand, region, price band.
   These are the pages that rank for head terms; most Shopify stores leave them
   as bare product grids with no copy.
3. **Product page content depth** — tasting notes, distillery, ABV, region, serve
   suggestions. Thin manufacturer-copy pages lose to every other retailer
   carrying the same bottle, because duplicate descriptions have no differentiator.
4. **Technical hygiene** — Shopify's forced `/collections/*/products/*` duplicate
   URL paths, canonical correctness, faceted-navigation index bloat.
5. **Core Web Vitals** — Dawn 16 is a good starting point; verify with field data.

## Explicitly deprioritised

Map pack, GBP, citations, geo-grid — unless a physical storefront exists.

## Skills to use

`seo-ecommerce` · `seo-schema` · `seo-technical` · `seo-content` (product depth)
· `seo-cluster` (only once products and collections are solid)

## Constraints

- **Alcohol restricts Shopping surfaces.** Google Merchant Center applies
  specific alcohol policies and age-gating requirements, and these vary by
  country. Verify current AU policy before investing in Shopping — the generic
  e-commerce playbook does not transfer cleanly.
- **Duplicate bottle descriptions.** Every retailer selling the same SKU often
  uses identical distillery copy. Original content is the only differentiator.
