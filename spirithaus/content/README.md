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

1. **22 Ready-to-Drink products carry the `spirits` tag**, so pre-mixed cans
   and bottles — Curatif, Maybe Sammy, Brookies Gin & Tonic — sit alongside
   750ml bottles in `/collections/spirits`. Defensible either way, but worth a
   deliberate decision rather than an accident of tagging.

2. **`karu-morita-grapefruit-soda` has product type `Vodka`** but is a canned
   RTD. It is out of Spirits now, but the product type will mislead any
   type-driven filter or feed.

3. **Three published collections are still empty**: `new-this-month`,
   `specials`, `under-50`. Four more are thin: `low-no` (3), `gifting` (1),
   `canned-cocktails` (1), `premium-collabs` (2). Thin pages, poor landings.

4. **Two Aberlour titles omit "Single Malt".** `aberlour-12-year-old` and
   `aberlour-14-year-old` are titled "Double Cask Matured" with no category
   word. They are single malts and are tagged as such, but "single malt" is a
   strong commercial query and the product title is a ranking signal, so both
   titles are leaving something on the table.

5. **No collection has an SEO title or meta description set** — all 28 return
   null, and most have an empty description too. Category pages are the
   strongest commercial landings on the store and they are shipping with
   whatever the theme generates.

6. **Nearly everything reads as zero inventory.** If that is real rather than
   untracked, expect demotion from Shopping and organic over time.

**Done in this pass:** the duplicate Hibiki listing is resolved — the good copy
was ported to `hibiki-japanese-harmony-700ml` (the one with stock), a 301
redirect now points `/products/hibiki-japanese-harmony` at it, and the
duplicate is archived rather than deleted so it can be restored.

**Spirits collection rule — fixed.** The rule was
`tag:spirits OR tag:GIN OR tag:Australian`, applied disjunctively, so every
`australian`-tagged product landed in Spirits regardless of what it was. It is
now a single clause:

```
appliedDisjunctively: false
TAG EQUALS "spirits"
```

Two checks before changing it. The `GIN` clause was redundant — all 29 gins
already carry `spirits`, so dropping it removes nothing. The `Australian`
clause was the whole problem: 136 products rode on it alone (131 wines, 5
canned cocktails including the three non-alcoholic Naked Life items), of which
32 were active and customer-visible. All of them keep a home via their `wine`,
`cocktails` or `canned` tags.

Two products then refused to leave — `karu-morita-grapefruit-soda` and
`karu-outcask-old-fashioned` stayed in Spirits through a rule rewrite and a
product re-save. They turned out to be **manual members layered on top of the
rule**, not rule matches, so no tag or rule change could shift them;
`collectionRemoveProducts` cleared them. Worth knowing that this collection can
hold manual overrides the rule does not explain.

Result: the collection went from 289 to 153 products, which matches
`tag:spirits` exactly, and `product_type:Wine AND tag:spirits` now returns
**0**. Penfolds Koonunga Hill Shiraz, Pepperjack Barossa Shiraz and McGuigan
Black Label resolve to `wine`, `red` and `australian-made` only.

Nothing was lost in the other direction: no active Whisky, Rum, Tequila, Gin,
Bourbon, Brandy or Liqueur product is missing the `spirits` tag, so the rule
change dropped no real spirit.

**`low-no` collection rule — fixed.** The rule looked for `tag = low-no`, a
tag no product in the catalogue carries, so the page was empty. It now reads:

```
appliedDisjunctively: false
TAG EQUALS "non-alcoholic"
```

Changing the rule rather than retagging the products, because `non-alcoholic`
is the tag already in use and nothing else depends on `low-no`.

The collection now holds the three Naked Life products — Classic G&T, Pink
Paloma, Passionfruit Martini — all active. I checked for low- and no-alcohol
stock hiding under other naming (`zero`, `0.0`, `alcohol-free`, `alcohol free`)
and found none, so three is the true size of the range, not a rule artefact.
The page works now, but three products is still thin for a category landing.

**`single-malt` collection rule — fixed.** The collection had **no rule at
all**: it was a manual collection holding a single product, Aberlour A'bunadh.
Nothing in the catalogue identified a single malt, so there was nothing to
write a rule against — the tag had to be created first.

I classified all 52 whisky and whiskey products and tagged the 22 single malts
`single-malt`, following the hyphenated `staff-pick` / `non-alcoholic`
convention and matching the collection handle. The rule is now:

```
appliedDisjunctively: false
TAG EQUALS "single-malt"
```

