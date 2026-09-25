# Theme faces, vendored

Scrim Proof measures glyph boxes, so every reading depends on the theme's real faces
being present. Loading them from a font host made the tool wrong whenever it was offline
or behind a blocked CDN — and, worse, wrong *quietly*, until the page learned to detect
substitution.

These are the same two families the storefront loads, embedded into the page at build
time so the tool measures correctly everywhere, with no network at all.

| File | Family | Notes |
| --- | --- | --- |
| `archivo-latin.woff2` | Archivo | Variable, weights 100–900. The theme uses 300 for headings, 400 for body and 900 for emphasis. |
| `spacemono-latin.woff2` | Space Mono | 400. Kickers, captions and labels. |

Latin subsets, taken from Google Fonts — the same files the storefront serves. The copy on
these pages is English, so the latin subset is sufficient and keeps the embedded page small
(about 67 KB of base64 for both).

## Licence

Both families are licensed under the SIL Open Font License 1.1, which permits embedding and
redistribution provided the licence travels with the font. The full texts are here as
`Archivo-OFL.txt` and `SpaceMono-OFL.txt`; do not remove them.

- Archivo — Copyright The Archivo Project Authors, https://github.com/Omnibus-Type/Archivo
- Space Mono — Copyright The Space Mono Project Authors

## Refreshing them

```sh
# the CSS names the current file for each family
curl -A "Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0" \
  "https://fonts.googleapis.com/css2?family=Archivo:wght@300;400;900&family=Space+Mono:wght@400"
# then fetch the woff2 URLs from the latin blocks (unicode-range covering U+0000-00FF)
node ../tools/embed-fonts.mjs --fonts . --page ../scrim-proof.html
```

If the theme changes typeface, the profile's `tokens.fontDisplay` / `tokens.fontMono` change
with it, and these files must be replaced to match. The page compares the two and warns when
a family named by the profile is not actually present.
