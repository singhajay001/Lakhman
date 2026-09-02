# Product schema — apply guide

Adds GTIN, per-variant offers, real `aggregateRating`, producer-based brand, and
the spec metafields to Spirithaus product pages.

Target repo: `singhajay001/spirithaus-theme` @ `7ae5c95` (Shopify Dawn 16.0.0).
Files here are staged copies — this session has read-only access to that repo.

## What changes

| File | Change |
|---|---|
| `snippets/product-structured-data.liquid` | **new** — the JSON-LD block |
| `sections/main-product.liquid:855` | replace the `structured_data` script with a `render` call |
| `sections/featured-product.liquid:501` | same replacement |

Apply with `git apply product-schema.patch` after copying the snippet in, or make
the two one-line edits by hand.

## Why it replaces rather than adds

`{{ product | structured_data }}` is opaque — you cannot add properties to a
filter's output. Adding a second block would put **two competing Product blocks
on the same page**, and Google may pick the thinner one. So the filter is
replaced, not supplemented.

Verified after the change: no `product | structured_data` calls remain anywhere
in the theme. `main-article.liquid:292` still uses `article | structured_data`
for Article schema — correct, and untouched.

## The www question — nothing is hardcoded

The snippet uses `canonical_url` for the product URL and `request.origin` for
offer URLs. Both follow Shopify's primary-domain setting, so:

- today they render `https://www.spirithaus.com.au/...`, matching your canonical
- if you later switch the primary domain to the apex, the schema follows with no
  edit here

So schema is **not** a blocker on the www decision. What does matter: make sure
the non-primary host 301s to the primary, and register a **Domain property** in
Search Console (not a URL-prefix property) so both hosts report together.

## GTIN behaviour

Reads `variant.barcode`. Strips spaces and hyphens, then requires digits only and
a valid GTIN length, emitting the correctly-typed property:

| Barcode | Emitted |
|---|---|
| `9345678901234` | `"gtin13"` |
| `012345678905` | `"gtin12"` |
| `12345670` | `"gtin8"` |
| `12345678901234` | `"gtin14"` |
| `934 5678-901234` | `"gtin13"` (normalised) |
| empty, `ABC123`, `12345` | **property omitted entirely** |

This is deliberately stricter than "emit gtin13 when a barcode exists". Spirits
carry both EAN-13 and UPC-12; hardcoding `gtin13` on a 12-digit barcode would be
invalid structured data. An absent GTIN costs you a match signal — a wrong one
risks a Merchant Center rejection.

**So it is safe to ship with one product populated.** Products without a barcode
emit no GTIN property and stay valid. Backfill the barcode column in the import
CSV over time; each product starts working the moment its barcode lands.

## aggregateRating is real, not invented

Emitted only when `product.metafields.reviews.rating.value` is present **and**
`reviews.rating_count > 0`. Products with no reviews emit nothing. Never fabricate
ratings — it is a manual-action risk, not just a quality issue.

## Testing without a public URL

The store is password-protected and the theme is a draft, so Rich Results Test
and Schema Markup Validator cannot crawl it. Test against rendered HTML instead:

```bash
shopify theme dev --store spirithaus.com.au
# open a product page, View Source, copy the application/ld+json block
```

Then either:

- paste into <https://validator.schema.org/> (**Code snippet** tab — accepts
  pasted markup, no URL needed), or
- paste into Rich Results Test's **Code** tab, or
- save it and check locally: `python3 -m json.tool < block.json`

Verify on a product page that **exactly one** `application/ld+json` Product block
is present. The page will also carry an `Organization` block from
`header.liquid` — that is expected and does not conflict.

## Pre-flight validation already done

Rendered output was hand-simulated for two boundary cases and parsed as JSON:

- **minimal** — no barcode, no rating, no specs, no description, no images,
  single variant → valid, 6 top-level keys
- **full** — GTIN, rating, three spec properties, two variants → valid,
  13 top-level keys

The GTIN validator was tested against all nine cases in the table above; all pass.
This proves comma placement (the classic Liquid JSON-LD bug) on both the
everything-present and everything-absent paths.

## Not included, deliberately

- `hasMerchantReturnPolicy` and `shippingDetails` — these need your real returns
  and shipping terms. Inventing them would be false structured data. Supply the
  policy and they can be added.
- `priceValidUntil` — only meaningful with a real promotion end date.

## Observation, not changed

`sections/main-product.liquid:847-852` assigns a `seo_media` variable that is
never used — it was presumably intended for the schema image. The snippet uses
`product.images` (up to 5) instead. Worth deleting or wiring up; left alone to
keep this change minimal.
