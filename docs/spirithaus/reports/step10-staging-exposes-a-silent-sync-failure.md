# Step 10 — Staging exposed a sync that has been failing for 17 days

The staging theme was connected so the Champagne fix could be reviewed before
it shipped. Its first sync did something more useful: it uploaded the whole
branch from scratch, and three files did not arrive.

## What is missing from the staging theme

| Missing | Why |
| --- | --- |
| `sections/spirithaus-hero.liquid` | rejected |
| `sections/spirithaus-categories.liquid` | rejected |
| `sections/main-cart-footer.liquid` | rejected |
| `templates/index.json` | renders both rejected homepage sections |
| `templates/collection.json` | renders `spirithaus-hero` |
| `templates/cart.json` | renders `main-cart-footer` |

That is the cascade the theme repo's own CLAUDE.md warns about: Shopify
rejects a section silently, and every JSON template referencing it is invalid
and dropped too. Three rejections, three dead templates. `processing` is
false and `processingFailed` is false — nothing reports an error anywhere.

Everything else synced, including this session's
`spirithaus-collection-hero.liquid` at 17807 bytes. The sync is not broken in
general, only for these three files.

## It has been failing since 9 September

The repo and the live theme hold different versions of all three:

| Section | Repo | Live theme | Last changed on main |
| --- | --- | --- | --- |
| `spirithaus-hero.liquid` | 5027 | 4655 | 2026-09-09 "Stop the homepage hero being placed on collection pages" |
| `spirithaus-categories.liquid` | 7845 | 6041 | 2026-09-09 "Ship the homepage artwork too…" |
| `main-cart-footer.liquid` | 12388 | 10995 | 2026-09-24 "Free delivery threshold is $250…" |

So these are not corrupt files. They are real work, merged to `main`, that has
never reached the storefront:

- the homepage hero's overlay floor going 58 → 20 with a 45 default, and an
  `enabled_on` restricting it to the index template
- shipped `sh-tile-*.jpg` artwork for the category tiles
- the cart promo-code field, and the delivery threshold moving to $250

The live storefront is running the pre-9-September hero. Anyone reading the
repo would conclude otherwise.

## A correction to step 9

Step 9 said "the drift is exactly three files" and listed the collection hero
plus two JSON templates. That was wrong, and wrong in a way worth naming: the
comparison covered the editor-writable surfaces — both section groups, all
eleven JSON templates, `settings_data.json` — plus `spirithaus.css`, on the
reasoning that only the theme editor and I had written anything. It never
diffed the `.liquid` sections, because nothing in this session had touched
them. The drift was three files, but not the three I named.

The lesson is the one already in CLAUDE.md, learned again: with a sync in the
middle, verifying the repo proves nothing about the theme. Compare the file
lists.

## Cause not yet established

`enabled_on` with `presets` was the obvious suspect for the hero, since the
docs allow it but it would invalidate `collection.json`, which renders
`spirithaus-hero`. A minimal section carrying exactly that schema was uploaded
through `themeFilesUpsert` and Shopify accepted it with no `userErrors`. So
either the fault is elsewhere in the file, or the GitHub sync validates more
strictly than the Files API. `schema-lint.py` passes all three.

The next step is to upload each of the three whole files through the API and
read the `userErrors` Shopify returns — that is the only channel in this setup
that reports a reason at all.

## Consequences right now

- **Nothing about the live storefront changed.** `main` is untouched and the
  three old sections it holds are the same ones it has held since September.
- **The staging theme is not yet a usable preview.** Its homepage, every
  collection page and the cart have no template. The Champagne fix is on it
  and synced, but there is no collection template to render it with.
- **The Champagne fix is not blocked on its own merits** — it is blocked on
  staging being trustworthy.

## Left behind

`sections/zz-test-enabled-on.liquid` was uploaded to
`spirithaus-theme/hero-artwork` as the minimal reproduction above, and
`themeFilesDelete` is blocked by the same policy as theme deletion, so it
cannot be removed from here. That theme is unused and due for deletion; the
file goes with it.

## Resolved — four faults, all silent, none of them related

`themeFilesUpsert` names what the GitHub sync will not. Uploading the schemas
one at a time to a scratch theme produced an error per file, and they turned
out to be four different mistakes:

| File | Shopify's answer | The mistake |
| --- | --- | --- |
| `spirithaus-hero.liquid` | `setting with id="overlay_opacity" default must be a step in the range` | `min: 20, step: 2, default: 45` — 45 is odd, so unreachable |
| `spirithaus-categories.liquid` | same | `default: 55`, same range |
| `main-cart-footer.liquid` | `setting with id="promo_help" default can't be blank` | a text setting carrying `"default": ""` |
| `templates/collection.json` | `Section 'spirithaus_hero_Nhi8pz' is not supported on collection templates` | the template still renders a section now restricted to `index` |

The first two date from the 9 September commit that took the hero's overlay
`min` from 58 to 20. The old default of 62 was a step from 58; 45 and 55 are
not steps from 20. **Two odd numbers cost the homepage, every collection page
and the cart seventeen days of silent divergence.**

The fourth is the same commit's other half. It was titled "Stop the homepage
hero being placed on collection pages" and it added
`enabled_on: {templates: ["index"]}` to the section — but never removed the
instance already sitting in `templates/collection.json`. The section said
index-only while the template went on rendering it.

### Fixed

- defaults moved to 46 and 56, the nearest valid steps
- the empty default deleted rather than filled, which is what Shopify wants
- the index-only hero removed from the collection template, finishing what the
  September commit started

`schema-lint.py` gains both schema rules, because it passed all three files. It
now refuses an off-grid or out-of-bounds range default and any setting with an
empty default, and it was verified both ways — it flags the originals and
passes the fixes. All corrected schemas were then put through
`themeFilesUpsert` and accepted with no `userErrors`.

### One more thing the sync will not do

Fixing the sections was not enough on its own. Shopify's GitHub sync diffs
commits, so a file that was rejected once is never retried unless it changes
again. The three templates stayed missing even after their sections arrived.
They were written into the staging theme through the API instead — and Shopify
promptly pushed them back to the `staging` branch as two "Update from Shopify"
commits, which is the write-back working exactly as it should.

**The staging theme now holds all 404 files.** It is complete, and it is the
first honest preview this setup has had.

### What to look at, and the one visible change

The Champagne fix is on it: the portrait bottle fallback is gated, so Champagne
and Fortified & Dessert fall to a plain ink band instead of a slice through a
bottle.

Also on it, and worth judging deliberately because it changes a page: collection
pages lose the second hero band at the foot, below the product grid. That is
the September intent finally taking effect, not a new decision.

Not yet live. `main` is untouched; the fast-forward is the next step.
