#!/usr/bin/env python3
"""Give the store's product images their names back.

    python3 tools/name-store-images.py <saved-page.html> [more.html ...]

Images saved from trafalgar-grocery.myfoodlink.com arrive named after a
content hash - icon-256-256-true-<hash>.png - which says nothing about what is
in them. The saved page that came with them does: every tile carries
`alt="Photo of <product name>"` beside the same hash, because the hash is the
image id in the CloudFront URL.

So: save a category page (Ctrl+S, "Web page, complete"), upload BOTH the .html
and the _files folder, and this pairs them up. Images stay in
product-images/store/ under their hash - that is the stable id - and the names
are recorded in product-images/store-index.json, which is what everything else
reads.

Without the matching HTML an image cannot be identified at all. There is no
second route: the spreadsheet's Product Image URL column points at BWS's media
server, not at this store's.
"""
import html as htmlmod
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
STORE = ROOT / "product-images" / "store"
INDEX = ROOT / "product-images" / "store-index.json"

TILE = re.compile(
    r'<img alt="Photo of ([^"]*)"[^>]*src="[^"]*?(icon-256-256-true-[0-9a-f]+\.png)"')
# The product's own page URL is a better slug than the alt text, when present.
LINK = re.compile(r'href="https://[^"]*?/lines/([a-z0-9-]+)"')


def main(paths):
    if not paths:
        sys.exit(__doc__)
    index = json.loads(INDEX.read_text()) if INDEX.exists() else {}
    before = len(index)
    seen_files = 0
    for p in paths:
        t = pathlib.Path(p).read_text(encoding="utf-8", errors="replace")
        seen_files += 1
        for alt, fn in TILE.findall(t):
            index.setdefault(fn, htmlmod.unescape(alt).strip())
    INDEX.write_text(json.dumps(dict(sorted(index.items())), indent=1) + "\n")

    have = {f.name for f in STORE.glob("icon-256-*.png")}
    named = have & set(index)
    print("%d page(s) read, %d new names (%d total in the index)"
          % (seen_files, len(index) - before, len(index)))
    print("%d images in product-images/store/" % len(have))
    print("  %d named, %d still unidentified" % (len(named), len(have - named)))
    orphans = set(index) - have
    if orphans:
        print("  %d names have no image file - upload that page's _files folder"
              % len(orphans))


if __name__ == "__main__":
    main(sys.argv[1:])
