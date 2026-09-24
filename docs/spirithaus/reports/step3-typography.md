# Step 3 — typography engine: comparison report

The measured region used to be a band — the bottom half of the crop for heroes, the
bottom third for tiles — which was a guess at where type sits. It now lays the real type
out at the theme's own pixel metrics, reads back where the glyphs land, and measures
there. This report compares the two, so thresholds can be retuned on evidence.


## Read this first

**The run below used substitute fonts.** Archivo and Space Mono could not be fetched in
the environment this was measured in, so the browser substituted, and substituted faces
wrap and sit differently. The readings are internally consistent — every mode saw the
same layout — so the *direction and mechanism* of each change is sound. The *magnitudes*
are not final. Step 5 must re-derive thresholds in a browser with the real faces present;
the page now detects this state and says so in its own UI.


## What changed mechanically

- The region is the union of per-line glyph ink boxes, each dilated by **0.25em**. A
  bright patch in the gap between two lines no longer counts against the frame.
- **Blocks that paint their own background are excluded.** The call-to-action is opaque
  red, so the photograph behind it is never seen and cannot fail. The band charged frames
  for it.
- **The veil anchor is derived, not declared.** It now begins where the topmost line of
  type actually begins, across every viewport, instead of at a policy 0.50 / 0.60.
- **Image survival still reads the band.** It is a property of the photograph rather than
  of the type, and holding it fixed is what lets this comparison isolate the typography
  change to contrast and intrusion.


## Overall verdicts

| Frame | Treatment | Legacy band | Glyph boxes |
| --- | --- | --- | --- |
| sample-clean-bottom | hero | Holds | **Breaks** |
| sample-clean-bottom | tile | Marginal | **Breaks** |
| sample-lit-bottom | hero | Breaks | **Breaks** |
| sample-lit-bottom | tile | Breaks | **Breaks** |
| sample-wide-offcentre | hero | Marginal | **Breaks** |
| sample-wide-offcentre | tile | Holds | **Marginal** |

All six degrade. Every sample now fails somewhere, including one that was clean at every
ratio under the band.


## Per-ratio intrusion, band to glyph


**sample-clean-bottom — hero**

| Ratio | Band | Glyph | Change |
| --- | --- | --- | --- |
| 2.34:1  desktop 1920 | 6 lv | 5 lv | unchanged |
| 2.11:1  laptop 1440 | 6 lv | 11 lv | unchanged |
| 1.75:1  small 1024 | 6 lv | 63 lv | holds → **breaks** |
| 0.99:1  tablet 768 | 6 lv | 8 lv | unchanged |
| 0.75:1  phone 390 | 6 lv | 60 lv | holds → **breaks** |

**sample-clean-bottom — tile**

| Ratio | Band | Glyph | Change |
| --- | --- | --- | --- |
| 1.05:1  desktop 1920 | 1 lv | 1 lv | unchanged |
| 1.05:1  laptop 1440 | 1 lv | 1 lv | unchanged |
| 0.87:1  small 1024 | 1 lv | 1 lv | unchanged |
| 0.62:1  tablet 768 | 1 lv | 47 lv | holds → **breaks** |
| 1.64:1  phone 390 | 1 lv | 1 lv | unchanged |

**sample-lit-bottom — hero**

| Ratio | Band | Glyph | Change |
| --- | --- | --- | --- |
| 2.34:1  desktop 1920 | 67 lv | 26 lv | breaks → **marginal** |
| 2.11:1  laptop 1440 | 76 lv | 18 lv | breaks → **marginal** |
| 1.75:1  small 1024 | 82 lv | 62 lv | unchanged |
| 0.99:1  tablet 768 | 77 lv | 82 lv | unchanged |
| 0.75:1  phone 390 | 80 lv | 80 lv | unchanged |

**sample-lit-bottom — tile**

