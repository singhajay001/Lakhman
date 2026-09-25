# Step 5, part one — real fonts

Glyph measurement is only correct if the theme's real faces are present. This removes the
dependency entirely: Archivo and Space Mono are now embedded in the page, so the tool
measures correctly offline, in the published artifact, and on any machine, with no font
host involved.

## What was actually wrong

The fonts were never blocked. The earlier failure was `ERR_CERT_AUTHORITY_INVALID` — the
browser did not trust the proxy's certificate authority — which is a trust problem, not a
network policy. Fetched with the proxy CA, `fonts.googleapis.com` answers 200.

That is a different failure from `cdn.shopify.com`, which returns a 403 at the CONNECT
stage and is genuinely blocked by policy. Conflating the two cost a step.

## What is embedded

| File | Family | Weights | Size |
| --- | --- | --- | --- |
| `fonts/archivo-latin.woff2` | Archivo | variable, 100–900 | 35 KB |
| `fonts/spacemono-latin.woff2` | Space Mono | 400 | 16 KB |

Archivo ships as a variable font, so one file answers the 300 the theme uses for headings,
the 400 for body and the 900 for emphasis. Latin subsets only — the copy is English — which
keeps the embedded page at about 147 KB in total.

Both are SIL Open Font License 1.1, which permits embedding and redistribution provided the
licence travels with the font. Both licence texts are committed alongside.

`tools/embed-fonts.mjs` reads the family names out of the embedded theme profile, so it
fails loudly if the theme changes typeface rather than quietly measuring with whatever is
to hand.

## Validation: does font substitution actually change the numbers?

The Step 3 report warned that its magnitudes were not final because that run substituted
fonts. That warning can now be tested directly — the same three samples, the same two
treatments, the same glyph mode, substituted versus real.

| | |
| --- | --- |
| Cells compared | 30 |
| Readings that moved at all | 11 |
| Readings that moved more than one level | 1 |
| **Verdict flips** | **0** |

The single outlier is `sample-lit-bottom`, tile, at 1.64:1: 71 → 54 levels, which stays a
break at both ends.

So the caution was heavier than these samples required. The Step 3 conclusions — that glyph
measurement is stricter where type reaches over a bright area and more permissive where the
band charged for brightness no glyph sits on — hold unchanged with real faces.

Two things stop that being a general result. The substitute here was a close-metric
fallback; a face with very different advance widths would wrap differently and move more.
And these are three synthetic frames with one line of headline copy. The claim that stands
is narrow and worth stating precisely: **for this sample set, font substitution changed no
verdict.**

Note the per-ratio rows are the comparable quantity across the two runs. The overall chip is
not: focal retention became a blocking input to it in Step 4, which the earlier run predates.

## What is still missing for calibration

The real hero set. `cdn.shopify.com` is blocked by this environment's network policy, so the
eleven live images cannot be fetched here. Until they can, thresholds stay uncalibrated —
three synthetic frames built to exercise a band are not a distribution.
