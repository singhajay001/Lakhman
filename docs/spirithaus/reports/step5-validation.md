# Validation — Reports A to E

The labelled run. Fifteen hero frames, five viewports, both models, frozen focals,
native 3:2 geometry. Twenty-six divergent rows judged by Ajay from frames rendered
as they would ship. Fonts real, no page errors, one frame `subjectless`.

**Read Report E first if you read only one.** The headline number is 26 of 26, and
it means less than it looks.

---

## A — Legacy vs Scrim Proof 2.0

| | pass | warn | fail |
|---|---|---|---|
| Legacy band model | 0 | 0 | 15 |
| Scrim Proof 2.0 | 0 | 0 | 15 |

No discriminating power at asset level, for the third run running. An asset takes
its worst viewport and the phone fails on every frame, so every improvement at the
wide viewports is discarded before it reaches this table.

**This table is why the project measures divergence per viewport.** Per row, the
same corpus separates on 26 of 75 (34.7%), across 10 of 15 assets, with **zero
rows where 2.0 is the stricter model**.

## B — Where they diverge, and by how much

All 26 rows are `fail → warn`, all on **intrusion**, all at the three wide
viewports. Nothing is cropped in any of them.

| | min | mean | max |
|---|---|---|---|
| band model reads | 35.1 | **66.6** | 85.5 |
| glyph model reads | 0.8 | **9.8** | 29.0 |

Against a house limit of 12 levels. Per asset:

| asset | band → glyph, by viewport |
|---|---|
| `hero-whisky-shelf-d` | 84.2→13.1 · 85.5→10.4 · 84.0→17.4 |
| `hero-vodka-ice` | 81.7→1.4 · 80.7→0.8 · 77.9→0.9 |
| `hero-cocktails-cans-c` | 76.0→13.8 · 76.3→16.5 · 73.7→23.6 |
| `hero-cocktails-cans-a` | 74.0→9.0 · 73.2→11.1 · 72.3→16.0 |
| `hero-liqueurs-trio` | 66.0→5.7 · 67.1→5.6 · 66.2→5.4 |
| `hero-cocktails-cans-b` | 62.3→6.9 · 62.4→7.5 · 60.6→9.8 |
| `hero-tequila-pina` | 59.8→11.1 · 58.7→6.0 |
| `hero-gin-botanicals` | 58.0→29.0 |
| `hero-whisky-cask` | 58.3→10.6 · 54.7→6.8 · 47.5→9.6 |
| `hero-hand-bottle` | 35.1→1.4 · 35.5→6.3 |

These are not threshold-edge disagreements. A frame reading 81.7 under one model
and 1.4 under the other is not being scored differently — it is being *measured
somewhere else*. The band model was reading ice bowls, jiggers and bar spoons:
objects sitting in the bottom half that no headline ever touches.

## C — Safe-zone sweep

Unchanged by the labels, as expected — the sweep centres the subject
programmatically and never consults them.

```
bestY 0.25 · survival 100% · unique maximum · inTargetBand false
limited above by crop loss, below by typography occlusion
```

It has now survived a master-geometry change, a focal revision, an asset exclusion
and a labelled run without moving. It remains **unadopted**: it is geometric,
unlabelled, and measured over a corpus containing no compliant frame.

## D — Thresholds

**None derived. All six null, deliberately.**

Every label is a *viewport* judgement. No asset-level (`"*"`) verdict exists, so
`labelled` is 0 and `deriveThreshold` correctly returns null for every metric. A
threshold separates acceptable frames from unacceptable ones, and no frame has
been judged as a frame.

This is the harness declining to manufacture a number, which is what it was built
to do. Distributions and natural breaks are printed and marked *suggestive*.

## E — What this run establishes, and what it does not

### Established

**The band model was wrong on 26 of 26 rows a human would publish.** It read
35–86 levels of intrusion against a limit of 12, on frames judged publishable,
because it was measuring objects the type never reaches. That is the case for
measuring rendered glyph boxes instead of an assumed band, and it is now evidence
rather than argument.

**The pass/warn boundary is too tight.** 2.0 reached `warn` on all 26 and `pass`
on none. Under the strict reading — only `pass` counts as publishable — *neither*
model matches the reviewer on any row. Measuring the right region is not
sufficient; the boundary is also wrong, and that is a separate, unfixed problem.

### Not established

**Whether 2.0 is ever too permissive.** Every one of the 26 labels is `accept`, so
no row tested the direction where 2.0 clears something it should not. The nearest
thing to that test was `hero-whisky-cask` at small-1024 — 78.4% type occlusion by
the tool's own reckoning — and it was accepted.

**Any threshold.** See D.

**Whether the corpus is representative.** Fifteen frames, all old-rule
compositions, none shot to the current guidance. Nine of fourteen scored frames
put the subject outside the horizontal safe band. There is no compliant frame in
the set, so nothing here says what a good frame scores.

### The number to distrust

```
strict    26 rows   0 legacy-only   0 2.0-only   0 both   26 neither
lenient   26 rows   0 legacy-only  26 2.0-only   0 both    0 neither
```

**26 of 26 is arithmetic, not a finding.** With a uniform label set the
adjudication could not have produced anything else. What carries the weight is the
*magnitude* table in Report B — that the two models are 57 levels apart on average
— and that holds regardless of how the rows were labelled.

A corpus containing frames a reviewer would reject, and frames shot to the current
rule, would test what this one cannot.
