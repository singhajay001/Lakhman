# Image attach round 1 — 2026-09-25

32 files uploaded to Shopify Files. **29 attached across 26 products, all `READY`,
every one with alt text.** Products without an image: **273 → 248**.

Alt text follows the pattern already in the store: `<Title>, 750mL` for the featured
image, `<Title>, image N` for subsequent ones.

## Held back — 3 files not attached

| File | Why |
|---|---|
| `PEN_2022_Grange_ShzCab_SouthAus_750_AUS_WoodenBox_Angle_Cork.png` | It is the **2022** Grange. We settled on **2021** (ALM item 232877) for the barcode. Attaching a 2022 photo to a 2021 listing misrepresents the product. Also 1.44 MB — 3× the size guidance. |
| `Krug_Vintage_2011_750ml.webp` | 896×896 and **32,200 bytes — byte-identical to `krug-vintage-01.webp`**. Same image twice. |
| `penfold_grange.avif` | 400×400, a downscaled duplicate of a Grange shot already attached. |

## Two filename problems

- **`ttaylors-estate-cabernet-sauvignon-01.webp`** — double `t`. Attached to the right
  product, but Shopify keeps the filename in the public image URL, so the typo is live
  and is what Google Images will index. Worth re-uploading.
- **`moet-and-chandon-dom-perignon-01.webp`** — uses the *corrected* name, but the
  product handle is still `mo-t-and-chandon-dom-perignon`. Attached fine, but the two
  no longer agree. Best fixed by correcting the handle, not the file.

## Quality: none of the 32 meet the spec

| Issue | Count |
|---|---|
| Below the 1600px zoom threshold | **32 of 32** |
| Not square | 16 |
| Min edge under 400px — too small to look good | 6 |

The six too-small ones were attached anyway, because these are **live products** and a
small photo converts better than a grey placeholder. They should be replaced:

| Product | Size |
|---|---|
| Rawson's Retreat Shiraz Cabernet | **159 × 600** |
| Tatachilla White Admiral Rosé | **175 × 510** |
| Mud House Marlborough Sauvignon Blanc | **194 × 729** |
| Tatachilla White Admiral Pinot Grigio | **202 × 593** |
| Wyndham Estate BIN 555 Shiraz | 321 × 1280 |
| Wyndham Estate BIN 888 Cabernet Merlot | 321 × 1280 |

At 159px wide, Shopify has nothing to work with — it will upscale and blur in any grid
wider than a phone.

The tall narrow shots (400 × 1538) are bottle cut-outs on a transparent background.
They will letterbox badly in Dawn's square grid. Padding them to square on white is a
quick batch job and worth doing before the next round.

## Multi-image products

- **Penfolds Grange** — 3 images, featured is the 896×896 bottle shot
- **Henschke Hill of Grace** — kept its existing featured image, gained 2 more
