# Product image naming convention

## The rule

```
<shopify-handle>-<nn>.<ext>
```

| | |
|---|---|
| Front of bottle, straight on | `penfolds-grange-01.jpg` |
| Back label | `penfolds-grange-02.jpg` |
| Gift box / tube / carton | `penfolds-grange-03.jpg` |
| Anything further | `-04`, `-05`, … |

**`-01` becomes the featured image** — the one that shows in collection grids, search
results and social shares. Always make it the clean front-on bottle shot.

## Why the handle and not the product title

The handle is already lowercase, hyphenated and ASCII-safe. Product titles are not:
`Moët & Chandon`, `Château d'Esclans`, `Dow's`, `S.C. Pannell`. Accents, apostrophes
and ampersands break filenames, break URLs, and get silently rewritten on upload.

It also matters for search: **Shopify keeps your filename in the public image URL**, so
the filename is a live Google Images ranking signal. `penfolds-grange-01.jpg` is worth
having; `IMG_4471.JPG` is worth nothing.

## Format rules

- lowercase only
- hyphens, never spaces or underscores
- no apostrophes, accents, ampersands, commas or brackets
- **always two digits** — `-01`, not `-1`, so files sort correctly past nine
- `.jpg` for photographs. Shopify converts to WebP when serving, so no need to
  pre-convert

## Image specs

| | |
|---|---|
| Aspect | **square 1:1** — Dawn's grid expects it; anything else letterboxes |
| Size | **2048 × 2048 px** (Shopify's zoom needs ≥1600px on the long edge) |
| Weight | **under 500 KB** after export |
| Background | white or transparent for `-01` |

The weight limit is not housekeeping. The product image is almost always the
**Largest Contentful Paint** element on a product page, so its file size directly sets
a Core Web Vitals score that Google uses for ranking. Shopify's hard limit is 20 MB —
far too big to ship.

## Handles that need fixing first

Accent-stripping has already damaged several handles. These are live URLs, so they
are worth correcting **before** images are attached and named after them:

| Current handle | Should be |
|---|---|
| `mo-t-and-chandon-dom-perignon` | `moet-chandon-dom-perignon` |
| `s-c-pannell-smart-vineyard-grenache` | `sc-pannell-smart-vineyard-grenache` |
| `dow-s-30-year-old-tawny-port` | `dows-30-year-old-tawny-port` |
| `kilikanoon-mort-s-reserve-riesling-2024` | `kilikanoon-morts-reserve-riesling-2024` |

`chateau-d-esclans-*` and `serralunga-d-alba` are acceptable — the `d-` reads as the
elided French/Italian article and is a normal pattern.

Any handle change needs a 301 redirect, which Shopify does **not** create
automatically. That caught us on the Hibiki rename earlier in this project.

## Scope

**273 products have no image. Every one is wine.**

| | |
|---|---|
| Draft | 254 |
| **Live with no image** | **19** |

The 19 live ones are the priority — they are already published and converting at
whatever rate a product page with no photograph converts at.

`seo/spirithaus/worksheets/image-filenames-2026-09-25.csv` lists all 273 with their
exact `-01` / `-02` / `-03` filenames ready to copy.
