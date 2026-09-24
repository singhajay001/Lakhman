# SPIRITHAUS — SEO content

Publish-ready articles for spirithaus.com.au, written against the live
catalogue (pulled from Shopify, 24 Sep 2026) so every internal link points at a
collection or product that actually exists.

## What's here

| File | Target query cluster | Intent |
|---|---|---|
| `articles/islay-whisky-guide.md` | islay whisky, peated whisky, smoky scotch | Informational → whisky |
| `articles/first-single-malt.md` | best single malt for beginners, speyside whisky | Informational → whisky |
| `articles/tequila-blanco-reposado-anejo.md` | blanco vs reposado vs añejo, tequila types | Informational → tequila |
| `articles/japanese-whisky-and-gin.md` | japanese whisky, japanese gin, hibiki, roku | Informational → whisky/gin |
| `articles/australian-spirits-guide.md` | australian whisky, australian gin, australian made spirits | Informational → australian-made |
| `articles/stocking-a-bar-for-an-event.md` | how much alcohol for a party, bar for 50 guests | **Commercial** → spirits/cocktails |

Each file carries YAML front matter with the title tag, meta description,
slug, primary and secondary queries, internal links and FAQ schema entries.

## A caveat you should hold me to

**I have no keyword tool and no verified search data.** These targets are
reasoned from your catalogue, your market and how people phrase these
questions — not measured. Before you commit a quarter to this, run the primary
queries through Search Console, Ahrefs, Semrush or even Keyword Planner and
re-rank. Treat the priority order here as a hypothesis, not a finding.

What I did not do: invent volume figures, difficulty scores or traffic
projections. Any SEO deliverable quoting those without a tool attached is
making them up.

## Internal linking

Collections referenced (all verified live):

`/collections/whisky` (52) · `/collections/tequila` (16) · `/collections/gin` (29)
`/collections/rum` (16) · `/collections/vodka` (15) · `/collections/spirits` (289)
`/collections/australian-made` (192) · `/collections/cocktails` (27)
`/collections/staff-picks` (21) · `/collections/liqueurs-aperitifs` (3)

Every article links **up** to its category collection and **across** to one or
two sibling articles. That is the whole internal-linking model — no orphan
posts, no link dumps.

## Before publishing — compliance

Alcohol marketing in Australia sits under the **ABAC scheme**, and a licensee's
own website content is generally in scope. These drafts were written to it:
no social, sexual or professional success framing; no suggestion that more is
better; no therapeutic or health claims; nothing that would appeal to
under-18s; responsible-service language where serving is discussed.

I am not your compliance adviser. Have someone who is read
`stocking-a-bar-for-an-event.md` in particular — quantity-planning content is
the piece most likely to attract scrutiny, and it is also the one most likely
to convert. ABAC runs a pre-vetting service.

Also confirm your site's age-verification arrangement covers the blog, not
just checkout.

## Catalogue audit — corrected 24 Sep 2026, 03:45

**A correction to what I reported earlier.** When I first pulled the catalogue
I found 15 of 20 sampled whiskies and all 16 tequilas with empty descriptions,
and said so. Re-checking after writing, the whisky range is now fully
described — `updatedAt` on those products had moved from 02:15 to 03:23–03:40,
i.e. someone was populating them while I worked. The finding was true when I
made it and is no longer true. The tequila half I fixed myself.

State of the spirits catalogue as of the last check:

| Category | Described | Empty |
|---|---|---|
| Whisky (imported) | 29 / 29 | — |
| Whisky (Australian) | 3 / 3 | — |
| Tequila | 15 / 15 | — *(written in this pass)* |
| Rum | 16 / 16 | — *(3 written in this pass)* |
| Vodka | 13 / 15 | 2 Karu |
| Gin | 26 / 29 | 3 Karu |

### The seven I did not write

All Karu Distillery (Richmond, NSW):

`karu-affinity-gin` · `karu-lightning-gin` · `karu-pourtrait-gin` ·
`karu-house-vodka` · `karu-morita-chipotle-vodka` · `karu-rested-morita` ·
`karu-outcask-wild-rum`

I have no reliable information about these specific expressions — what is in
them, how they are made, how they taste. Writing tasting notes for a product I
cannot identify is inventing claims on a live commercial page, so I stopped.

Send me the distillery's own copy, or one line per product on the base spirit,
botanicals or cask and the flavour direction, and they will take ten minutes.

### Still open, and not writing work

1. **The Spirits collection is pulling in wine.** Its rule is
   `tag:spirits OR tag:GIN OR tag:Australian`, applied disjunctively, so
   anything tagged `australian` lands in Spirits — Penfolds Koonunga Hill
   Shiraz, Pepperjack Barossa Shiraz and McGuigan Black Label are all in
   `/collections/spirits` right now.

2. **`karu-rested-morita` is mis-tagged.** Its product type is Tequila but its
   tags are `australian, spirits, staff-pick, vodka` — so it sits in the Vodka
   collection and not in Tequila. Separately, an Australian agave spirit cannot
   be labelled tequila at all; the product type is worth revisiting too.

3. **Four published collections are empty**: `low-no`, `new-this-month`,
   `specials`, `under-50`. Three more are near-empty: `gifting` (1),
   `canned-cocktails` (1), `premium-collabs` (2). Thin pages, poor landings.

4. **`single-malt` holds one product and has no rule**, while `whisky` holds 52.
   "Single malt" is a strong commercial query and that page is a dead end.

5. **Nearly everything reads as zero inventory.** If that is real rather than
   untracked, expect demotion from Shopping and organic over time.

**Done in this pass:** the duplicate Hibiki listing is resolved — the good copy
was ported to `hibiki-japanese-harmony-700ml` (the one with stock), a 301
redirect now points `/products/hibiki-japanese-harmony` at it, and the
duplicate is archived rather than deleted so it can be restored.

## Published

All six are live on the **News** blog at spirithaus.com.au, 24 Sep 2026:

| URL | |
|---|---|
| `/blogs/news/islay-whisky-guide` | Islay Whisky |
| `/blogs/news/first-single-malt` | Choosing Your First Single Malt |
| `/blogs/news/tequila-blanco-reposado-anejo` | Blanco, Reposado, Añejo |
| `/blogs/news/japanese-whisky-and-gin` | Japanese Whisky and Gin |
| `/blogs/news/australian-spirits-guide` | Australian Spirits |
| `/blogs/news/stocking-a-bar-for-an-event` | Stocking a Bar for an Event |

Published to the existing `news` blog rather than creating a second one. SEO
title and meta description are set per article via the `global.title_tag` and
`global.description_tag` metafields, which is where the Shopify admin reads
them from. Author is set to SPIRITHAUS.

Cross-links between articles use `/blogs/news/...` to match. If you later
rename the blog handle to something like `journal`, those three cross-links
need updating and the old URLs need redirects.

The markdown in `articles/` remains the source of truth — edit there and
re-publish, or edit in the Shopify admin and treat these as the drafts.
