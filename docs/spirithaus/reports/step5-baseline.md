# Baseline — fifteen hero frames, native 3:2 geometry

The first run under the canonical `--master source`. Fifteen frames, five viewports,
both models, focals proposed but **not yet reviewed**. Fonts real, no page errors, all
fifteen focals supplied.

```
safe zone   x 0.252 – 0.748     y 0.179 – 0.821
verdicts    legacy 0 pass / 15 fail     2.0  0 pass / 15 fail
divergence  26 of 75 rows (34.7%), 10 of 15 assets, 0 stricter, 26 more permissive
```

## The set contains two failure modes and nothing that avoids both

Splitting by whether the subject sits inside the horizontal safe band:

| | n | mean crop survival | mean type occlusion |
|---|---|---|---|
| subject **inside** x 0.25–0.75 | 6 | **94.7%** | **57.0%** |
| subject **outside** | 9 | **20.2%** | **0.0%** |

The separation is total. Every frame that keeps its subject on a phone puts that subject
under the headline; every frame that clears the headline does so by having its subject
cropped away first. Three of the nine — the whisky shelf wall at x 0.82–0.84 — record
`cropVisible: 0`: the subject is entirely absent at some viewport.

**The 0.0% type occlusion in the bottom row is not a success.** It is what "nothing is on
screen to collide with" looks like in the data. Read alone it would suggest nine frames
with perfect headline clearance, which is the opposite of what is happening.

So the prescription is not "move the subject left". It is move it left *and up*: the two
constraints bind on different axes and this set satisfies neither at once.

## The safe-zone sweep now has a single clear peak

Subject centred, walked down the frame, 15 frames × 5 viewports at each height:

| y | survival | crop % | type occlusion % |
|---|---|---|---|
| 0.20 | 60% | 90.1 | 0 |
| **0.25** | **100%** | 98.9 | 0 |
| 0.30 | 80% | 100 | 4.9 |
| 0.35 | 60% | 100 | 15.9 |
| 0.40 | 40% | 100 | 31.1 |

`bestY: 0.25, survivalRate: 100, inTargetBand: false`.

This is not the earlier tie. **0.25 is a unique maximum** — the only height where every
frame survives at every viewport — and it sits below the 0.33–0.40 band the prompt pack
currently targets.

The move is explained by the geometry decision rather than by new photographs. A square
master's safe band starts at y 0.286, so 0.25 was cropped away and could not win; the
native band starts at 0.179, which frees the subject to sit higher and further from the
type stack. The earlier evidence for 0.33–0.40 was measured against a master shape that
does not match what gets uploaded.

## Failure profile

```
 42  highlights lost to scrim
 35  intrusion severe
 25  image flattened by scrim
 13  crop loss
 13  typography occlusion
 11  intrusion present
  5  scrim obscuration
```

Text metrics dominate, which is why all fifteen fail overall regardless of focal
behaviour.

## What this does not establish

Nothing here is labelled, so **no threshold is derived and none should be**. Both models
fail all fifteen, so the pass/fail summary again has no discriminating power; the 26
divergent rows are where the evidence lives, and they are listed in the report and
pre-filled in `labels.template.json`.

Zero rows where 2.0 is stricter, now over 75 rows and a second corpus. That is
consistent enough to be worth stating as a property of the model rather than of the
sample: on this library 2.0 only ever clears frames the band model condemned, never the
reverse.

The focals are proposals read off the frames by eye. The crop figures depend on them
directly, so a focal that is wrong by 0.05 moves its row. The y sweep does not — it
centres the subject itself — which is why the sweep is the more robust of the two
results here.

**Recommendation: do not move the target band yet.** The sweep is geometric, unlabelled,
and rests on a corpus with no compliant frames in it. It is now the strongest single
hypothesis in the project and should be settled by the labelled run, not by this one.
