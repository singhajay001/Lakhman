#!/usr/bin/env python3
"""Turn the Local Liquor catalogue tiles into card images.

    python3 build/crop-tiles.py

Source tiles are 600x600 transparent PNGs from the banner's P37 asset pack,
in assets/products/_source/. Each carries the product, the price badge, a
pack-size roundel, and the product name set as artwork across the bottom.

At card width (~230px) that baked-in caption is about five pixels tall, so it
is cropped off and the card's own text carries the name. The price badge is
kept: it is legible at card size and it is the same visual role the gold tag
plays elsewhere, so build/specials.py drops its own tag, pack badge and flag
for any product that has a photo. Removing the badge instead was tried and
abandoned - on more than half the tiles it overlaps the product and leaves a
bite out of the carton.

Pairings come from build/product-images.json and are written by hand. A fuzzy
match put Glenfiddich's bottle against The Glenlivet's price, which on a page
carrying prices is worse than having no photograph at all.
"""
import json, pathlib, sys

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = pathlib.Path(__file__).resolve().parent
SITE = HERE.parent
SRC = SITE / "assets" / "products" / "_source"
OUT = SITE / "assets" / "products"

CAPTION_TOP = 478       # rows below this are the artwork caption
LONG_EDGE = 520         # plenty for a 230px card on a 2x screen
QUALITY = 80


def cut(path):
    a = np.asarray(Image.open(path).convert("RGBA")).copy()
    a[CAPTION_TOP:, :] = [0, 0, 0, 0]
    keep = a[..., 3] > 25
    lbl, n = ndimage.label(keep, np.ones((3, 3)))
    if n:
        sizes = ndimage.sum(keep, lbl, range(1, n + 1))
        keep = np.isin(lbl, [i + 1 for i, s in enumerate(sizes) if s > 60])
        a[~keep] = [0, 0, 0, 0]
    ys, xs = np.where(keep)
    im = Image.fromarray(a).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    im.thumbnail((LONG_EDGE, LONG_EDGE), Image.LANCZOS)
    return im


def main():
    m = json.loads((HERE / "product-images.json").read_text())
    missing = [f for f in m["map"].values() if not (SRC / f).exists()]
    if missing:
        sys.exit("crop-tiles.py: source files missing: " + ", ".join(missing))
    total = 0
    for slug, f in sorted(m["map"].items()):
        im = cut(SRC / f)
        dest = OUT / (slug + ".webp")
        im.save(dest, "WEBP", quality=QUALITY, method=6)
        total += dest.stat().st_size
    print("%d card images, %.0f KB total, %.1f KB average"
          % (len(m["map"]), total / 1024, total / 1024 / len(m["map"])))
    print("%d products have no artwork in this pack and keep their silhouette"
          % len(m["no_artwork_in_pack"]))


if __name__ == "__main__":
    main()
