# Step 9 — Reconnecting git, and making the shipped heroes reachable

Two requests that turned out to be one job: sort out the GitHub connection,
and give each collection hero some artwork instead of a bottle.

## What the GitHub connection actually is

`OnlineStoreTheme` exposes no GitHub field, so the Admin API cannot see the
connection at all — the only evidence is the badge on the theme card. Shopify
names a GitHub-connected theme `<repo>/<branch>`, and the theme called
`spirithaus-theme/main` is therefore repo `spirithaus-theme`, branch `main`:
`singhajay001/spirithaus-theme`, private, push access.

That theme stopped being the live one this morning. Since then the storefront
has been a duplicate, which no duplicate inherits a connection to. The result
is a two-way disconnection: pushes to the branch land in an unpublished theme,
and every theme-editor change made today exists only in Shopify.

The write-back still works, for the connected theme only. The repo's HEAD is
`Update from Shopify for theme spirithaus-theme/main` and it carries the 72%
scrim an owner set on that theme — so the mechanism is healthy, it is just
pointed at the wrong theme.

## The drift, measured rather than assumed

Every editor-writable surface was compared against live: both section groups,
all eleven JSON templates, `config/settings_data.json` and
`assets/spirithaus.css`. `settings_data.json` and `spirithaus.css` are
identical. The section groups and the other nine templates match.

The drift is exactly three files.

| File | Repo | Live |
| --- | --- | --- |
| `sections/spirithaus-collection-hero.liquid` | the original | scrim floor, mobile clamp, artwork precedence |
| `templates/index.json` | `hero-home.jpg`, 58%, old tiles | calibration frames, 70% |
| `templates/collection.json` | `hero-whisky.jpg`, 62%, 72% scrim | `hero-whisky-cask.png`, 70%, CTA link, an Artwork block |

A caution on comparing sizes: Shopify's `size` field is **not** byte length
for JSON templates — `collection.json` reports 970 where the file is 1725
bytes. It does match byte length for `.liquid`, which is why the checks
earlier in this project were sound. Comparing a Shopify `size` against a
repo's `wc -c` is not.

## Why the Whisky hero showed a Hibiki bottle

`sections/spirithaus-collection-hero.liquid` resolved artwork as
`collection.image` → Artwork block → shipped `assets/sh-hero-<handle>.jpg`,
and `collection.image` is set on all 25 collections to a catalogue bottle
shot. The eight frames lit for this band had therefore been unreachable since
the day they were committed.

Precedence is now Artwork block → shipped frame → `collection.image`. The
bottle shot keeps its real job — the collection card, and the image a share or
a search result uses — and stops being asked to be a hero. Nothing is cleared,
so the cards are untouched, and the seventeen collections with no shipped
frame still show their own image rather than a bare ink band.

## The measurement that changed the design

The floor was going to stay 20% for the shipped frames, on the schema's note
that they "measure 18:1 for white type at 0%". All nine were sampled in
Chromium instead, over the region the type covers:
`docs/spirithaus/tools/measure-hero-frames.cjs`.

| Frame | p50 | p99 | max | brightest pixel | needs |
| --- | --- | --- | --- | --- | --- |
| tequila | 0.004 | 0.384 | 0.809 | rgb(243,234,193) | 67% |
| cocktails | 0.002 | 0.131 | 0.778 | rgb(255,242,219) | 68% |
| rum | 0.010 | 0.357 | 0.863 | rgb(255,239,180) | 68% |
| home | 0.001 | 0.086 | 0.923 | rgb(247,247,235) | 69% |
| liqueurs | 0.001 | 0.076 | 0.945 | rgb(255,250,224) | 69% |
| gin | 0.008 | 0.709 | 0.992 | rgb(252,255,255) | 70% |
| vodka | 0.000 | 0.018 | 0.998 | rgb(254,255,255) | 70% |
| whisky | 0.003 | 0.256 | 0.976 | rgb(254,255,250) | 70% |
| spirits | 0.003 | 0.256 | 0.976 | rgb(254,255,250) | 70% |

