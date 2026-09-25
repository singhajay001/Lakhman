# Regenerating `theme-profile.json`

Scrim Proof reads every ratio, scrim value and type metric from
`../theme-profile.json`. That file is generated from the live theme, never edited
by hand. Regenerate it whenever the theme changes.

The job is split in two on purpose. **Fetching** needs store credentials;
**parsing** does not. The parser is pure and offline, so the profile it produces
can be reviewed in a pull request like any other diff.

## 1. Fetch the theme

Any copy of the theme works — `shopify theme pull` is the usual route:

```sh
shopify theme pull --store spirithaus.com.au --path /tmp/theme
```

The parser needs these files:

```
assets/spirithaus.css        geometry, typography, scrim colour
assets/base.css              page-width container and button metrics (Dawn)
sections/spirithaus-hero.liquid        scrim range floor
sections/spirithaus-categories.liquid  scrim range floor
config/settings_data.json    page width, root font scale, button border
templates/index.json         the scrim values and copy actually in use
```

## 2. Write `_source.json`

This records what the profile was built from, and is what the staleness warning
compares against later. Checksums come from the Admin API, which reports them per
file (`OnlineStoreThemeFile.checksumMd5`).

```json
{
  "shop": "spirithaus.com.au",
  "themeId": "gid://shopify/OnlineStoreTheme/…",
  "themeName": "spirithaus-theme/main",
  "role": "MAIN",
  "themeUpdatedAt": "2026-09-18T02:23:56Z",
  "files": {
    "assets/spirithaus.css": { "checksumMd5": "…", "updatedAt": "…" }
  }
}
```

Note: the Admin API re-serialises JSON theme files, so a local re-hash of
`settings_data.json` or `index.json` will not match the stored checksum. Record
the API's value; it is the authoritative fingerprint of the stored file.

## 3. Build

```sh
node build-theme-profile.mjs \
  --theme /tmp/theme \
  --source /tmp/theme/_source.json \
  --out ../theme-profile.json
```

Add `--viewports viewports.json` to override the device matrix. That matrix is the
one policy choice in the file — it says which screens we hold ourselves to, rather
than anything about the theme.

## If it fails

The generator refuses to emit a default. A message like

```
could not extract .sh-hero__heading font-size.
The theme has changed shape. Update the extractor — do not add a default.
```

means a selector it depends on has moved or been renamed. Fix the extractor so the
profile stays a true reading of the theme. A default here would be exactly the
silent drift this file exists to prevent.

## After regenerating

Re-run the sample set through Scrim Proof and check the comparison report before
accepting a profile that moves any measurement. A profile change can move every
verdict at once.

---

# Running a calibration

`calibrate.mjs` takes a folder of frames and writes a calibration package:
`report.html`, `report.json` and `report.csv`.

It drives the page's own engine through `window.scrimProof` rather than
reimplementing the measurement. There is one engine, so a batch report cannot drift
from what the tool shows — which is the entire point of a calibration baseline.

```sh
node calibrate.mjs --page ../scrim-proof.html --images ./heroes --out ./out
```

Run it against a **built** page — one that has had `embed-profile.mjs` and
`embed-fonts.mjs` applied. A page without them either refuses to render or measures
with substitute fonts, and the report says which.

Requires `playwright` with Chromium. A global install is fine:
`NODE_PATH=/path/to/global/node_modules node calibrate.mjs …`

## The two optional inputs, and why they matter

```sh
--focals focals.json   # { "hero-whisky.jpg": { "x": 0.5, "y": 0.37 } }
--labels labels.json   # { "hero-whisky.jpg": "accept" }
```

**`--focals` says where the subject actually is.** Without it the runner assumes the
centre of the target band, and every crop, occlusion and obscuration figure describes
that assumed position rather than the real subject. The report carries a banner
saying so.

**`--labels` records human verdicts, and thresholds cannot be derived without them.**
A threshold separates acceptable frames from unacceptable ones; a distribution on its
own contains no notion of acceptable. Given labels, the runner picks the cut that best
separates them and reports its accuracy, false accepts and false rejects. Without
them it reports the distribution and the largest natural gap, both marked as
suggestive, and states plainly that no threshold has been derived.

## What the report contains

- **Asset summary** — legacy verdict against current verdict for every frame, with
  the worst reading per metric.
- **Failure matrix** — asset, viewport, failure type, severity and reason.
- **Safe-zone analysis** — the focal point walked down the master, recording what
  survives at each height across every frame and viewport, with the best observed
  position and what limits it from either side.
- **Threshold analysis** — the observed distribution for each of the five metrics,
  and a derived threshold where labels allow one.

The safe-zone sweep uses a focal disc of 9% of the master. The usable window depends
on subject size: a smaller subject has more room, a larger one less.
