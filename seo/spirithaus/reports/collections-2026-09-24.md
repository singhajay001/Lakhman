# Spirithaus — collection pages, 24 September 2026

## The gap

Measured across all 29 collections:

| | before | after |
|---|---|---|
| Collection description | **1** of 29 | **23** of 29 |
| SEO title | **0** of 29 | **23** of 29 |
| SEO description | **0** of 29 | **23** of 29 |
| Collection image | 0 of 29 | 0 of 29 — still open |

Only `bourbon` had any description at all.

## Why this was the largest unblocked item on the store

Product pages and collection pages rank for different things. A product page
competes for "Lagavulin 16 700ml"; a collection page competes for "buy
australian gin online", "japanese whisky sydney", "champagne delivery". The
second set is where the volume is, and it is the set Spirithaus was not
competing for at all.

Until today every collection page rendered as a bare grid: an `<h1>`, a list of
product names and nothing else. That is byte-for-byte what every other liquor
retailer's category page looks like, with less text. There was nothing on the
page for Google to rank on and nothing for an assistant to cite.

It also compounds the brand problem already recorded in the audit. `spirithaus`
and `spirithouse.com.au` are homophones, so brand queries are contested and
partly unwinnable. That pushes the whole strategy onto category and product
long-tail — which runs through exactly these pages.

**The theme renders them.** `sections/spirithaus-collection-hero.liquid` line
184 outputs `collection.description` when `show_description` is on, and
`templates/collection.json` has it on. Checked before writing anything, because
filling a field the theme ignores is the failure mode this project keeps
hitting.

## Written: 22 collections

Two short paragraphs each — what is actually in the range, named producers and
regions, then a buying steer. Roughly 60–100 words, server-rendered, no
JavaScript required to read it.

| | |
|---|---|
| Spirits | spirits, gin, whisky, single-malt, bourbon (SEO only — it had copy), tequila, rum, vodka, liqueurs-aperitifs |
| Wine | wine, red, white, sparkling, champagne, rosé, fortified-dessert, fine-wine, moscato |
| Other | australian-made, cocktails, staff-picks, low-no |

The copy names real producers the store actually carries — Four Pillars, Lark,
Husk, Winding Road, Karu, Henschke, Torbreck — rather than describing the
category in the abstract. That is what makes a passage quotable: an assistant
answering "who sells Australian cane spirit in Sydney" needs a sentence that
says Husk and Winding Road, not one that says "a curated range".

`bourbon` already had a description and it was **not overwritten**, only given
the missing SEO fields. Same rule as the alt text and the product copy.

Alcohol constraints held throughout: no urgency or scarcity language, no
encouragement of volume drinking, nothing that would appeal to under-18s, and
the `low-no` page states that non-alcoholic lines are still not marketed to
minors.

## 🔴 Seven collections left alone, and they need a decision rather than copy

| Handle | Products |
|---|---|
| `under-50` | **0** |
| `new-this-month` | **0** |
| `specials` | **0** |
| `frontpage` | 1 |
| `canned-cocktails` | 1 |
| `gifting` | 1 |
| `premium-collabs` | 2 |

Writing a description for an empty collection would be dressing up a page that
has nothing on it. **Three of these are entirely empty and still crawlable** —
an indexed page with a heading and no products is a thin page, and a handful of
them drags on the whole domain.

Each needs one of three things, and it is a merchandising call rather than an
SEO one:

- **fill it** — `under-50` and `new-this-month` are both good pages if they are
  populated, and `under-50` should be an automated collection with a price
  condition so it never empties again
- **merge it** — `canned-cocktails` (1 product) duplicates `cocktails` (27)
- **noindex it** — `specials` while there are no specials

## Still open on these pages

- **No collection has an image.** That is the social preview card for every
  category URL shared anywhere, and the fallback chain currently lands on the
  logo.
- **`templates/collection.json` appends a third section** — `spirithaus-hero`,
  the homepage hero — after the grid on every collection page. Worth confirming
  that is deliberate rather than left over from a theme edit.

---

# Done: the seven thin collections, and images on all 28

## They were never broken — nothing was ever tagged

