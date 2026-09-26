# Spirithaus — can ALM tell us the vintages?

**Date:** 2026-09-26. Spirithaus only.
**Question asked:** which vintage is the Henschke Hill of Grace we have live at $949.99?

## Short answer

**ALM cannot tell us.** Hill of Grace does not appear anywhere in either ALM
file — not the 6,922-row core extract, not the 159-row fine-wine export.

More broadly, ALM is a poor vintage source: only **39 of 7,081 rows** carry an
explicit four-digit year.

## What ALM could supply — 4 of 30

| Product | Vintage | ALM source row |
|---|---|---|
| Penfolds Grange | **2017** | `PENFOLDS GRANGE SHZ 17GB 750ML` |
| Bollinger La Grande Année | **2015** | `BOLLINGER LA GRANDE ANNEE 2015 750ML` |
| Moët & Chandon Dom Pérignon | **2015** | `DOM PERIGNON 2015 GB EOY LIMITED EDITION 750ML` |
| Krug Grande Cuvée | **NV** | `KRUG GRANDE CUVEE NV GIFT750ML` |

Grange's year is encoded as `SHZ 17`, not a four-digit year — the two-digit
form after the variety code. That pattern is why a naive year search misses it.

### ⚠️ Two flags on those four

**Dom Pérignon was costed from a gift box, not a plain bottle.** The source row
is `DOM PERIGNON 2015 GB EOY LIMITED EDITION` — an end-of-year limited-edition
gift pack. Our product is listed as the plain bottle at $590.99. Either the
product should say it is the gift edition, or the cost is for the wrong SKU.

**These are ALM's listings, not your stock.** ALM saying it lists the 2017
Grange tells you what was orderable when the extract was taken. It does not
confirm which vintage you would actually receive, and vintages roll. Treat them
as strong candidates to verify, not as confirmed facts.

## What ALM cannot supply — 22 live products

All live, all vintage-dependent, all currently sold with no year stated:

Krug Vintage ($982.99) · Dom Pérignon Rosé ($971.99) · **Henschke Hill of Grace
($949.99)** · Louis Roederer Cristal ($529.99) · Veuve Clicquot La Grande Dame
($456.99) · Taittinger Comtes de Champagne ($450) · Jim Barry The Armagh
($419.29) · Torbreck RunRig ($330) · Best's Thomson Family Shiraz ($249.99) ·
Yalumba The Octavius · Cullen Diana Madeline · Clonakilla Shiraz Viognier ·
Howard Park Abercrombie · Irvine Grand Merlot · Duckhorn Napa Valley Merlot ·
Tapanappa Whalebone · Petaluma Coonawarra · d'Arenberg The Dead Arm · Yalumba
The Menzies · Chandon Vintage Brut · Jansz Tasmania Vintage Cuvée · Woodlands
Cabernet Merlot

Three of those (Krug Vintage, La Grande Dame, Dom Pérignon Rosé) **are** in ALM,
but the description carries no year — `KRUG VINTAGE GB 750ML`. A wine whose
name is literally "Vintage" and whose year is unrecorded is the clearest case
for confirming from the bottle or the invoice.

## No vintage needed — 6

Solera-aged or non-vintage by definition, so nothing to confirm:
Penfolds Grandfather (20YO), Penfolds Great Grandfather (30YO), Morris Old
Premium Rare Muscat, Yalumba Antique Tawny, Krug Grande Cuvée, Tequila Blu.

## Method note

The first pass joined products to ALM rows on cost alone, which produced
nonsense — "Casali del Barone Barolo 2020" matched `HAVANA CLUB ANOS 7YO`
because the costs happened to be equal. Cost is not a unique key. Adding a
name-match guard rejected 68 spurious matches and left 45 verified ones, of
which 11 added a vintage not already in the product title.

## Worksheet

`seo/spirithaus/worksheets/vintage-confirm-2026-09-26.csv` — all 30 live
`to-confirm` products, with the ALM vintage pre-filled where it exists, the ALM
source row for checking, and blank columns for the actual vintage and any
missing cost.

---

# Part 2 — current-release research for the 22

Owner's decision: keep them live, research the likely current release for each.
Done. Worksheet: `seo/spirithaus/worksheets/vintage-research-2026-09-26.csv`

**Read this as "the vintage a customer would expect to receive if you ordered
today", not as a statement about your stock.** For a retailer ordering on
demand that is usually the same thing, but it is an inference, not a fact.

