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

5. **The two draft Moëts still need their bottling confirmed.** Both are DRAFT
   and tagged `to-confirm`. `moet-chandon-vintage` does not say which year, and
   Grand Vintage is released by year; `moet-chandon-rose` could be Rosé
   Impérial NV or a Grand Vintage Rosé. Both now have SEO and body copy, but
   written at house and category level — see below. Still empty on both:
   `why_we_stock_it`, `abv`, `standard_drinks` and `style`.

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

**Body copy written for the two draft Moëts.** Both had empty
`descriptionHtml`. Each now carries two paragraphs, matching the house pattern
where `descriptionHtml` is producer-style copy about the wine and the store's
own voice is reserved for `why_we_stock_it`.

The angle for each is what is actually verifiable:

- **Vintage** — what declaring a vintage means (single year's fruit, no reserve
  wines), and the ageing rule that follows from it: three years minimum on lees
  under the appellation against fifteen months for non-vintage. It says the
  vintage year is shown on the bottle, which is true and avoids the page
  claiming a year nobody has confirmed.
- **Rosé** — that Champagne is the one French appellation permitting rosé by
  blending still red wine into white, and that the colour and structure come
  from pinot noir and meunier handled that way rather than from skin contact.

Every claim is about the house or the category, so both read correctly whichever
cuvée these turn out to be. Neither asserts a year, an ABV or a tasting note
specific to one bottling; the red-fruit note is framed as what rosé Champagne
does as a style. Both drafts are also recorded in `drafts/moet-drafts.md`.

**Three fields left empty on purpose.** `why_we_stock_it` is built on real
numbers on every other Champagne — Moët's cites 27.41% of the NSW champagne
segment — and I have no equivalent figure for these two. `abv`,
`standard_drinks` and `style` are also blank: Moët's cuvées are not uniformly
12%, and standard drinks is a legally significant figure in Australia that must
match the label, so it is not a number to estimate.

**Three Moët & Chandon products corrected.** The house name was wrong in every
field that carried it, and in two different ways:

| Handle | Was | Now |
|---|---|---|
| `moet-et-chandon-brut-imperial-nv` | Moet & Chandon Brut Imperial NV | Moët & Chandon Brut Impérial NV |
| `moet-chandon-vintage` | Moet Chandon Vintage | Moët & Chandon Vintage |
| `moet-chandon-rose` | Moet Chandon Rose | Moët & Chandon Rosé |

Fixed on each: product title, `vendor`, and the `custom.producer` metafield.
Vendor was previously split across two spellings — "Moet & Chandon" and "Moet
Chandon" — which fragmented the brand in any vendor-faceted filter; all three
now read `Moët & Chandon`. The Brut Impérial body copy was also mixed, opening
with "Moet & Chandon" and switching to "Moët" mid-paragraph; normalised, along
with its SEO title and description.

**SEO written for the two that had none.** `moet-chandon-vintage` and
`moet-chandon-rose` had null title and description tags. Both now follow the
house product pattern — `<Name> <volume> | <differentiator>`, no brand suffix,
which is how the rest of the catalogue is written:

- **Vintage** — title 54 chars, description 140
- **Rosé** — title 52 chars, description 143

**Deliberately general, and here is why.** Both are DRAFT and tagged
`to-confirm`, the store's own marker for unverified stock, and neither has body
copy or an ABV. "Vintage" carries no year, and at $156.99 and $115.99 the rosé
could be Rosé Impérial NV or a Grand Vintage Rosé. So the copy states only what
is certain — producer, Épernay, 1743, Champagne, 750ml, and what
vintage-declared means as a category — and asserts no year, no tasting notes
and no ABV. Once the bottling is confirmed, both deserve a rewrite with the
real detail.

Also added to both drafts: `custom.producer`, `custom.country` (France) and
`custom.region` (Champagne), which they lacked entirely.