All six of the thin collections are **automated collections driven by tags**,
and the tags were simply never applied to any product. `under-50` looked for a
tag `under-50`, `specials` for `on-special`, `canned-cocktails` for `canned`.
No product carried any of them.

Two of the six should never have been tag-driven at all, and were rebuilt:

| Collection | Was | Now |
|---|---|---|
| **Under $50** | tag `under-50` | rule **`VARIANT_PRICE < 50`** |
| **Specials** | tag `on-special` | rule **`IS_PRICE_REDUCED`** |

A price tag goes stale the moment a price changes — and twelve gin prices
changed earlier today, which would have silently falsified it. A price *rule*
cannot go stale. `Under $50` went from 0 products to **195**.

The other four were populated by tagging the right products:

| | was | now |
|---|---|---|
| Canned Cocktails | 1 | **13** |
| Premium & Collabs | 2 | **13** |
| Gifting | 1 | **12** |
| New This Month | 0 | 0 — see below |

`canned` was applied only to products that are actually in cans: the six
Curatif 130mL, Brookie's G&T, Four Pillars Yuzu, the three Naked Life, Bellarine
and Karu's soda. The Maybe Sammy range and Starward's negroni are **bottles**
and were deliberately excluded, since a collection called Canned Cocktails that
contains bottles is worse than one with two products in it.

`Premium & Collabs` was given a definition it did not have: bar
collaborations. The Maybe Sammy range — a Sydney bar on the World's 50 Best
list bottling its own cocktails — is a genuine collaboration. The "Premium"
half of that title still needs the owner's definition; it currently overlaps
with Gifting.

**New This Month stays empty on purpose.** Shopify's smart-collection rules
have no "created in the last 30 days" condition, so this one genuinely does
need a tag, applied as stock arrives. It has copy and an SEO title ready for
when it fills. Until then it should be excluded from the sitemap rather than
indexed empty.

## Images: 28 of 29

Every collection now has an image except `frontpage` — Shopify's built-in
homepage collection, which is not a landing page.

They are representative product shots drawn from each collection's own range,
uploaded to the collection, with descriptive alt text. That closes the social
preview gap: before today every category URL shared anywhere fell back to the
logo.

**These are a stopgap and should be said to be one.** A bottle on white is not
a designed category card. Purpose-made 1200×630 images, with the category name
set in the brand's type, would be materially better for link previews and for
the collection grid. What is there now is real, accurate and better than
nothing.

The first product in each collection turned out to be a poor hero — sorting put
a 375mL tawny at the front of Wine and a bag of peanuts at the front of
Under $50 — so each image was picked by hand instead.

## 🔴 Three defects the new rules exposed

**1. Inverted compare-at prices.** The `IS_PRICE_REDUCED` rule immediately
pulled in two products whose `compareAtPrice` sits *below* their price:

| Product | Price | Compare at |
|---|---|---|
| Nobby's Salted Peanuts 170g (**active**) | $3.99 | $2.00 |
| Tapanappa Whalebone (draft) | $95.00 | $70.00 |

A compare-at price is a claim about a former higher price. Inverted, it is
meaningless data, and it is what put a bag of peanuts into Specials. The active
one was cleared. The draft one is flagged.

**2. The drafts are an unpriced import, not a staging decision.** The price rule
surfaced a long list of draft products sitting at **$0.00** — Krug Grande
Cuvée, Dom Pérignon, Pol Roger Sir Winston Churchill, Veuve Clicquot La Grande
Dame, House of Arras, Seppeltsfield Para 21, and many more.

This answers a question open since 23 September. The 160 drafts are not
deliberately held back; they cannot be published because **they have no
prices**. That reframes the job from "decide about the drafts" to "price the
import", and it is worth knowing before anyone tries to publish them in bulk.

**3. Lark Classic Cask's product image is a bottle of Nikka.** The featured
image file is `NIkka-Whisky-from-the-Barrel-500ml…webp`. Wrong product, on a
$199 bottle. Found while picking collection heroes; it was not used. The same
class of error as the Glenfiddich/Glenlivet mismatch recorded earlier in this
project, and worth a sweep of the other product images rather than assuming it
is the only one.
