# CLAUDE.md

## What this repository is

`singhajay001/Lakhman` holds the **image pipeline** for SPIRITHAUS — an online
bottle shop in Sydney trading as SPIRITHAUS PTY LTD, under NSW packaged liquor
licence LIQP700301260 held by Trafalgar Cellars of Marsfield.

Everything lives under `docs/spirithaus/`. There is no application here and
`lakhman-platform` is an empty placeholder left over from the repository's
earlier life.

**This repository is public.** No credential, token or store secret goes in it,
in any file, ever — not in a tool, not in an example, not in a report. The
Shopify Admin API token lives only in GitHub repository secrets. The tooling is
built around this: fetching a theme needs credentials and is a manual step you
run yourself; parsing is pure and offline, so the output can be reviewed in a
pull request like any other diff.

## The one rule that matters most

**Scenes may be generated. Packshots may not.**

`docs/spirithaus/image-prompt-pack.md` produces hero frames, category bands,
tiles and lifestyle shots. It must never be used for product photography.

An image model cannot reproduce a real label. A fabricated Applewood or Curatif
bottle on a product card is a misrepresentation problem, not a style problem —
and on a liquor site it is the kind that attracts a regulator rather than a
design critique. Packshots come from the brand's Australian distributor, or
from a real shoot. Never from a model, and never lifted from BWS or
Dan Murphy's, whose images are licensed to them.

The two workstreams are complementary and neither substitutes for the other:

| | Scenes | Packshots |
|---|---|---|
| Lives | here | `spirithaus-theme`, `docs/image-sourcing.csv` |
| Source | generated to the prompt pack | distributor asset library, or a real shoot |
| Covers | hero, category heroes, tiles, lifestyle | the ~72 active products with no usable image |

## What is here

```
docs/spirithaus/
  image-prompt-pack.md      system prompt, shot list, negative prompt
  scrim-proof.html          the measurement tool
  safe-zone.svg             the overlay
  theme-profile.json        generated from the live theme — never hand-edit
  theme-profile.schema.json
  calibration/              the regression corpus and its inputs
  fonts/                    theme faces, embedded so measurement is host-independent
  reports/                  step 2-5 findings
  theme/                    generated theme files — never hand-edit
  tools/                    the generators
```

**Scrim Proof** measures whether a frame survives what the theme actually does
to it: a scrim at 58% on heroes and 66% on tiles, and a centred cover crop that
throws away the outer thirds on a phone. A frame that looks fine in a folder can
be unusable in the slot, and the tool is how you find out before the shoot
rather than after.

## Things that will catch you out

**`calibration/hero/` is a regression corpus, not a set of finished assets.**
Fifteen 1536x1024 frames, kept so a calibration run is deterministic and
reproducible by anyone with the repository. They are well under the 3840px the
hero slot needs. Do not ship them as heroes.

**Generated files are generated.** `theme-profile.json` is built from the live
theme, and `theme/templates/page.scrim-proof.liquid` is built from
`scrim-proof.html` by `tools/build-theme-page.mjs`. Editing either by hand forks
it from the version the repository tests. Regenerate instead.

**`page.scrim-proof.liquid` is deliberate, not cruft.** It appears in the theme
repository as a Shopify sync commit and looks like a stray 2,100-line template.
It is Scrim Proof as a staff-gated storefront page, rendered only for a
logged-in customer tagged `staff`, checked server side. Do not delete it.

**The tools are plain Node.** Only `node:` builtins — no package.json, no
install step, no lockfile. Keep it that way; a dependency here buys very little
and costs a supply chain.

## The theme is not in this repository

The Shopify theme lives in **`singhajay001/spirithaus-theme`, branch `main`**,
which is what Shopify's GitHub integration syncs. Do not restore a theme here
and do not connect Shopify to this repository.

That repository also holds the rest of the project's documentation — pricing
policy, shipping and GST setup, the notification templates, the social plan, the
photography brief, and `docs/image-sourcing.csv`, which is the live list of
products still needing a real photograph.

## House rules

These hold across both repositories.

- **Australian English.** Prices are GST-inclusive. Mobile-first at 375px.
  WCAG AA.
- **ABAC and NSW liquor law are hard constraints, not guidelines.** No frame
  showing anyone drinking, anyone who could be taken for under 25, more than two
  drinks, or anything implying volume or speed. No vehicles, water or machinery
  near alcohol. No countdown timers, fake scarcity or inflated RRP
  strikethroughs. Nothing that could appeal to a minor. The test is whether the
  page would look wrong to a sixteen-year-old who opened it.
- **Do not publish the licensee's personal name** on the storefront. The licence
  number and the trading entity are the public facts.
- **Never use `!important` before trying specificity.**
