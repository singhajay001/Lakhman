# CLAUDE.md

Guidance for Claude Code and other AI assistants working in this repository.

## What this is

A **Shopify theme** for SPIRITHAUS PTY LTD (ACN 701 853 483) — an online bottle
shop selling spirits, wine and canned cocktails, Sydney metro at launch.

The theme is **Dawn 16.0.0** (upstream commit `258f00f`) with a SpiritHaus brand
layer applied on top. The complete Dawn tree is vendored here, so the repository
is a full, syncable theme rather than a patch set — that is what Shopify's
GitHub integration requires.

- Store: `1312wd-hk.myshopify.com` → `spirithaus.com.au`
- Build brief, and the single source of truth for scope: `docs/BRIEF.md`

## Repository layout

```
assets/ config/ layout/ locales/ sections/ snippets/ templates/
                      # the theme. Shopify's own structure, at the repo root.
docs/BRIEF.md         # the build brief
patches/              # diffs against pristine Dawn, plus test harnesses
.shopifyignore        # keeps repo furniture out of a CLI push
```

Everything outside the seven theme directories is repository furniture and is
ignored by both Shopify's GitHub sync and the CLI.

## What is ours versus Dawn's

Knowing which is which matters, because Dawn-owned files are the merge-conflict
surface when upstream updates.

**New files (ours):**

```
assets/spirithaus.css                   the whole brand layer
sections/spirithaus-hero.liquid
sections/spirithaus-categories.liquid
sections/spirithaus-curation.liquid
sections/spirithaus-compliance.liquid   site-wide liquor licence notice
sections/spirithaus-age-gate.liquid
```

**Dawn files we edited** — all additive except the JSON templates:

```
layout/theme.liquid            +39  fonts, stylesheet link, age-gate cookie check
sections/main-product.liquid  +153  three new {% case %} branches + schema blocks
sections/footer-group.json          registers the two compliance sections
templates/product.json              block order
templates/index.json                homepage
templates/collection.json           grid settings
config/settings_data.json           colour schemes, radius and shadow zeroed
```

`patches/*.patch` holds each edit as a diff against pristine Dawn, so a change
can be re-applied to a differently-customised theme by hand.

## How the brand layer works

Dawn declares its geometry and typography as CSS custom properties in a
`{% style %}` block in `layout/theme.liquid`, then consumes them everywhere.
`assets/spirithaus.css` **redefines those properties** rather than fighting
Dawn's rules selector by selector. That is why the file contains **no
`!important`** — a custom property redefined on `:root` in a later stylesheet
wins outright.

Two gotchas that have already cost time:

- **Body-injected stylesheets.** Some Dawn component CSS (`component-card.css`,
  `component-price.css`) is injected by sections and lands in `<body>`, i.e.
  *after* our stylesheet. Custom properties are immune, but a plain rule can be
  beaten at equal specificity. Fix with a specificity bump, never `!important`.
- **Colour triplets.** Dawn stores scheme colours comma-separated
  (`17, 17, 16`) for `rgba(var(--x), a)`. The modern `rgb(r g b / a)` slash form
  **cannot** be used with them — it expands to invalid CSS and is silently
  dropped. `patches/css-check.mjs` guards against this.

## Palette

| Token | Hex | Notes |
|---|---|---|
| `--sh-ink` | `#111110` | 16.46:1 on bone |
| `--sh-bone` | `#F2EFE9` | page ground, never pure white |
| `--sh-red` | `#CF1C29` | 4.75:1 on bone, 5.45:1 white-on-red |
| `--sh-muted` | `#6B6860` | 4.85:1 on bone |

`#D8202E` was the original brand red and **must not be reintroduced**: it
measures 4.39:1 on bone and fails WCAG AA for normal text. Red on ink is
3.46:1 — borders and rules only, never type.

## Verification, since nothing can be rendered here

There is no store access and no browser in this environment, so claims are
checked mechanically rather than by looking:

```bash
node patches/css-check.mjs      # CSS parse, spec validation, !important, rgb misuse
node patches/age-gate.test.mjs  # jsdom behaviour test for the age gate (12 assertions)
```

Both need `npm install css-tree jsdom` first. Contrast figures quoted in
comments are computed, not estimated. Anything that cannot be verified this way
is reported as unverified rather than asserted.

## Alcohol retail — non-negotiable

This store sells alcohol in Australia. Do not build anything that encourages
rapid or excessive consumption, uses countdown timers or fake scarcity on
alcohol, inflates RRP strikethroughs, or could appeal to under-18s. These are
ABAC and state liquor advertising requirements, not style preferences.

The age gate is an **entry-level declaration only** — it verifies nothing. The
real controls are photo ID on delivery and checkout-level verification from a
separate app. Never let the gate stand in for either.

Standard drinks is read from `custom.standard_drinks` and **never computed** in
the theme: the bottle label is the regulated source of truth.

## Metafields (namespace `custom`, created in admin)

```
standard_drinks (decimal)   abv (decimal)        volume_ml (integer)
country          region     producer             style
why_we_stock_it (multi-line text)
```

`why_we_stock_it` is the business model — it renders directly under the price
and above the buy button, and must never be buried under specs.

## Git workflow

- Never commit directly to `main`. Work on the assigned `claude/*` branch.
- Push with `git push -u origin <branch>`; retry only network failures.
- Do not open a pull request unless explicitly asked.
- **Never push to the published Shopify theme.** The owner reviews on a
  duplicate or an unpublished GitHub-connected theme and publishes.

## Outstanding

- Logo assets are being regenerated. The wordmark is **SPIRITHAUS**, one word,
  with the drawn U as the ninth glyph inside HAUS, in `#CF1C29`. An earlier
  export spelled it "SPIRITUS HAUS" and used the old red — it was rejected and
  removed. The header logo is deliberately **unwired** until the new SVGs land.
- Nothing in this theme has been rendered in a browser. Mobile layout at 375px
  is reasoned from the CSS, not observed.
