# Step 4 — focal point engine

Focal retention is now a blocking rendering constraint alongside contrast and intrusion.
A subject that survives the crop but sits under the headline is broken whatever the
contrast reading says, so none of the three losses is folded into the text metrics.

## The taxonomy, as implemented

| Type | Condition | Threshold | Default |
| --- | --- | --- | --- |
| 1 — Crop loss | Focal area falls outside the rendered viewport | `minCropVisible` | 90% |
| 2 — Typography occlusion | Retained, but overlapping the measured type region | `maxTypeOccluded` | 5% |
| 3 — Scrim obscuration | Retained, but no longer distinguishable from the scrim | `maxScrimCovered` | 40% |

All three are diagnosed independently, because they have different fixes: re-crop,
re-compose, or light the subject harder. Any one of them failing fails the frame.

The three defaults are **policy, not theme data**, and are editable in the panel. They have
not been calibrated against real photography — see the caveat at the end.

## How each is measured

The focal point is a **disc**, not a pixel: a point cannot be 72% visible. It is stored
normalised on the square master, with a radius defaulting to 9% of the master. The disc is
sampled on a grid and every sample classified against the same crop, type region and
composited pixels the rest of the analysis pass already computed — one draw, both
measurements.

- **Crop loss** maps each sample through the view's centred cover crop and counts those
  landing outside the frame.
- **Typography occlusion** tests samples against the Step 3 glyph mask, so it follows the
  real type rather than a band.
- **Scrim obscuration** composites the sample and asks whether it can still be told apart
  from the flat ink: below **1.2:1** against the scrim colour, the subject has stopped being
  visible. This catches the interaction the other two miss — a subject that is in frame and
  clear of type, but sitting under the baked veil.

## Output

Per viewport, and a worst-case summary, copyable as JSON from the panel:

```json
{
  "viewport": "phone-390",
  "retention": "partial",
  "cropVisible": 72,
  "typeOccluded": 18,
  "scrimCovered": 33,
  "status": "fail"
}
```

`retention` is `full` above 99.5% visible, `lost` at or below 0.5%, `partial` between.
The copied payload also carries the frame, placement, measured-region mode, font state,
focal spec and the thresholds in force, so a result can be reproduced from it.

## Verified behaviour

Each failure mode was driven independently on `sample-clean-bottom`:

| Placement | crop | type | scrim | Diagnosis |
| --- | --- | --- | --- | --- |
| Default, upper centre | 73% at 2.34:1 | 0% | 12% | **Crop loss** at the two widest viewports |
| Clicked low and left | 99% | 39–100% | 99–100% | **Occlusion and obscuration** together — under the headline and inside the veil |
| Clicked at the left edge | 0% at phone-390 | 0% | 0% | **Crop loss**, total: the subject is not on a phone at all |

The overlay draws all four at once: focal disc and crosshair, the safe zone, the measured
type region, and the veil line.

## The finding: the safe zone is small

A subject must survive **every** viewport, so the region of the master that is always on
screen is the intersection of all the crops:

| Placement | Safe horizontally | Safe vertically |
| --- | --- | --- |
| Hero | x 0.127 – 0.873 (75% of width) | **y 0.286 – 0.714 (43% of height)** |
| Tile | x 0.188 – 0.812 (62% of width) | y 0.194 – 0.806 (61% of height) |

The hero number is the one that matters. Only the **middle 43%** of a square master's height
is guaranteed to be on screen: the widest crop, 2.34:1, takes a centred band and throws the
rest away. And the type occupies the bottom of every crop.

That contradicts the prompt pack, which currently says the subject belongs in the **upper
half, centred**. Anything above y = 0.286 is cropped on a wide desktop. The default focal
position in this tool, placed at y = 0.32 to match the pack's rule, is itself clipped at
2.34:1 — which is how the contradiction surfaced.

The corrected rule is narrower than either the pack or the tool currently states: the
subject wants to sit between **y 0.29 and roughly y 0.50** — below the wide-crop ceiling,
above the type. That is a change to the shooting brief, not to this tool, and belongs with
the prompt pack rather than here.

## Caveats

**Fonts.** This run substituted Archivo and Space Mono. Typography occlusion depends on the
glyph mask, so those percentages move with the real faces loaded. Crop loss does not — it is
pure geometry and is trustworthy as it stands.

**Thresholds are uncalibrated.** 90 / 5 / 40 are starting points chosen to be obviously
defensible, not derived. They belong in the Step 5 recalibration, against real photography,
alongside the intrusion and contrast thresholds.

**The focal point is placed by hand.** Automatic detection was explicitly out of scope, and
nothing here guesses where the subject is.
