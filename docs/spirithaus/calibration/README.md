# Calibration inputs

Two files the calibration runner takes, and why each changes what the report can say.
Copy the `.example.json` files, fill them in, and pass them with `--focals` and
`--labels`.

## `focals.json` — where the subject actually is

```json
{ "hero-whisky.jpg": { "x": 0.5, "y": 0.34 } }
```

Coordinates are fractions of the **square master**: `x` across, `y` down, both 0 to 1.
Eyeballing is fine — the point is to be roughly right rather than precisely wrong.
Open the frame in `scrim-proof.html` and click the preview; the position you click is
the one to record.

Without this the runner assumes the subject sits at the centre of the target band and
says so in the report. An entry left as `null`, or outside 0–1, counts as absent and is
named in that warning — a half-filled file cannot quietly pass itself off as complete.

## `labels.json` — your verdict on each frame

```json
{ "hero-whisky.jpg": "pass", "hero-gin.jpg": "fail" }
```

`pass`, `accept`, `good`, `ok`, `yes` and `keep` all mean acceptable; `fail`, `reject`,
`bad`, `no` and `reshoot` all mean not. Blank means not yet judged and is skipped.
Anything else stops the run with the offending entries named, rather than being dropped
silently — a label the runner ignores looks exactly like no label at all, and the report
would read "not derivable" while the file sat there full of verdicts.

**This file is what makes threshold derivation possible.** A distribution says what
exists; only labels say what is acceptable. Without them the report shows distributions
and natural breaks, both marked suggestive, and derives nothing.

Judge the frame as it renders in the storefront, not as a photograph. The question is
whether you would ship it, not whether you like it.

## Running

```sh
node ../tools/calibrate.mjs \
  --page ../scrim-proof.html \
  --images ./heroes \
  --focals ./focals.json \
  --labels ./labels.json \
  --out ./out
```

Eleven frames take roughly half a minute, most of it the safe-zone sweep.
