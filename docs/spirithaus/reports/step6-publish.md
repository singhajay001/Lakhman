# Step 6 — Pushing the calibration frames to the store

Date: 2026-09-25. Store: `1312wd-hk` / www.spirithaus.com.au.

Done on instruction, over a stated objection. The objection and the numbers
behind it are recorded below so the decision is legible later.

## What was uploaded

All fifteen hero calibration frames, at their native 1536x1024 (3:2), PNG,
into the Shopify Files library. They keep their repo filenames.

| File | MediaImage id |
| --- | --- |
| hero-store-interior.png | 46184701919478 |
| hero-cocktails-cans-a.png | 46184769683702 |
| hero-cocktails-cans-b.png | 46184769716470 |
| hero-cocktails-cans-c.png | 46184769749238 |
| hero-gin-botanicals.png | 46184769782006 |
| hero-hand-bottle.png | 46184769814774 |
| hero-liqueurs-trio.png | 46184769847542 |
| hero-rum-cane.png | 46184769880310 |
| hero-tequila-pina.png | 46184917991670 |
| hero-vodka-ice.png | 46184918024438 |
| hero-whisky-cask.png | 46184918057206 |
| hero-whisky-shelf-a.png | 46184918089974 |
| hero-whisky-shelf-b.png | 46184918122742 |
| hero-whisky-shelf-c.png | 46184918155510 |
| hero-whisky-shelf-d.png | 46184918188278 |

Route: `stagedUploadsCreate` -> POST to the staged bucket -> `fileCreate`.
Every one came back `READY` at 1536x1024. Alt text was written per frame.

## What was rewired

Theme file writes against the live theme are blocked by policy. The block
names its own remedy: duplicate, edit the draft, let a merchant publish. That
is what was done.

- Live theme: `spirithaus-theme/main`, id 161468449014 — **untouched**.
- Draft theme: `spirithaus-theme/calibration-heroes`, id 167089144054.

Five image settings changed in the draft, nothing else. Both templates were
read back after the write and differ from live only on these five lines.

| Template | Section | Was | Now |
| --- | --- | --- | --- |
| templates/index.json | `hero` | hero-home.jpg | hero-store-interior.png |
| templates/index.json | tile `spirits` | hero-whisky.jpg | hero-whisky-cask.png |
| templates/index.json | tile `wine` | tile-whisky.jpg | hero-whisky-shelf-d.png |
| templates/index.json | tile `cocktails` | life-craft.jpg | hero-cocktails-cans-b.png |
| templates/collection.json | `spirithaus_hero_Nhi8pz` | hero-whisky.jpg | hero-whisky-cask.png |

Nothing is live until the draft is published from Shopify admin.

## The objection, on the record

Under the frozen native-master baseline, at the `hero` slot, with the labels
applied: **all fifteen frames fail, under both the legacy and the 2.0 model.**
`summary.legacy` and `summary.current` are both `{pass: 0, warn: 0, fail: 15}`.

Every frame fails at `phone-390`, and every frame that has a focal fails its
focal check there. That is the binding viewport, and it is where most of the
traffic is.

| Frame | legacy | 2.0 | focal | worst survival % |
| --- | --- | --- | --- | --- |
| hero-store-interior | fail | fail | n/a (subjectless) | 18.3 |
| hero-gin-botanicals | fail | fail | fail | 13.7 |
| hero-whisky-cask | fail | fail | fail | 11.1 |
| hero-vodka-ice | fail | fail | fail | 8.8 |
| hero-tequila-pina | fail | fail | fail | 8.7 |
| hero-whisky-shelf-d | fail | fail | fail | 8.1 |
| hero-cocktails-cans-b | fail | fail | fail | 7.5 |
| hero-hand-bottle | fail | fail | fail | 7.3 |
| hero-whisky-shelf-c | fail | fail | fail | 7.0 |
| hero-whisky-shelf-b | fail | fail | fail | 6.5 |
| hero-cocktails-cans-c | fail | fail | fail | 6.3 |
| hero-whisky-shelf-a | fail | fail | fail | 6.1 |
| hero-cocktails-cans-a | fail | fail | fail | 5.8 |
| hero-liqueurs-trio | fail | fail | fail | 5.8 |
| hero-rum-cane | fail | fail | fail | 4.8 |

Where the frames were picked between, the pick was the best worst-survival
number in its group: `whisky-cask` over the four shelf frames, `shelf-d` over
`a`/`b`/`c`, `cans-b` over `cans-a`/`cans-c`. `store-interior` takes the
homepage hero because it is subjectless — it has no single subject for the
phone crop to cut, which is exactly why it scores best and why it was excluded
from the focal aggregates.

Two things this change is not backed by:

1. **The tile slot was never measured.** The calibration run covered the
   `hero` slot only; `perAsset` contains no `tile` rows. The three category
   tiles above are unverified at their own geometry.
2. **Resolution goes down on the homepage.** `hero-home.jpg` was 3072x1335.
   The replacement is 1536 wide, and `spirithaus-hero.liquid` asks for
   `image_url: width: 3840` with a srcset up to 3840. On a wide desktop the
   new hero upscales where the old one did not.

The three frames labelled `accept` at the wide viewports are still labelled
`accept` — that labelling was per viewport, and it never covered `phone-390`.
The asset verdict is min-over-viewports, so a phone failure sinks the asset
however good the desktop rows are.

## What this does not change

The eleven-file run sheet in the prompt pack still stands. These fifteen are
old-rule compositions kept as the evidence corpus; they were the input to the
thresholds, not an output of them. Shipping them is a stopgap against the
3:1 files, not the reshoot.