The note was right about the typical pixel and wrong about the one that
decides readability. Median luminance is 0.000 to 0.010 — about 19:1, exactly
as recorded — but every frame carries specular highlights in the same region,
and against the brightest pixel under the type they need 67% to 70%.

So the source-aware floor is gone. It is 70% for every photograph, which also
removes a latent bug: once precedence made the shipped frames reachable, a 20%
floor would have put white copy on a white highlight across eight category
pages. Lowering it below 70 now requires a measurement, and the tool to take
one is in the repo.

One arithmetic correction worth recording: the first run of this tool stepped
alpha by `a += 0.01` and reported 63–71%. Floating-point accumulation reaches
0.7000000000000004, and `ceil` then returns 71 where the answer is 70. The
tool steps in integer percent.

### Whisky and Spirits are the same photograph

`sh-hero-whisky.jpg` and `sh-hero-spirits.jpg` are byte-identical (md5
`35a93c8e…`), as are their `-sm` crops. Both category pages will show the same
frame. Not a fault, but not a decision anyone made either.

## Delivery

Per the theme repo's own CLAUDE.md — never commit to `main`, work on a
`claude/*` branch, no PR unless asked — this is on
`claude/collection-hero-artwork-precedence`, two commits, `schema-lint.py` and
`check-liquid.py` both passing. That linter matters here: a bad `{% schema %}`
makes Shopify reject the whole file silently and cascade into every template
referencing it.

Merging it to `main` is the fix for both problems at once. Shopify syncs the
branch into `spirithaus-theme/main`, that theme then matches live plus the
artwork precedence, and publishing it puts a GitHub-connected theme back on
the storefront. After that, git is the source of truth again and editor
changes write back.

The alternative — another duplicate — would ship the artwork fix and widen the
drift, which is the thing this step exists to close.

## Left alone deliberately

- **`artwork_Gnybxb`** on the live collection template has `collection: ""`,
  so it matches no handle and does nothing. Under the new precedence a block
  with a real handle would outrank the shipped frame, so this one is worth
  either completing or deleting — but it is editor state someone set, not
  mine to guess at.
- **`spirithaus-theme/hero-artwork`** (167109624054) was duplicated to carry
  this change before the branch route proved better. It is unpublished and
  unused; delete it.

### Merged

`main` had moved while the branch was in flight — `9e14833 robots.txt: give
the AI crawler groups the wildcard rules (#5)`, touching
`templates/robots.txt.liquid` and `patches/robots-txt.py`, neither of which
this branch goes near. Rebased onto it rather than taking a merge commit,
re-ran both linters, and fast-forwarded: `main` is now `d281006`.

Shopify picked it up without prompting. The connected theme
`spirithaus-theme/main` (161468449014) now holds
`spirithaus-collection-hero.liquid` at 16921 bytes, and its
`templates/index.json` and `templates/collection.json` are byte-identical
both to the live storefront and to the repo. `assets/spirithaus.css` likewise.
The GitHub integration is healthy; it only ever needed pointing at a theme
that was live.

**Publishing `spirithaus-theme/main` is the remaining step, and it carries two
changes, not one.** The artwork precedence and the measured floor are the
intended one. The other is the robots.txt commit: it was merged to `main` by
somebody before today and has never reached the storefront, because the
storefront stopped being the connected theme. Live is on the old 2175-byte
robots template and the connected theme is on the new 4424-byte one. That is
almost certainly wanted — it was merged deliberately — but it ships as part of
this publish rather than on its own.

A note on the `size` field, which caused a wrong statement earlier in this
session and is now explained: it is not raw byte length, it is the size of
what Shopify stores. The same `templates/collection.json` content reports 970
on a theme where the editor wrote it and 1725 on a theme where GitHub synced
it, because the editor stores a compacted form. For `.liquid` the two agree,
which is why every byte check in steps 7 and 8 was sound. Compare content, not
`size`, across themes of different provenance.

The remote branch `claude/collection-hero-artwork-precedence` still points at
the pre-rebase commits: `--force-with-lease` refused on stale tracking info
and was not forced past. Its content is in `main`, so it is redundant and can
be deleted.
