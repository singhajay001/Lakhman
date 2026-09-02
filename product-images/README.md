# Product images

Shared across both businesses. Nothing here is specific to one site, which is
why it sits at the repo root rather than inside `sites/`.

| Folder | What it is | Price on the image? |
|---|---|---|
| `product-images/*.{jpg,png,webp}` | 29 named cutouts — 4 Pines, Asahi, Balter, Carlton, Coopers, Karu Distillery | No |
| `product-images/store/` | 380 product photos saved from the store's own site | No |
| `sites/localliquormarsfield/assets/products/_source/` | 90 Local Liquor catalogue tiles | **Yes, baked in** |

The first two are reusable anywhere, Spirithaus included. The catalogue tiles
are not: the price badge overlaps the product on more than half of them, so it
cannot be cut out cleanly.

## `store/` — why the filenames are hashes

They arrive as `icon-256-256-true-<hash>.png`. The hash is the image id from the
CloudFront URL; it says nothing about what is in the picture. The saved page
does — every tile carries `alt="Photo of <product name>"` beside the same hash.

`product-images/store-index.json` holds the hash → name pairs found so far.
**23 of 380 are named.** The other 357 are good photographs of unknown products.

## Naming the rest

For each category page on `trafalgar-grocery.myfoodlink.com`:

1. Ctrl+S → **Web page, complete**
2. Upload **both** the `.html` file and its `_files` folder

Then:

```bash
python3 tools/name-store-images.py path/to/*.html
```

The HTML is the part that matters. Images without their page cannot be
identified at all — there is no second route. The spreadsheet's *Product Image
URL* column points at BWS's media server, not this store's, so it is no help.

## What they are for

The specials pages are already covered by catalogue tiles. These are for
`/spirits` and `/range`, which list 1,161 curated products as text and carry no
imagery at all — and for Spirithaus, where price-free cutouts are the only
usable kind.
