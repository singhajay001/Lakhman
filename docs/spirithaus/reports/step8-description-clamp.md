# Step 8 — Clamping the collection description on a phone

The scrim fix made the copy readable. It did not make it short. This is the
second half of that question: whether to keep `show_description` on at all.

## Why not just turn it off

`spirithaus-collection-hero.liquid` is the only place `collection.description`
renders. Nothing else on the collection template outputs it. Turning the
setting off does not relocate the copy, it deletes it from the page — 24
categories of original, specific, on-topic prose, which is the best SEO
content the site has and the clearest statement of the positioning at the
moment someone is choosing a category.

"A mixto blends agave with other sugars and is built for volume drinks" is
the whole argument, delivered where it counts. That is not worth 200px.

## The cost it was hiding

Measured from the live descriptions. At 390px the body sets at 15px with
1.55 line-height in a 360px column, so roughly 48 characters a line. Line
counts are derived from average glyph advance, not measured in a browser, so
they carry about a line of slack.

| Category | chars | lines | body height |
| --- | --- | --- | --- |
| Australian Made | 643 | 14 | ~326px |
| Gin | 641 | 14 | ~326px |
| Spirits, Rum, Tequila, Cocktails | ~510 | 11 | ~256px |
| **median of 24** | **416** | **9** | **~210px** |
| New This Month | 272 | 6 | ~140px |
| Bourbon | 196 | 5 | ~117px |

Add the kicker, title, count block and the band's padding and the median hero
runs about 380px. The announcement bar, header and category bar take roughly
250px before it starts. So the first bottle lands at the fold on a typical
category and well below it on Gin and Australian Made.

## What was built

A four-line CSS clamp under 750px with a Read more / Show less toggle. Four
lines is about 93px against a median 210, which brings the grid back above
the fold without the copy leaving the page.

Three properties worth stating, because they are the reasons this beats
turning the setting off:

- **It is a clamp, not a truncation.** The full description stays in the DOM.
  Search engines and screen readers get all of it whatever the clamp shows.
- **No JavaScript means no clamp.** The button ships `hidden` and is revealed
  by script. If the script never runs, the description is simply whole —
  never four lines with no way to reach the rest.
- **It only appears when something is cut.** The clamp is applied and the
  element is then asked whether anything is actually hidden. Bourbon at five
  lines and Moscato at seven never show a button.

The measurement waits on `document.fonts.ready`, because a line count taken
in the fallback face is the wrong line count. A `matchMedia` listener re-runs
it on rotation or resize, and once a reader has opened the copy it stays open.

Truncating to the first paragraph was rejected. In every description the
first paragraph is the brand list and the second is the advice — that split
would have kept the inventory and hidden the insight.

The CSS lives in a `{% style %}` block in the section rather than in
`assets/spirithaus.css`. The clamp exists only for this section and the
section renders once per page, so there is nothing duplicated to pay for, and
it avoids rewriting a 104KB stylesheet to add twenty lines.

## Delivery

Live theme writes are blocked by policy, so this went into a draft cut from
the current live theme:

- `spirithaus-theme/desc-clamp`, id 167094059254

Verified after the write: `spirithaus-collection-hero.liquid` is 15794 bytes
and byte-identical to the local build, and Shopify raised no Liquid errors on
upsert. `templates/index.json` (3366) and `templates/collection.json` (805)
are byte-identical to live, so nothing else moves.

One thing the duplicate caught: live's `templates/collection.json` had grown
from 777 to 805 bytes between reading it and copying it, because the
collection-page hero's `cta_link` was set to `shopify://collections/all` in
the editor. That button renders only when both label and link are filled, so
it was previously not drawn at all. The duplicate carries the change.

Live is untouched and stays so until the draft is published from admin.

### Resolved

`spirithaus-theme/desc-clamp` was published on 2026-09-25 and is the live
theme. Verified after the fact: `spirithaus-collection-hero.liquid` is 15794
bytes, so the clamp and its toggle are in force, and `templates/index.json`
(3366) and `templates/collection.json` (805) are unchanged, so the heroes,
the 70% scrim and the collection-page call to action all carried over.

Both publishes in this session failed silently on the first attempt and stuck
on the second, on two different theme cards. The pattern points at the
confirmation dialog rather than at anything in the themes.

### Theme library after this

| Theme | State | Keep? |
| --- | --- | --- |
| `desc-clamp` | live | yes |
| `scrim-floor` | unpublished | yes, for now — one-click rollback to before the clamp |
| `main` | unpublished | yes — it holds the GitHub connection |
| `calibration-heroes` | unpublished | no — superseded twice over |
| `chero-contrast-fix` | unpublished | no — stale, and reverts the heroes if published |

The GitHub hazard from step 7 is unchanged and now two publishes further from
resolution: `main` still holds the connection and is still unpublished, so the
branch and the storefront remain disconnected in both directions.
