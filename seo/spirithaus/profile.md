# Spirithaus — SEO profile

> Status: **partially confirmed.** Platform verified from the theme repository.
> Fields marked `TODO` still need filling.

## Identity

| Field | Value |
|---|---|
| Website | `spirithaus.com.au` — **`www` is the primary host**, canonicals carry the www prefix |
| Platform | **Shopify** — Dawn theme v16.0.0 (verified) |
| Theme repo | `singhajay001/spirithaus-theme` @ `7ae5c95` |
| Catalogue size | 1 product imported so far; barcode column exists in the import CSV |
| Store status | **password-protected, theme is a draft** — external validators cannot crawl it |
| Ships to | TODO — AU-wide? VIC only? click-and-collect? |
| Physical presence | TODO — if yes, this also needs a local profile |

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