| Confidence | Count |
|---|---:|
| HIGH — a dated release announcement or the producer's own current-release page | 6 |
| MEDIUM — cited as current by a reputable source, no release date found | 9 |
| LOW — conflicting or thin evidence | 4 |
| NONE — could not establish | 3 |

## HIGH confidence — 6

| Product | Vintage | Basis |
|---|---|---|
| Henschke Hill of Grace | **2022** | 2022 Single Vineyard Collection released globally 6 May 2026 |
| Krug Vintage | **2013** | Krug's own July 2026 release list |
| Taittinger Comtes de Champagne | **2008** | Described Jan 2026 as just out of the cellar |
| Cullen Diana Madeline | **2024** | Released May–June 2026 at Cullen's Icon Release dinners |
| Clonakilla Shiraz Viognier | **2024** | Clonakilla's own 2024 release page |
| Tapanappa Whalebone | **2021** | Current release per the producer |

Hill of Grace at **2022** also sanity-checks against your $949.99 — that is
about right for the current release, which is a good sign the price was set
against the right wine.

## MEDIUM — 9

Dom Pérignon Rosé 2009 · Jim Barry The Armagh 2023 · Howard Park Abercrombie
2023 · Irvine Grand Merlot 2016 · Duckhorn Napa Valley Merlot 2023 · Petaluma
Coonawarra 2021 · Yalumba The Menzies 2022 · Chandon Vintage Brut 2019 ·
Jansz Vintage Cuvée 2021

## LOW — 4. Do not publish these years without checking.

- **Louis Roederer Cristal** — 2016 was cited as latest in 2025, but a 2008
  late release also launched in June 2026. Genuinely conflicting.
- **Veuve Clicquot La Grande Dame** — the house lists 2018, 2015, 2012 and 2008
  together without marking which is current.
- **Torbreck RunRig** — the only dated evidence is a 2016–2021 vertical pack.
- **Best's Thomson Family** — made roughly six times a decade, so vintages skip
  and "most recent found" is unreliable.

## NONE — 3

**Yalumba The Octavius** and **d'Arenberg The Dead Arm** — searches were
inconclusive.

**Woodlands Cabernet Merlot** — a different problem. Woodlands make several
cabernet merlots at different tiers (Wilyabrup Valley, the Margaret Reserve
Cabernet Merlot Malbec). At $41.99 ours is presumably the entry Wilyabrup, but
**the product itself is ambiguous, not just the vintage.** Worth confirming
which wine this listing actually is before worrying about the year.

## Two things worth acting on beyond vintages

**Irvine Grand Merlot may be under-priced.** The 2016 is listed overseas around
$199. Ours is $119.99 with no cost recorded, so the margin is unknown and
possibly negative. Check this one against your invoice before anything else.

**Tapanappa Whalebone is not what the title says.** The current release is
53.5% cabernet sauvignon, 16% merlot, 16% cabernet franc and 14.5% shiraz — a
four-variety blend. Our title calls it "Merlot Cabernet Franc", which describes
an older bottling.

## Recommendation

Apply the 6 HIGH-confidence vintages to titles and SEO once you give the nod —
that turns `Henschke Hill of Grace` into `Henschke Hill of Grace 2022`, which
is both accurate and the query people actually search.

Leave the 9 MEDIUM until you have checked a bottle or an invoice. Do not touch
the 4 LOW or the 3 NONE.

---

# Part 3 — correction: vintage does not belong in the title

**Owner supplied, 2026-09-26:** Dan Murphy's lists Krug Vintage as
*"Current Vintage 2006* — Vintage is not guaranteed and may vary store to store
or when delivered."* And ALM says vintage varies batch to batch.

**This overturns the Part 2 recommendation, and Krug is the proof.**

Krug Vintage was my single highest-confidence call — **2013**, taken from Krug's
own July 2026 release list. Dan Murphy's is shipping **2006**. The producer's
current release and what the Australian retail channel actually ships are
different things, by seven years in this case.

So the recommendation to "apply the 6 HIGH-confidence vintages to titles" was
wrong. A year in the title is a promise, and this supply chain cannot keep it.
It would also need re-editing every time a batch turned over, on a store where
titles feed the sitemap, the canonical URL and the product schema.

## What replaced it

The pattern the major retailers already use: show the vintage as an explicitly
**indicative** figure beside the other specs, never as part of the product's
identity.

- `custom.current_vintage` metafield — created in the store. Single-line text,
  so `2022`, `NV` and a range are all equally expressible.
- Spec table row, below Alcohol, guarded on `!= blank`. An unknown vintage
  renders nothing — blank is the right value, and an empty row would read as
  "we do not know" rather than "not stated".
