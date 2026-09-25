# Label provenance

Who judged what, and on what basis. `labels.json` carries the verdicts; this
carries the reasoning, because a verdict with no account of itself is only
slightly better than no verdict.

**All labels are Ajay's.** Proposals were drafted by Claude from rendered frames
and accepted or overruled by him. A label Claude invented unilaterally would make
the calibration measure whether Scrim Proof agrees with its own author, which is
the one thing it must not measure.

Each row was judged from the frame **as it would ship** — real cover-crop at that
viewport, the theme's 58% ink scrim, the real type stack in the theme's own
metrics — not from the numbers.

## 2026-09-25 — `hero-vodka-ice.png`, three divergent viewports

Proposed accept / accept / accept. **Accepted as proposed.**

| viewport | verdict | reasoning |
| --- | --- | --- |
| `desktop-1920` | accept | Type sits bottom-left over near-black wet bench; bottle and glass well right with clear air between. Nothing competes with the headline. |
| `laptop-1440` | accept | Same composition, tighter. "Sydney" ends well before the glass. Separation still clean. |
| `small-1024` | accept | The word "spirits," reaches the shot glass rim. Flagged at proposal time as the least certain of the three — type stays legible because the glass is dark frosted rather than a highlight, but the headline touches the subject. Accepted. |

**What these three decide.** The band model read 81.7, 80.7 and 77.9 levels of
intrusion on these rows; the glyph model read 1.4, 0.8 and 0.9. Accepting them
says the band model was measuring the *subject* as an intrusion into the quiet
zone on frames that are publishable, and that the glyph model's near-zero reading
is correct because the type genuinely sits clear of it.

`small-1024` was the row most likely to go the other way, and would have been the
more informative rejection: the type does touch the glass there, so a reject would
have said the glyph region is drawn too tight — 2.0 wrong in the permissive
direction, which nothing else in the harness can detect.

## Not yet judged

No asset-level (`"*"`) verdict has been given for `hero-vodka-ice.png`, so it
stays out of threshold derivation. That is deliberate: viewports were judged, the
frame as a whole was not, and the runner must not promote one to the other.

23 divergent rows across the other nine assets remain unlabelled.
