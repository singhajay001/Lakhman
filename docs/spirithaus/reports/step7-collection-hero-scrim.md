# Step 7 — The collection hero ships white type at 1.48:1

Found from four phone screenshots of live category pages (Tequila, Rum, Gin,
Whisky) on `spirithaus-theme/main`. The body copy is unreadable wherever it
crosses the bottle. This is a live WCAG AA failure on every collection page.

## The mechanism

Three things combine. None of them is wrong on its own.

**1. `collection.image` wins, and it is not chosen for darkness.**
`sections/spirithaus-collection-hero.liquid` resolves its artwork in this
order: `collection.image`, then a per-collection Artwork block, then a shipped
`assets/sh-hero-<handle>.jpg`. The comment gives the reason, and it is a good
one — admin should stay authoritative, and `collection.image` is what search
results and shares use.

But every collection has one set, and they are product-catalogue bottle shots:
`the-botanist-islay-dry-gin.webp`, `BacardiCartaBlanca.webp`,
`HibikiJapaneseHarmonyWhisky700ml-1.webp`, and two 256x256 icons. Bright
subject, centred, directly under the words.

So the eight shipped frames — `sh-hero-whisky.jpg`, `sh-hero-gin.jpg`,
`sh-hero-rum.jpg`, `sh-hero-tequila.jpg`, `sh-hero-vodka.jpg`,
`sh-hero-liqueurs.jpg`, `sh-hero-cocktails.jpg`, `sh-hero-spirits.jpg`, all
present in `assets/`, all with `-sm` phone crops — are never reached on any
category page. They are the frames that were lit for this band, and they are
dead code today.

**2. The floor was dropped from 58% to 20% for frames that are not in play.**
The schema note explains it: "The supplied whisky frames measure 18:1 for
white type at 0%, so they want 20-30%." True of those frames. `collection.image`
never gets that check, and `templates/collection.json` carries
`overlay_opacity: 20`.

**3. 58% was copied from the homepage hero, where it is right, to this band,
where it is not.** `spirithaus-hero.liquid` sets kicker, heading and body in
`var(--sh-white)` — pure white — so its 58% floor and its `min: 58` are
correct. `.sh-chero` steps its type down: body `rgba(white, .88)`, count
`.86`, kicker `.72`. Lower text luminance needs a darker scrim, not the same
one.

## The numbers

Flat ink `#111110` over a pure-white pixel of the photograph. The scrim is
confirmed flat, not a gradient — `.sh-chero__media::after` in
`assets/spirithaus.css`, and the comment above it says so explicitly.

Derivation: `docs/spirithaus/tools/chero-contrast.mjs`.

| Scrim | title (pure white, large, needs 3.0) | body (.88, needs 4.5) | count (.86) | kicker (.72) |
| --- | --- | --- | --- | --- |
| **20% — live today** | 1.55:1 fail | **1.48:1 fail** | 1.47:1 fail | 1.38:1 fail |
| 45% | 3.04:1 pass | 2.72:1 fail | 2.67:1 fail | 2.32:1 fail |
| 58% — the inherited floor | 4.61:1 pass | **3.99:1 fail** | 3.89:1 fail | 3.25:1 fail |
| 68% — the CSS fallback | 6.57:1 pass | 5.54:1 pass | 5.38:1 pass | **4.33:1 fail** |
| **70% — the fix** | 6.99:1 pass | 5.86:1 pass | 5.69:1 pass | 4.57:1 pass |

The minimum that clears every role is **69.3%**, rounded up to 70.

Two things worth saying plainly: 58% would not have been enough here even if
it had been kept, and the CSS fallback `var(--sh-chero-overlay, 0.68)` is
itself 0.17 short for the kicker. That fallback is unreachable in practice —
the section always sets the variable inline — so it is left alone rather than
rewriting a 104KB stylesheet for dead code.

## The fix

One file, `sections/spirithaus-collection-hero.liquid`. The floor becomes a
function of which image won, because only one of the two sources is measured:

- shipped `assets/sh-hero-*.jpg` — measured, 18:1 at 0% — floor stays 20%
- `collection.image` — an admin field, can be anything — floor becomes 70%

The setting stays a floor, not a fixed value, so a merchant can still raise it.
`min` stays at 20 so the shipped-frame path keeps its range.

It goes in the section, which is code. It must not go in
`templates/collection.json`: the section's own comments record that the theme
editor keeps its own copy of that file and overwrites it on save, and that
blocks placed there were wiped twice within hours.

## Delivery

Theme writes against the live theme are blocked by policy, so this went into
its own draft, separate from the calibration-hero swap so the two can be
judged apart:

- `spirithaus-theme/chero-contrast-fix`, id 167090356470

Live `spirithaus-theme/main` is untouched.

## Not fixed here

- **Two collection images are 256x256** (`tequila`, `liqueurs-aperitifs`)
  serving a band that is 1536x512 on a desktop. They will look soft whatever
  the scrim does. That is admin data, not theme code.
- **The shipped frames stay unreachable.** Raising the scrim makes the bottle
  shots legible; it does not make them good. Pointing the band at
  `sh-hero-*.jpg` is a merchandising decision, not a contrast one.
- **This band was never in the calibration corpus.** The scrim tool models the
  `hero`, `tile` and `life` slots; `chero` is not among them. Every number
  above is analytic worst-case, not measured against the actual photographs.

## Addendum — what actually went live, and a lineage hazard

The scrim fix reached the storefront as a **setting**, not as code. The live
theme's `templates/collection.json` now carries `overlay_opacity: 70`, set by
hand in the theme editor. Every role clears AA at that value, so the failure
in the screenshots is resolved. The section's own `at_least: 20` is still
underneath it, so the 70 is unprotected: nothing stops it being dragged back.

The publish also landed a different theme than the one this report describes.
The live theme is now `spirithaus-theme/calibration-heroes` — the hero swap
from step 6 — so the calibration frames are live on the homepage and tiles.

That left `spirithaus-theme/chero-contrast-fix` stale and dangerous: it was
cut from `main` before the swap, so publishing it would revert every hero
image and the 70% settings while installing the floor. It should not be
published. Superseded by:

- `spirithaus-theme/scrim-floor`, id 167093666038 — the current live theme
  plus the floor, and nothing else. Verified: its
  `spirithaus-collection-hero.liquid` is 11824 bytes (fixed) while
  `templates/index.json` (3366) and `templates/collection.json` (777) are
  byte-identical to live. Publishing it is a visual no-op, because the floor
  and the hand-set value are both 70.

### The GitHub connection no longer reaches the storefront

`spirithaus-theme/main` carries a Shopify GitHub integration badge. It is the
branch-backed theme. It is also, now, unpublished.

So the live storefront is a duplicate with no GitHub connection, and the two
have drifted apart in both directions: pushes to the connected branch land in
an unpublished theme, and the theme-editor changes made today (the 70%, the
raised homepage overlay) exist only in Shopify and are not in the branch.

Every theme in play except `main` is a duplicate and therefore disconnected.
Whichever theme ends up live long-term, the integration has to be pointed at
it, or the branch has to be reconciled and the connected theme published
instead. Until then "deploy from git" is not true of this store, and the
section's own warning about a file two systems both write to now applies to
the whole theme.
