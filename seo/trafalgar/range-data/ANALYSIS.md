# Liquor range — data analysis

Source: `liquor-products.xlsx`, supplied 2026-09-02. 4,700 rows, 36 columns.

## Shape

| Category | Products |
|---|---|
| Wine | 2,153 |
| Spirits | 1,493 |
| Beer & Cider | 1,054 |

24 sub-categories, **1,371 distinct brands**. Prices on every row; median **$25**.

| Sub-category | # | | Sub-category | # |
|---|---:|---|---|---:|
| Red Wine | 1,111 | | Cider | 131 |
| White Wine | 667 | | Imported Beer | 123 |
| Premixed Drinks | 605 | | Vodka | 88 |
| Craft Beer | **453** | | Fortified Wine | 85 |
| Champagne & Sparkling | 290 | | Tequila | 74 |
| Australian Beer | 269 | | Other Spirits | 63 |
| Whisky | 256 | | Rum | 59 |
| Gin | 183 | | Brandy · Cognac · Bourbon | 31 |
| Liqueurs | 134 | | Low/Mid/Non-alc beer | 47 |

Australian-made: **2,988**. By state — SA 889, VIC 707, **NSW 238**, WA 110, QLD 69, TAS 69.

Top regions: Barossa Valley 127 · Yarra Valley 85 · McLaren Vale 83 ·
Marlborough 82 (NZ) · Adelaide Hills 78 · Coonawarra 64 · Margaret River 60 ·
Mornington Peninsula 57 · Clare Valley 56 · Hunter Valley 9.

**1,039 products carry an award.** That is a genuine content asset almost no
independent bottle shop bothers to surface.

## 🔴 Three problems before any of this goes on a website

### 1. Every image URL is a competitor's CDN

All **4,700** image URLs point to `edgmedia.bws.com.au` — **BWS**, part of
Endeavour Group / Woolworths.

Do not use these. Hotlinking a competitor's media server is:

- **legally exposed** — their images, their copyright, their terms of use
- **technically fragile** — they can rate-limit, hotlink-block or re-path at any
  time, and every product image on your site breaks at once
- **commercially odd** — your pages would fetch assets branded and served by the
  chain you compete with, and the URLs are visible to anyone who looks

Use your own photographs, or supplier-provided images you are licensed to use.

### 2. The descriptions are probably not yours either

Every row has a `Product description`, and given the BWS image URLs these are
very likely BWS's product copy. Publishing them verbatim would put **4,700 pages
of duplicate content** on a brand-new domain — the worst possible opening
position. Google has seen this text already, on a far stronger site.

If the range pages need copy, it has to be written fresh.

### 3. Confirm this is actual shelf stock

The file is named for **Trafalgar Cellars** — the retired trading name — and the
media comes from BWS. That pattern suggests a supplier or wholesaler catalogue
rather than an export of what is actually on the shelf at Shop 5A.

**This matters more than any SEO consideration.** Publishing a range you do not
carry sends someone driving over for a bottle that was never there. That costs a
customer permanently, and it is exactly the failure the range page is meant to
prevent.

Verify before publishing: is this what is in the shop, or what could be ordered?

## Architecture: category pages, not product pages

The temptation with 4,700 rows is a page per product. **Do not.**

- 4,700 thin pages on a new domain is index bloat, and Google will crawl a
  fraction and value none of it
- with borrowed descriptions it is duplicate content at scale
- a brochure site has no cart, so a product page has nothing to convert to

Build **10–15 category pages** instead. They carry real search demand
("craft beer near me", "barossa shiraz sydney"), stay genuinely useful, and can
be written honestly without per-product copy.

Where the catalogue earns its keep is in the **structure**, not the text: the
counts, the regions, the award tallies. Those are facts about the shop, and they
are what a chain's generic category page cannot say.

## What actually differentiates this shop

Ranked by how hard a chain is to beat on each:

1. **453 craft beers.** Larger than most independents carry and the strongest
   single claim available. Own it.
2. **1,039 award-winning products.** Nobody else surfaces this.
3. **Australian wine depth by region** — Barossa 127, Yarra 85, McLaren Vale 83.
4. **238 NSW wines**, including Hunter Valley — local relevance for a local shop.
5. **Range breadth** — 1,371 brands, $0 to $1,050. Genuinely broad.

## Data quality notes

- `Alcohol %` is stored as a fraction (`0.4` = 40% ABV). Multiply by 100.
- Minimum price is `$0.01` — a data error; clean before display.
- `Tags` appears twice as a column header.
- 235 rows have no `Alcohol %`; 343 have no `Standard Drinks`. Both are
  displayed to customers under the Food Standards Code, so fill them before use.
