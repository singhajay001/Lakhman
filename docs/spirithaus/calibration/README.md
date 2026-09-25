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
{ "hero-whisky.jpg": "pass", "hero-gin.jpg": "reject-layout" }
```

`pass`, `accept`, `good`, `ok`, `yes` and `keep` all mean acceptable; `fail`, `reject`,
`bad`, `no` and `reshoot` all mean not. Blank means not yet judged and is skipped.
Anything else stops the run with the offending entries named, rather than being dropped
silently — a label the runner ignores looks exactly like no label at all, and the report
would read "not derivable" while the file sat there full of verdicts.

### Saying why, not just what

Three sub-classed rejects record the *cause*:

| label | the frame was turned down because of |
|---|---|
| `reject-layout` | where things sit — composition, crop, what the type lands on |
| `reject-subject` | the subject itself — wrong hero, badly lit, unclear |
| `reject-contrast` | tone — the scrim, the highlights, legibility of the type over it |

All three still count as `reject` for threshold derivation, so using them costs nothing
and the cut is unaffected. What they add is the **Diagnostic agreement** section: your
reason crossed against the causes the tool named for the same frame.

That is a different and harder test than the verdict. A frame you rejected for tone,
which the tool rejected for crop, counts as perfect agreement on a binary label — and
would send someone to recompose a picture that only needed its scrim adjusted. A wrong
diagnosis behind a right verdict is invisible without this.

It is reported as a cross-tab rather than an accuracy score. Scoring it would mean
inventing a correspondence between your vocabulary and the tool's, and then reporting
that invention as a measurement.

Note there is no `reject-reshoot`. *Reshoot* is a remedy, not a defect, and every reject
is arguably a reshoot; mixing causes with actions makes the axis unreadable. Record the
cause here.

These can only be collected while judging. Retrofitting them means labelling twice.

### Labelling a single viewport

An asset's verdict is its **worst** viewport, so an asset-level label cannot say whether
a particular viewport was judged rightly. A frame can fail on the phone and be perfectly
publishable on the desktop — and the rows where the two models disagree are exactly the
rows an asset verdict averages away.

Give an object instead of a string to judge per viewport. `"*"` still gives the
asset-level verdict:

```json
{
  "hero-vodka.webp": { "*": "reject", "desktop-1920": "accept", "laptop-1440": "accept" },
  "hero-rum.webp": "reject-contrast"
}
```

Plain strings keep working; nothing already written needs changing. A viewport id the
theme does not render stops the run and lists the ones it does, because a mistyped id
would otherwise sit in the file looking like a judgement and count for nothing.

**You only need these on the divergent rows.** Every run writes
`labels.template.json` into the output directory with those rows already listed and
blank, so copy that to `labels.json` and fill it in rather than transcribing them out of
the report — that transcription is the one step where a row can be quietly missed, and a
missed row is evidence thrown away. Rows where the models agree tell you nothing about
which is better. An object with no `"*"`
leaves the asset unlabelled for threshold derivation, which is correct: you judged
viewports, not the frame.

The payoff is the **Which model matched you** section, scored only over divergent rows
and reported under two readings — *strict* counts only `pass`, matching the run sheet's
acceptance criteria; *lenient* also counts `warn`. They can disagree sharply on the same
labels, so a conclusion that holds under both is a finding and one that flips is a
statement about where the line was drawn.

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