- The value and the disclaimer live inside the same guard, so the figure can
  never render bare.
- The caveat is repeated in the JSON-LD property name
  (`Current vintage (indicative, not guaranteed)`) because a machine reading
  the feed never sees the on-page note. Vintage is kept out of the `Offer`
  block — it is not part of the offer.

Pull request: `singhajay001/spirithaus-theme` **#7**, 17 assertions passing in
`patches/vintage.py`.

## No values were populated

Deliberately. Every vintage in the Part 2 research is an inference about the
producer's current release, and Krug demonstrates that this is not what lands
in the box. The field should be filled from what the supplier actually ships.

The Part 2 research is not wasted — it is a reasonable starting guess to check
a delivery against — but it is not publishable as-is.

## What this also settles

The 30 products tagged `to-confirm` are **not** unsafe to have live for want of
a vintage. They are missing an indicative spec and a disclaimer, which is a gap
to close rather than a reason to unpublish. My earlier suggestion to pull the
22 back to draft was based on treating a missing vintage as a broken promise;
in fact no promise was ever made, and the fix is to state the position
explicitly rather than to hide the products.

## Merged and deployed

PR #7 merged as `de5fad4` (squash). Shopify's GitHub integration synced
`spirithaus-theme/main` at 06:48:12 UTC — `sections/main-product.liquid`,
`snippets/product-structured-data.liquid`, `assets/spirithaus.css` and
`locales/en.default.json` all updated.

Verified by reading the deployed file back rather than trusting the timestamp:
the `current_vintage` property is present in the live theme, the caveat is in
the property name, and it sits in `additionalProperty` — not in the `offers`
block. The field is empty on every product, so nothing renders yet; the row
appears the moment a value is set.

**To use it:** Shopify admin → the product → Metafields →
*Current vintage (indicative)*. A year, `NV`, or a range. Leave it blank
rather than guess — blank renders nothing, which is the honest state.

---

# Part 4 — the six HIGH values set

**Owner's instruction:** set the HIGH-confidence ones to the researched year,
with a caveat that vintage may vary batch to batch.

Done, with **one correction** — see below.

| Product | Value set | Source |
|---|---|---|
| Henschke Hill of Grace | **2022** | AU producer, released 6 May 2026 |
| Cullen Diana Madeline | **2024** | AU producer, released May–June 2026 |
| Clonakilla Shiraz Viognier | **2024** | AU producer's own release page |
| Tapanappa Whalebone | **2021** | AU producer's current release |
| Taittinger Comtes de Champagne | **2008** | Producer, out of cellar Jan 2026 |
| Krug Vintage | **2006** | ⚠️ **not** the researched 2013 — see below |

## The Krug correction

The research said 2013, from Krug's own July 2026 release list, and it was my
highest-confidence result. Setting that would have repeated the exact mistake
this whole exercise exists to correct.

**Dan Murphy's is shipping 2006.** That is direct evidence from the Australian
retail channel, and it beats the producer's release calendar by seven years.
Where the two disagree, the channel wins — it is the one describing what
actually arrives in Australia.

2006 is set instead. If your ALM delivery turns out to be something else,
change it; the field exists precisely because that can happen.

## An unevenness worth knowing

The four Australian wines are materially safer than the two champagnes.
Hill of Grace, Diana Madeline, Clonakilla and Tapanappa are Australian
producers selling into the Australian market with no import lag, so the
producer's current release and what a Sydney retailer receives are usually the
same thing.

Krug and Taittinger are imports, which is the exact category where the channel
lags — as Krug just demonstrated. **Taittinger's 2008 carries the same risk as
Krug's 2013 did** and has not been cross-checked against an Australian
retailer. Treat it as the least reliable of the six.

## Caveat wording

Aligned to the supplier's own phrasing, PR #8, merged as `8136abc` and synced
at 06:53:04 UTC:

> Indicative only — vintage may vary from batch to batch and is not guaranteed.

"Between deliveries" described the symptom; "batch to batch" describes the
cause, and is the language ALM itself uses.

## Live now

`/products/krug-vintage` and `/products/henschke-hill-of-grace` among the six.
The row renders under Alcohol in the spec table, with the disclaimer on its own
line beneath the year. The other 24 `to-confirm` products are unchanged and
render no vintage row at all, which remains the correct state while the year is
unknown.

---

# Part 5 — Cristal settled from the same source