**Handles were not touched**, so no redirects were needed — the URLs still read
`/products/moet-...` and the redirect table is unchanged at three entries.

**Brand casing normalised to SPIRITHAUS, and the Moët typo cleared.** All 28
collection SEO titles ended `| Spirithaus`; they now end `| SPIRITHAUS`,
matching the wordmark, the Shopify shop name and the six articles. Three page
metafields also read "Spirithaus" and were corrected: the `contact` title tag,
and the `terms` and `privacy` description tags. The other five pages already
used SPIRITHAUS.

Casing is the same character count, so no title changed length — still 33–59
characters, none truncating.

**A trap worth recording.** `collectionUpdate` with `seo: { title }` alone does
**not** leave the description untouched — it writes null over it. I found this
by testing the pattern on one collection before batching, and had to restore
`bourbon`'s description. Every subsequent update passed both fields. Anyone
scripting Shopify SEO changes should assume the same for the whole `seo` object.

**Moët & Chandon** now carries its diaeresis in the three places that had it
wrong: the `sparkling` meta description, the `sparkling` body copy and the
`champagne` body copy. The `champagne` SEO fields were already fixed in the
previous pass.

Checked and found already correct: all six blog articles, five of the eight
pages, and every product — no product SEO uses a brand suffix, and the one
product matching "spirithaus" does so through a `vendor` field that already
reads SPIRITHAUS.

**Collection SEO — audited and corrected, not written from scratch.** By the
time I came to this, SEO titles and meta descriptions already existed on 28 of
28 category collections, along with body descriptions, and they were good —
close to the article voice. The store had clearly had substantial work done: a
lot of new product, and the `under-50` and `specials` rules rebuilt from tag
matches to `VARIANT_PRICE < 50` and `IS_PRICE_REDUCED`, which is why both pages
went from empty to 185 and 1.

So this pass was an audit against SERP limits rather than authoring. What was
actually wrong:

**Five titles ran past ~60 characters and would truncate mid-phrase.** Trimmed,
keeping each author's wording and the strongest query terms:

| Collection | Was | Now |
|---|---|---|
| `white` | 63 | 58 — "Sauvignon Blanc" → "Sauv Blanc" |
| `cocktails` | 62 | 53 — dropped Curatif, which the canned page owns |
| `canned-cocktails` | 64 | 54 — Curatif & Four Pillars, dropped Brookie's |
| `single-malt` | 62 | 56 — region terms in place of "Scotch, Japanese, Australian" |
| `champagne` | 65 | 57 — dropped Cristal, which stays in the description |

**Seven descriptions sat at 99–117 characters**, wasting roughly a third of the
available SERP space: `liqueurs-aperitifs`, `white`, `under-50`,
`new-this-month`, `staff-picks`, `moscato`, `specials`. Extended to 144–155
using facts already in each collection's own body copy — nothing invented.

The `champagne` fix also corrected **Moet → Moët**. The same typo remains in the
`sparkling` description, which is under length and so was not otherwise touched.

**One compliance change, in body copy rather than meta.** The
`canned-cocktails` description read "Cans travel where bottles are not welcome
— picnics, the beach, anywhere glass is a problem." Most NSW and Victorian
beaches, parks and foreshores are alcohol-free zones, and ABAC requires
marketing not to encourage consumption contrary to law. Rewritten to keep the
author's point — lighter, quicker to chill, no glass — and a short note added
pointing to local alcohol-free zone rules, matching the age-restriction note
the `low-no` page already carries.

**`frontpage` (Home page) left null deliberately.** It is Shopify's system
collection, not a category page; the storefront homepage takes its SEO from
Online Store preferences, so a title here would be inert.

Verified after the changes, reading back from the live store rather than from
what I sent: 28 of 28 populated, titles 33–59 characters, descriptions 121–155,
no duplicate titles, every one carrying the brand suffix. The full set is
recorded in `collection-seo.json` beside this file.

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
