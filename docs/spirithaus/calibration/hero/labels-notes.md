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

## 2026-09-25 — the remaining 23 rows, judged as two groups

Judged by principle rather than row by row, at Ajay's direction, after seeing one
representative frame of each group rendered as it would ship. The grouping is
recorded here because a principle applied to rows nobody looked at is only as good
as the claim that those rows are alike.

**A correction to how the groups were first described.** They were initially
framed as "cropped on a phone" versus "type collision". That was wrong: all 23
rows sit at desktop-1920, laptop-1440 or small-1024 — the three wide viewports.
The crop only bites at tablet and phone, and those rows do not diverge. Nothing in
this set has anything cropped away. The real split is how close the subject sits
to the headline.

### Far right — 15 rows, subject at x 0.77–0.79

`hero-cocktails-cans-a`, `-b`, `-c`, `hero-liqueurs-trio`, `hero-whisky-shelf-d`.

Representative shown: `hero-cocktails-cans-a` at desktop-1920. Type sits over bare
bench with a wide gap to the subject. **Accepted.**

The band model read around 74 levels of intrusion on these frames. It was
measuring the ice bowl, the jigger and the bar spoon — objects in the bottom half
that no headline touches.

### Nearer centre — 8 rows, subject at x 0.62–0.65

`hero-whisky-cask` ×3, `hero-hand-bottle` ×2, `hero-tequila-pina` ×2,
`hero-gin-botanicals` ×1.

Representative shown: `hero-whisky-cask` at small-1024, the tightest case in the
set — 78.4% type occlusion by the tool's own reckoning, "Sydney" ending near
x 0.57 with the glass starting near 0.60. Ajay's words were "I like the bottom
one". **Accepted**, on the basis that the tightest case in the group reads well.

Taken as a verdict on that frame only, not as a comparison verdict against the
other group: a preference between two frames is not a rejection of either, and the
far-right group was asked about separately and accepted on its own terms.

## What this label set cannot test

**All 26 rows are `accept`.** The adjudication arithmetic is therefore close to
foregone: lenient will credit 2.0 on all 26 and legacy on none; strict will credit
neither. Those are consequences of a uniform label set, not findings.

What it does establish: the band model was wrong on 26 of 26 rows a human would
publish, and 2.0 never reached `pass` on any of them, so the pass/warn boundary is
too tight even with the right region measured.

What it cannot establish: whether 2.0 is ever **too permissive**. No row disagreed
with it, so that direction is untested. `hero-whisky-cask` at small-1024 was the
nearest thing to a test and went 2.0's way.

## Not yet judged

No asset-level (`"*"`) verdict has been given for any frame, so **nothing feeds
threshold derivation**. That is deliberate: viewports were judged, frames as a
whole were not, and the runner must not promote one to the other.