**Owner supplied** the Dan Murphy's listing for Louis Roederer Cristal:
**Current Vintage 2014**, same "not guaranteed, may vary store to store"
wording.

Cristal was one of the four **LOW** confidence cases — my research found 2016
cited as latest in 2025 and a separate 2008 late release launched June 2026,
which was genuinely contradictory. Channel evidence settles it. **2014 set.**

That is now two of the four LOW cases resolved by Australian retail listings
rather than producer announcements, which confirms the pattern: for imported
champagne, the producer's release calendar is the wrong source and a local
retailer's listing is the right one.

## Specs filled from the same listings

Cristal already carried every spec in that listing — country, producer, region,
style, volume, standard drinks 7.11, ABV 12.0 — so only the vintage was new.

**Krug had almost nothing**, just volume. Filled from the listing supplied
earlier: region Champagne, country France, producer Krug, style Champagne,
ABV 12.0, standard drinks 7.1.

Both standard-drinks figures were checked against the label maths rather than
taken on trust: 750 mL × 12% × 0.789 ÷ 10 = 7.10, against Krug's 7.1 and
Cristal's 7.11. They agree, so there is no discrepancy between the listing and
what the bottle would state — which matters, because standard drinks is
regulated and the theme deliberately never computes it.

These specs are not cosmetic. `producer` becomes `brand` in the product
JSON-LD, and the rest render as `additionalProperty`, so Krug's page went from
almost no structured detail to a full set.

## Not used: the Dan Murphy's description

The listing copy was supplied too:

> "One of the finest Champagnes around, this Louis Roederer Cristal will take
> any celebration to the next level…"

**Deliberately not used.** It is Dan Murphy's copyright, and duplicating a
competitor's product description is the opposite of what these pages need —
duplicate text is a reason for Google to prefer the original and discount ours.
Cristal already has its own copy written for this store. Specs are facts and
can be shared; prose cannot.

## Vintage coverage now

7 of the 30 `to-confirm` products carry a vintage: the six HIGH ones plus
Cristal. The remaining 23 render no vintage row, which stays correct until
their year is known.

---

# Part 6 — duplicate retailer copy found and removed

**Owner's instruction:** rewrite the Dan Murphy's information so we give Google
no reason to discount us.

Checking before writing turned up something worth knowing: **Cristal's live
product page was carrying Dan Murphy's copy word for word.**

> "One of the finest Champagnes around, this Louis Roederer Cristal will take
> any celebration to the next level. A blend of Pinot Noir and Chardonnay gives
> this Cristal its varietal charm, with plenty of bubbles for a tingling
> mouthfeel."

Plus a second paragraph hardcoding the vintage disclaimer into the body text,
which now duplicated the one the theme renders from the metafield.

## It is not systemic — one product out of 486

All 486 product descriptions were scanned for retailer-copy fingerprints:
the disclaimer sentence, Dan Murphy's marketing phrases, their page furniture
("Read less", "Product specifications", "Write the first review"), pasted spec
blocks and any link to their domain.

**One hit. Cristal.** Every other description is original. That is the good
news — this was a single paste, not a habit, and it is now fixed.

## What replaced it

Both champagnes rewritten from the *facts* rather than the words. Facts are not
copyrightable; expression is. The house voice is the same two-paragraph shape
as the other 55 descriptions written this session — what it is and why, then
how it actually tastes and how to serve it.

**Cristal** now leads on the 1876 commission for Tsar Alexander II and the
clear, flat-based bottle still made to that specification, then the estate-grown
fruit and the pinot-led blend. The hardcoded disclaimer paragraph is gone — the
theme renders it properly from `current_vintage`, so keeping a second copy in
the body text would have been both redundant and a maintenance trap.

**Krug Grande Cuvée** gained the substance from your paste, written fresh: 146
wines across eleven years, 1998 to 2016, at roughly 44/36/20 pinot noir,
chardonnay and meunier, then seven more years in the cellars after blending.

The Édition-specific numbers are framed as **"the 172ème Édition, for
instance"**. That matters: those figures change with every recreation, so
stating them flat would go stale exactly the way a vintage in a title does. As
an illustration of how the wine is built they stay true whichever Édition is in
the box.

Also kept: Krug's own suggestion of Indian food. It is distinctive, genuinely
useful, and nothing like the interchangeable champagne copy every other
retailer runs.

## What was deliberately left out

- **Dan Murphy's prose**, in any form.
- **The 97-point James Suckling score.** It attaches to one Édition, and a
  score asserted on a page whose contents change is a claim that quietly
  becomes false.
