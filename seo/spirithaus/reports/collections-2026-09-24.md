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
