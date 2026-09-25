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
