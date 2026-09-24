# Spirithaus — product image sweep, 24 September 2026

Triggered by finding that Lark Classic Cask, a $199 bottle, carries a
photograph of a Nikka. All **190 active products** swept.

## What this sweep can and cannot prove

Two methods are available. Only one of them worked here.

**Filename against title** catches the case where an image was saved under the
right name and attached to the wrong product, or vice versa. It found
everything below.

**Looking at the picture** is the only way to catch a wrongly-named file, and
it is exactly the check that was skipped when the Lark defect was created —
and skipped again twice today, once on the Local Liquor specials and once
earlier in this sweep. **It could not be run.** The Shopify CDN is blocked by
this session's egress proxy (`CONNECT tunnel failed, 403`), and none of the
suspect files exist in the local `product-images/` folders.

So: the confirmed list below is confirmed. The suspect list is *suspect*, and
needs someone to open the admin and look. Saying otherwise would repeat the
mistake this sweep exists to find.

## 🔴 Confirmed wrong product

| Product | Price | Image file |
|---|---|---|
| **Lark Classic Cask Single Malt Whisky** | $199.00 | `NIkka-Whisky-from-the-Barrel-500ml_2c68….webp` |

Nikka From The Barrel is a Japanese blend in a squat rectangular bottle. Lark
Classic Cask is a Tasmanian single malt. They look nothing alike.

Two things compound it. `nikka-from-the-barrel` separately uses a *different*
file (`nikka-from-the-barrel.png`), so this is not a shared image — a Nikka
photo was attached to Lark specifically. And the alt text written this morning
reads "Lark Classic Cask Single Malt Whisky, 500mL", so the page now describes,
in machine-readable text, a bottle that is not in the picture. Fixing the alt
would make it worse; the image is what is wrong.

No Lark image exists locally, so this cannot be fixed from here.

## 🔴 Ten products are using screenshots

Every one captured on **12 September between 5:44pm and 6:36pm** — a single
sitting.

| Product | File |
|---|---|
| Jacob's Creek Sauvignon Blanc | `Screenshot2026-09-12at6.36.23pm.png` |
| Tempus Two Varietal Pinot Grigio | `…6.35.36pm.png` |
| De Bortoli King Valley Prosecco | `…6.31.11pm.png` |
| Jacob's Creek Sparkling Chardonnay Pinot Noir | `…6.24.09pm.png` |
| Yellowglen Yellow NV | `…6.08.37pm.png` |
| Chandon Brut NV | `…6.06.24pm.png` |
| Tempus Two Varietal Prosecco | `…6.02.16pm.png` |
| Wolf Blass Red Label Chardonnay Pinot Noir | `…6.01.03pm.png` |
| King Valley Brown Brothers Prosecco NV | `…5.51.45pm.png` |
| Squealing Pig Rose | `…5.44.22pm.png` |

A screenshot is not a product photograph. It carries whatever was behind the
bottle on whatever page it was taken from, it is the wrong aspect and
resolution, and if it was captured from another retailer's site then it is
their photograph. These need replacing with supplier imagery, which the
distributors supply free.

**This one propagated into today's work.** The Chandon screenshot was used as
the `sparkling` collection hero a few hours ago, before the sweep ran. It has
been swapped for the Moët supplier shot.

## ⚠️ Not product photographs

| Product | File | What it appears to be |
|---|---|---|
| Maybe Sammy Italian Dirty Martini | `MAYBESAMMYCOCKTAILSCHRISTMASSOCIALMEDIAPOSTS_….webp` | A Christmas social-media post, not a bottle |
| Bellarine Tarty Ted | `tarty-ted-cocktail-on-barrel-photographed-by-sarah-anderson.webp` | A lifestyle shot. The filename credits a photographer, which raises a licensing question worth answering before it stays on a commercial page |
| Curatif Negroni | `images.jpg` | The default filename a browser gives a saved image. Provenance unknown |
| Four Pillars Rare Dry Gin | `IMG_0871.png` | A phone camera filename |

`IMG_0871.png` matters beyond its own page: it was used this morning as the
hero for both the **Spirits** and **Australian Made** collections, the two
largest on the site. If it is a phone snapshot, those two heroes are a phone
snapshot.

## ⚠️ One to check by eye

| Product | File |
|---|---|
| Royal Salute 21 Year Old | `chivas_btl.webp` |

Royal Salute is made by Chivas Brothers, so a file named `chivas_btl` may be
correct house naming — or it may be a bottle of Chivas Regal on a $239 product.
Cannot be told apart without looking.

## What the rest of the catalogue looks like

The majority are fine. Two clean patterns dominate:

- **handle-matched files** — `the-botanist-islay-dry-gin.webp`,
  `brookies-byron-dry-gin.webp`, `karu-affinity-gin.png`. These verify by name.
- **supplier stock numbers** — `904212-1.webp`, `73016-1.webp`. Opaque, but
  consistent, and they come from distributor feeds, which is the right source.

No two active products share a featured image file. That check was run across
all 190 and came back clean, which rules out the most common bulk-import error.

## Recommended order

1. **Lark Classic Cask** — a wrong bottle on a $199 product, live now.
2. **The ten screenshots** — replace with supplier imagery; ask the
   distributor, it is free and it is what the feed is for.
3. **Royal Salute** — thirty seconds in the admin to confirm or rule out.
4. **Four Pillars Rare Dry Gin** — because two collection heroes depend on it.
5. **Bellarine** — settle the photographer credit before anything else.

And the general rule this sweep earns, for the third time in this project:
**checking a filename is not checking an image.** A file can be named anything.
