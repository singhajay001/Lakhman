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
and correctly derives no thresholds. When labelling, prefer the sub-classed rejects
(`reject-layout`, `reject-subject`, `reject-contrast`) over a bare `reject` — they cost
nothing, leave threshold derivation untouched, and are the only way the report can check
whether the tool agreed about the *cause* and not merely the verdict. See
[../README.md](../README.md).

## Contents

Fifteen hero frames, all 3:2, all delivered together. The five `.webp` files that were
here first were lower-quality re-encodings of five of these; they are gone, replaced by
the originals under descriptive names.

Coordinates are fractions of the **3:2 master** — which, under the canonical
`--master source`, is the file as shot. No conversion.

| file | subject | focal x, y | x inside 0.25–0.75? |
|---|---|---|---|
| `hero-whisky-shelf-a.png` | lit bottle on a dark shelf wall | 0.82, 0.50 | no |
| `hero-whisky-shelf-b.png` | as above, variant | 0.82, 0.48 | no |
| `hero-whisky-shelf-c.png` | as above, variant | 0.84, 0.50 | no |
| `hero-whisky-shelf-d.png` | as above, variant | 0.78, 0.48 | no |
| `hero-whisky-cask.png` | cask end and a Glencairn glass | 0.66, 0.58 | yes |
| `hero-gin-botanicals.png` | clear bottle, juniper, a hand | 0.62, 0.42 | yes |
| `hero-tequila-pina.png` | roasted agave piña, smoking | 0.63, 0.55 | yes |
| `hero-liqueurs-trio.png` | three bottles and a stemmed glass | 0.78, 0.45 | no |
| `hero-vodka-ice.png` | frosted bottle, shot glass, ice | 0.73, 0.45 | yes |
| `hero-cocktails-cans-a.png` | cans, jigger, bar spoon | 0.75, 0.45 | borderline |
| `hero-cocktails-cans-b.png` | as above, variant | 0.77, 0.42 | no |
| `hero-cocktails-cans-c.png` | as above, variant | 0.76, 0.42 | no |
| `hero-rum-cane.png` | rum, sugar cane, molasses | 0.76, 0.40 | no |
| `hero-store-interior.png` | shop shelving, warm lights | 0.65, 0.50 | yes |
| `hero-hand-bottle.png` | a hand placing a bottle | 0.63, 0.55 | yes |

**Nine of fifteen put the subject outside the horizontal safe band**, which on a 3:2
master is the middle half, x 0.25–0.75. Those subjects are not on screen at all for a
phone viewer. It is the single largest pattern in the set, and it is a fact about the
photography rather than about the focal estimates.

The focal coordinates are **proposals awaiting review** — read off the rendered frames
by eye, which is the accuracy the tool asks for, but not confirmed by the person who
shot them.

`hero-store-interior.png` is a wide shop interior with no single subject; a focal point
on it is close to meaningless, and whether it belongs in a hero slot at all is worth
deciding before it influences anything.

Three lifestyle frames were delivered alongside these and live in `../life/`, which
explains why.

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
