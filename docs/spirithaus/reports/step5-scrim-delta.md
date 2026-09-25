# Scrim loss: absolute → delta

**Classification: bug fix, not a threshold change.** The previous metric measured the
wrong phenomenon. No threshold was retuned, and no text metric moved.

## What was wrong

`scrimCovered` classified a focal sample as lost when the *composited* pixel fell within
`SCRIM_VISIBLE_CONTRAST` (1.2:1) of the ink colour. The test read an absolute value, with
no reference to what the pixel looked like before the scrim touched it.

The ink is `#111110`, relative luminance 0.0056. Clearing 1.2:1 against it requires
luminance 0.0167, about sRGB 35/255. At the hero's 58% veil a source pixel maps to
`0.42v + 9.9`, so **any pixel darker than about RGB 60 in the original photograph was
counted as scrim-obscured** — whether or not the scrim had made any difference to it.

SPIRITHAUS shoots low-key spirits on near-black. The metric was therefore reporting the
house style as a blocking rendering defect. In the five-frame run it fired on 25 of 25
focal rows, every asset, every viewport.

The sweep showed it plainly: `meanScrimCovered` tracked `meanCropVisible` to the decimal
(33.1/33.1, 40.0/40.0, 100/100), meaning every sample that survived the crop was
classified as lost, at every subject position, including positions where the subject is
the brightest thing in the frame.

## What replaced it

Each disc sample is now read twice out of the same buffer — `data` holds the pre-scrim
frame, the veil being applied arithmetically — and classified before and after:

```
rawDistinguishable        % of post-crop samples clearing 1.2:1 in the photograph as shot
postScrimDistinguishable  % of the same samples clearing 1.2:1 after compositing
scrimLoss                 raw − post
```

`scrimLoss` is the blocking quantity. It answers *did the scrim materially reduce
distinguishability*, not *is the pixel dark*.

Both percentages are taken over the samples that survive the crop, not over the whole
disc, so crop loss stays accounted in `cropVisible` and cannot leak into the scrim's
column. A subject the photographer put in deep shadow reads `raw ≈ 0, post ≈ 0,
loss = 0`: the scrim took nothing, because there was nothing to take.

`scrimCovered` is retained, unblocking, as a diagnostic. It is a useful reading of how
low-key a frame is. It is not a defect measure.

## Threshold status

The `Max scrim loss` control keeps the value 40 it carried as an absolute limit. **That
number is inherited, not derived** — it was never calibrated against labels, and it now
governs a different quantity on a different scale. It is provisional until a labelled
run derives it. The report marks it as such.

## Verification, five hero frames

Text metrics, `cropVisible` and `typeOccluded` are byte-identical before and after
across all five assets; the 22 text-metric failure rows are unchanged. The change is
isolated to the scrim column.

| asset | crop | type | raw | post | **loss** | abs. dark |
|---|---|---|---|---|---|---|
| hero-cocktails-a | 68.4 | 0.2 | 46.6 | 41.7 | **15.4** | 58.3 |
| hero-cocktails-b | 68.4 | 0.5 | 6.6 | 4.5 | **11.0** | 94.3 |
| hero-cocktails-c | 47.3 | 0.0 | 62.5 | 15.9 | **52.8** | 82.4 |
| hero-rum | 78.3 | 2.5 | 10.5 | 6.2 | **5.3** | 93.8 |
| hero-vodka | 58.0 | 0.0 | 51.5 | 30.6 | **24.3** | 69.4 |

Focal failure rows fall from 25 of 25 to 9 of 25. Four assets now fail focal only at
phone-390, on crop loss. Only `hero-cocktails-c` fails on the scrim — a real 52.8% loss,
the frame whose subject is brightest where the veil is strongest. That is the metric
behaving as intended: it separates the one frame the scrim actually damages from four it
merely darkens.

Note the inverse relationship between `loss` and `abs. dark`: the two darkest frames
(94.3%, 93.8%) show the *smallest* scrim loss (11.0%, 5.3%). Under the old metric they
were the worst offenders. They were never the problem.
