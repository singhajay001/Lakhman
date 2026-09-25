# Hero corpus

The regression corpus for Scrim Proof 2.0. Frames live here so a calibration run is
deterministic, versioned and reproducible by anyone with the repo — not dependent on
whatever happens to be on one machine.

```
node ../../tools/calibrate.mjs \
  --page   ../../scrim-proof.html \
  --images . \
  --focals ./focals.json \
  --labels ./labels.json \
  --out    /tmp/hero-out
```

`labels.json` is not committed yet; without it the run produces Reports A, B, C and E
and correctly derives no thresholds.

## Contents

**This set is incomplete.** Five of roughly sixteen hero frames. Enough to have caught a
measurement bug, not enough to calibrate a threshold.

| file | subject | focal x, y |
|---|---|---|
| `hero-vodka.webp` | frosted vodka bottle, shot glass, ice | 0.860, 0.450 |
| `hero-cocktails-a.webp` | three bottles on a bar top | 0.845, 0.460 |
| `hero-cocktails-b.webp` | three bottles, variant | 0.845, 0.470 |
| `hero-cocktails-c.webp` | three bottles, variant | 0.875, 0.470 |
| `hero-rum.webp` | rum bottle with cane and molasses | 0.830, 0.470 |

All five are old-rule compositions — subject right, quiet left — from before the pack
moved to *subject centred, visual mass one-third to two-fifths down*. Their focal x of
0.830–0.875 sits at or past the 0.873 safe-x edge, and their y of 0.45–0.47 is at or
below the midline where type begins. **They are a corpus of the failure mode, not of the
target.** Read any aggregate over this set with that in mind: it cannot tell us what a
compliant frame scores, because it contains none.

## Adding frames

1. Drop the file in. Name it `hero-<subject>.webp` — the runner infers the slot from the
   `hero-` prefix, and `tile-` for tiles.
2. Add a focal entry to `focals.json`: fractions of the **square master**, `x` across and
   `y` down. Open the frame in `scrim-proof.html` and click the subject; that is the
   coordinate to record. Roughly right beats precisely wrong.
3. A frame with no focal entry is counted as unfocalled and named in the report's
   warning. It is never silently defaulted.

## What this set cannot yet answer

Thresholds, classification boundaries, and whether Scrim Proof 2.0 separates production
outcomes better than the legacy band model. All five fail both models, so the sample has
no discriminating power — that needs the full library, plus labels.