The collection holds **22 products, 21 of them active** (Lark Devil's Storm No.
183 is in draft and will appear when published). That is up from 1.

Excluded as genuinely not single malt: **Monkey Shoulder** (a *blended* malt —
a vatting of three Speyside single malts, which is a different category),
**Starward Two-Fold** (double grain, malt blended with wheat), **Hibiki
Japanese Harmony** and **Nikka From The Barrel** (both blends), all Johnnie
Walker, Chivas Regal, Dimple and Royal Salute (blended Scotch), all Jameson
(Irish blend), and every bourbon and Tennessee whiskey.

Twenty of the 22 say "Single Malt" in the title, so the classification is the
catalogue's own. The two that do not are Aberlour 12 and Aberlour 14 Double
Cask Matured — both are core expressions of a Speyside single malt distillery,
which is why a title-matching rule would have been wrong here and a tag is the
right mechanism. It is also why those two titles are listed as still open
above.

This gives `articles/first-single-malt.md` a real destination: its
`/collections/single-malt` link previously landed on a one-product page.

**Maker's Mark duplicate resolved — deleted by the client, 301 added here.**
`makers-mark` (product type Whisky) was the duplicate of `makers-mark-bourbon`
(product type Bourbon). By the time I came to remove it, it had already been
**deleted outright** rather than archived: it returns null by handle and by ID,
and a title search finds only the keeper.

That left `/products/makers-mark` returning a 404, because Shopify does not
create a redirect when a product is deleted. Added:

```
/products/makers-mark  →  /products/makers-mark-bourbon
```

Nothing needed porting. The keeper is in better shape than most of the
catalogue already — full description, SEO title and meta description, and a
complete metafield set including `why_we_stock_it`, `rrp`, `abv`, `region` and
`standard_drinks`. Nothing in the published articles linked to the deleted
handle, so no internal links broke.

A note on the **Hibiki** pair, because the record here was out of date: the
archived duplicate has since been deleted and the keeper **renamed** from
`hibiki-japanese-harmony-700ml` to `hibiki-japanese-harmony`. The live redirect
now reads `-700ml → bare handle`, which is the reverse of what this file
previously described but is **correct given the rename** — it points the freed
URL at the live product. Left as is. The one live Hibiki listing is why the
Whisky collection reads 36 rather than 37.

Current counts after all of the above: Spirits **149**, Whisky **36**,
Bourbon & Tennessee **14**, Single Malt **22**, Low & No **3**.

**Bourbon split out of Whisky.** The Whisky collection was the only category
collection in the store built on a two-tag OR — `tag:whisky OR tag:whiskey` —
and the `whiskey` half was doing double duty, marking Irish whiskey *and* every
bourbon. That is why all 52 whisk(e)y products sat in one collection.

Rather than bolt an exclusion onto the rule, I brought Whisky in line with
every other category collection in the store, which is a single tag applied
conjunctively:

```
appliedDisjunctively: false
TAG EQUALS "whisky"
```

To make that work, three Jameson products that carried only `whiskey` were
given the `whisky` tag. Nothing was removed — the change is purely additive,
and the now-vestigial `whiskey` tag drives no collection.

`makers-mark` needed care: it is typed `Whisky` and tagged `whiskey`, so under
the new rule it would have dropped out of Whisky without landing anywhere. It
is a Kentucky straight bourbon, so it was tagged `bourbon`.

**New collection: Bourbon & Tennessee** (`/collections/bourbon`), rule
`TAG EQUALS "bourbon"`, 15 products. Published to Online Store, Point of Sale
and Shop — a new collection is published to no channel by default, so without
that step the URL would have been dead.

Titled "Bourbon & Tennessee" rather than "Bourbon" because Jack Daniel's,
Gentleman Jack and Tennessee Honey are Tennessee whiskey, a separate
designation from bourbon. The handle stays `bourbon` so the commercial query
keeps the URL, and the ampersand matches the house style already used by
Liqueurs & Aperitifs and Fortified & Dessert. One word to change if you
disagree.

Result: Whisky 52 → **37**, Bourbon **15**, and nothing orphaned —
`(tag:whisky OR tag:whiskey OR tag:bourbon) AND NOT tag:whisky AND NOT
tag:bourbon` returns 0.

**`karu-rested-morita` — confirmed fixed by the client.** Product type now
reads `Vodka`, tags `australian, spirits, staff-pick, vodka`. It stays in
Spirits on the new rule and now sits consistently in Vodka rather than being
split across Tequila and Vodka.

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