| Ratio | Band | Glyph | Change |
| --- | --- | --- | --- |
| 1.05:1  desktop 1920 | 66 lv | 70 lv | unchanged |
| 1.05:1  laptop 1440 | 66 lv | 70 lv | unchanged |
| 0.87:1  small 1024 | 67 lv | 69 lv | unchanged |
| 0.62:1  tablet 768 | 69 lv | 64 lv | unchanged |
| 1.64:1  phone 390 | 69 lv | 71 lv | unchanged |

**sample-wide-offcentre — hero**

| Ratio | Band | Glyph | Change |
| --- | --- | --- | --- |
| 2.34:1  desktop 1920 | 18 lv | 8 lv | marginal → **holds** |
| 2.11:1  laptop 1440 | 18 lv | 11 lv | marginal → **holds** |
| 1.75:1  small 1024 | 18 lv | 23 lv | unchanged |
| 0.99:1  tablet 768 | 18 lv | 20 lv | unchanged |
| 0.75:1  phone 390 | 19 lv | 35 lv | marginal → **breaks** |

**sample-wide-offcentre — tile**

| Ratio | Band | Glyph | Change |
| --- | --- | --- | --- |
| 1.05:1  desktop 1920 | 3 lv | 1 lv | unchanged |
| 1.05:1  laptop 1440 | 3 lv | 1 lv | unchanged |
| 0.87:1  small 1024 | 2 lv | 4 lv | unchanged |
| 0.62:1  tablet 768 | 2 lv | 17 lv | holds → **marginal** |
| 1.64:1  phone 390 | 6 lv | 6 lv | unchanged |

## The finding: it moves in both directions

Glyph measurement is not uniformly stricter. It is stricter where type reaches over a
bright area the band never looked at, and more permissive where the band was charging for
brightness no type sits on.


| Direction | Example | Why |
| --- | --- | --- |
| Much stricter | clean-bottom hero at 1.75:1, 6 → 63 lv | At a tall crop the type stack extends **above the crop's midline**. The band stops at the midline, so the brightest part of what the reader actually reads over was outside the measured region entirely. |
| Much stricter | clean-bottom tile at 0.62:1, 1 → 47 lv | The narrowest tile: the title occupies proportionally far more of the frame than a bottom third implies. |
| More permissive | lit-bottom hero at 2.34:1, 67 → 26 lv | The lit patch sits in the bottom band but **not under any glyph**. The band failed the frame for brightness nobody reads over. |
| More permissive | wide-offcentre hero at 2.34:1, 18 → 8 lv | Same cause, smaller scale. |

The first row is the one that matters most. The old rule — *keep the bottom half quiet* —
is not conservative at tall crops, it is simply wrong there: the type is not confined to
the bottom half. That error was invisible to a band-shaped measurement, because a band can
only ever be wrong about brightness inside itself.


## Newly failing

| Frame | Treatment | Ratios that newly fail |
| --- | --- | --- |
| sample-clean-bottom | hero | 1.75:1, 0.75:1 |
| sample-clean-bottom | tile | 0.62:1 |
| sample-wide-offcentre | tile | 0.62:1 |

Every newly failing ratio is at or below 1.75:1 — the crops where the frame is tallest
relative to its width and the type therefore occupies the most vertical space.


## What this means for thresholds

Do **not** retune from these numbers. Two things have to happen first:

1. Re-run with Archivo and Space Mono actually loaded. Line wrapping at the 18ch and 46ch
   caps depends on the real faces, and wrapping drives stack height, which drives how far
   up the frame the type reaches. The largest changes above are all height-driven.
2. Run real photography, not the three synthetic samples. The samples were built to
   exercise the band — one clean, one with a lit bottom, one off-centre — and none of them
   was designed around where glyphs fall.

The comparison mode and the three region modes stay in the page so that work is a matter
of reading rows rather than rebuilding anything.


## How to reproduce

In the page: **Measured region** selects band, glyph or full block; **Compare against
legacy band** puts the old verdict beside the new one per ratio; **Show measured region**
draws raw glyph ink in white, the 0.25em dilation in red, and block rectangles dashed —
grey where a block is opaque and therefore excluded.

