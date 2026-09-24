# Spirithaus — catalogue coverage, 23 September 2026

Measured directly against the live store through the Shopify Admin API, not
from an export. Every published product was read; nothing is sampled or
estimated.

## The counts do not say what we thought

| | |
|---|---|
| Products in the store | **351** |
| Active | 217 |
| Draft | **134** |
| **Published to a sales channel** | **205** |
| Unpublished | **146** |

The working number is **205**, not 280. Two separate gaps produce that:

- **134 drafts.** Invisible to everyone. Whether that is deliberate staging or
  an unfinished import is worth knowing — it is 38% of the catalogue.
- **12 products are active but unpublished.** Active in the admin, no
  storefront URL. These are the dangerous ones: they look finished in the
  product list and cannot be crawled, bought or linked to. Nothing in the
  admin flags them.

## 🔴 Barcodes: the markup fires on two products

| | count | share of 217 active |
|---|---|---|
| Valid barcode on every variant | **2** | 0.9% |
| Present but malformed | 0 | — |
| **No barcode at all** | **215** | **99.1%** |

The product JSON-LD emits `gtin8/12/13/14` typed by barcode length. With no
barcode there is no GTIN, so the strongest product-matching signal Google has
is absent from 215 of 217 products.

Nothing is broken. The markup is correct and is doing exactly what it should
with the data present — which is why this needed measuring rather than
inspecting. Correct markup over empty fields looks identical to correct markup
over full ones.

Not malformed is worth noting too: no barcode is currently being silently
dropped for being the wrong length. The problem is absence, not corruption.

**Retrofitting is far more expensive than importing.** Every SKU added from
here should carry its barcode at import.

## 🔴 A third of published products have no description

| | count | share of 205 |
|---|---|---|
| **Empty description** | **66** | **32.2%** |
| Under 40 words | 24 | 11.7% |
| Word count | min 13 · median 58 · max 316 | |

Sixty-six product pages give Google and an AI assistant nothing to read
beyond a title and a price. They cannot rank for anything but the exact
product name, and they cannot be cited at all — an assistant answering "what
does this taste like" has no text to answer from.

This is the largest content gap on the store and it is invisible in the admin,
where an empty description looks the same as a full one until you open it.

## ✅ Duplicate descriptions are not a problem

This was the risk worth checking at scale — supplier boilerplate pasted across
a catalogue is the standard way a large store reads as thin. It is not
happening here.

Only **6 products in 3 groups** share text, and all three are the same product
in two sizes:

- `maybe-sammy-old-fashioned` / `-500ml`
- `absolut-vodka` / `absolut-vodka-lime`
- `jim-beam-white-label` / `-kentucky-straight-bourbon-1-ltr`

Worth differentiating eventually, but this is housekeeping, not a content
problem.

## ✅ The other schema inputs are clean

| | |
|---|---|
| Missing vendor (`brand` in the schema) | **0** |
| Missing featured image | **0** |
| Missing product type | 1 |
| No SKU on any variant | 4 |
| Distinct vendors | 119 |
| Product types | Wine 58 · Whisky 38 · Gin 29 · RTD 26 · Tequila 17 · Rum 16 |

119 vendors across 205 products is a genuinely broad independent range, and
`brand` being populated on every one is what makes the product schema work at
all.

## ✅ Done 2026-09-23: 10 of the 12 published

Published to the Online Store, taking the storefront from **205 to 215**:

| | Price |
|---|---|
| Appleton Estate 12 Year Old Rare Casks | $85.00 |
| El Dorado 12 Year Old | $109.00 |
| El Dorado 15 Year Old | $136.99 |
| Plantation Xaymaca Special Dry | $89.00 |
| Plantation 3 Stars White Rum | $69.99 |
| Penfolds Koonunga Hill Shiraz | $14.99 |
| Penfolds Koonunga Hill Cabernet Sauvignon | $14.99 |
| Tapanappa Whalebone Vineyard Merlot Cabernet Franc | $95.00 |
| Aberlour A'bunadh Single Malt | $154.99 |
| Winding Road Cane Spirit | $85.00 |

Zero inventory was not a blocker: `tracksInventory` is `false` across the
store, including on already-published lines like Yamazaki 12 and Lagavulin 16,
so stock is not what was holding these back.

The last two carry no description and go straight onto the list of 66.

### Tequila Blu — priced and published

Owner supplied sell $75.99 / cost $49.99. Set and live; storefront now **216**.

| | |
|---|---|
| Price | $75.99 |
| Unit cost | $49.99 AUD (gross margin 34%) |
| SKU | `SH-TEQ-BLU-700` |
| Product type | Tequila — was blank |

The blank product type mattered as much as the price: with eleven types in
use, a product with none falls out of every type-based collection and menu,
so it would have gone live and still been effectively unreachable.

**Assumption to check: the SKU says 700mL.** Nothing in the product record
states a bottle size, and the store's SKU convention encodes it. Seven of the
eight existing tequilas are 700, so that is the house default — but it is a
guess, and if the bottle is a 750 the SKU needs the last segment changed.

### Lark Devil's Sonnet was the wrong product — replaced 2026-09-24

The listing was misnamed. It is **Lark Devil's Storm No. 183 Single Malt
Australian Whisky, 700mL**, and the owner supplied the correct copy and
figures. Replaced in place rather than recreated, so the product keeps its
images and history.

| | was | now |
|---|---|---|
| Title | Devil's Sonnet Tasmanian Single Malt | Devil's Storm No. 183 Single Malt Australian Whisky |
| Handle | `lark-devils-sonnet` | `lark-devils-storm-no-183` |
| Price | $209.99 | **$199.99** |
| Cost | $189.00 | **$180.00** |
| SKU | `…-DEVILS-SONNET-500` | `SH-WHY-LARK-DEVILS-STORM-183-700` |
| Description | empty | two paragraphs, producer copy |
| Metafields | none | abv 42, volume_ml 700, country, region, producer, style |

The handle changed because the URL carried the wrong product name. Shopify
creates the redirect automatically, and nothing on this domain is indexed yet,
so the cost is zero now and would not have been later.

**The 10% margin was not a typo.** $19.99 on $199.99, against $20.99 on
$209.99 — both figures moved together, so this is a genuinely thin line rather
than a mistyped cost. The earlier flag is answered.

**`standard_drinks` is deliberately empty.** 700mL at 42% computes to roughly
23.2, but this repository's own rule is that the figure comes off the bottle
label and is never derived, because a computed number that disagrees with the
label is a compliance problem rather than a display bug. It needs reading off
the bottle.

Also worth checking: the product kept the image from the Sonnet listing. If
that photograph is of a different bottle it now sits under the wrong name.

### Superseded — the Devil's Sonnet entry below is kept for the record

Owner supplied sell $209.99 / cost $189.00.

| | |
|---|---|
| Price | $209.99 |
| Unit cost | $189.00 AUD |
| SKU | `SH-WHY-LARK-DEVILS-SONNET-500` |

The SKU size came from the sibling product rather than the house default:
Lark Classic Cask, same distillery, is `SH-WHY-LARK-CLASSIC-CASK-500`. Lark's
core range is 500mL, so 500 is the better inference than the 700 most of the
catalogue uses.

**Margin is 10%** — $20.99 on $209.99, against 34% on Tequila Blu. Plausible
for an allocated bottle where the margin is thin by nature, but worth a second
look in case the cost is a typo.

### 🔴 A mistake worth recording

The first attempt passed a variant ID that had never been read back from the
API — it was invented, not looked up. The earlier product query had returned
prices but not variant IDs, and the gap got filled rather than noticed.

Worse than the wrong ID was the ordering. The price update and the publish
went in **one mutation**, and GraphQL executes top-level fields
independently: the price update failed on the bad ID while the publish
succeeded. For a few minutes the store had a $0.00 bottle of single malt
live and orderable — precisely the outcome the product had been held back to
avoid.

Checked afterwards: the only two orders in the store are both Nobby's Salted
Peanuts test orders, one from 15 September and one from today at 10:37. No
Lark order, no $0.00 order. No harm done.

**The rule this earns:** never put a publish in the same mutation as the write
that makes publishing safe. Set the price, read it back, then publish. And
never pass an ID that has not been returned by a query in the same session.

Publishing this would put **a bottle of single malt on a public storefront at
zero dollars**, orderable by anyone who found it. It needs a price and a SKU
before it goes live, and that is a decision about the product, not about SEO.

A note on verification: `productsCount` lagged by several minutes and reported
7 still unpublished when the product list showed 2. The list is authoritative;
the counter is eventually consistent. Do not use the count to confirm a write
took effect.

## ✅ Done 2026-09-24: image alt text — 275 alts across 182 products

Measured across all 217 active products. The 40% sample taken earlier
understated it badly:

| | count | share |
|---|---|---|
| Product images total | 313 | |
| **Blank alt before** | **275** | **88%** |
| Products with at least one blank | **182** of 217 | 84% |
| Blank alt after | **0** | — |

Written locally, applied in four `fileUpdate` batches of ~70, then verified by
re-reading the media of every published product. No `userErrors` on any batch.

The rules the text was generated under, because each one is a way this goes
wrong at scale:

- **Existing alt is never overwritten.** Only blanks were filled. Hand-written
  alts (`Yamazaki 12 Year Old Single Malt Whisky`, `Karu Affinity Gin`) survived
  untouched.
- **No noun.** Not "bottle of". The catalogue holds cans, cocktail tins and a
  bag of salted peanuts; a wrong noun is worse than no noun. The volume carries
  the format implicitly.
- **The volume suffix is suppressed when the title already states a size.**
  Otherwise `Jack Daniel's Old No. 7 1 Ltr` becomes `…1 Ltr, 1000mL`. Detected
  by regex over ml/l/ltr/litre/cl/g/kg/pk/pack.
- **Secondary images get `, image N`** rather than an invented description.
  Nobody has looked at image 4; describing it would be fabrication, and a
  screen reader is better served by an honest ordinal.
- **ALL-CAPS titles are normalised in the alt only** — a screen reader spells
  caps out letter by letter. Three titles needed this. The product titles
  themselves remain a defect (see below).

Result: every image on every published product now carries alt text — e.g.
`Four Pillars Rare Dry Gin, 700mL`, `Laphroaig 10 Year Old Single Malt Whisky,
image 2`, `Nobby's Salted Peanuts 170g`.

Alt text is a weaker ranking signal than it was, but it is the only text Google
Images has, it is an accessibility obligation on a retail site, and on a store
where a third of products have no description it is briefly the *only*
machine-readable text on those pages.

### Two data defects surfaced in passing

- ~~🔴 **Vendor typo: `Four Pilars`**~~ — **fixed 2026-09-24.** Vendor maps to
  `brand` in the product JSON-LD, so this was publishing a misspelled brand
  entity to Google. Corrected to **`Four Pillars Gin`**, not `Four Pillars`:
  the store's other four Four Pillars products all use `Four Pillars Gin`, and
  correcting the spelling into a third spelling would have left the brand split
  anyway. All five now share one vendor string; the typo returns no products.
- **`BELLARINE DISTILLERY TARTY TED - SPARKLING COCKTAIL 250ML`** is the only
  ALL-CAPS product title. Normalised in the alt; the title itself still shouts
  in search results and in the page `<h1>`.

## Descriptions: 39 of 69 written, 2026-09-24

### The count, measured again

Re-measured directly rather than trusted. Across all **217 active** products,
**69** have an entirely empty description — the same 32% the earlier pass
found, three higher because three of the newly published products carried
none either.

The useful finding is not the total but where it sits. The gap is not spread
evenly; it is whole categories:

| | empty | of |
|---|---|---|
| Whisky, Scotch, Irish, Japanese, Bourbon | ~39 | the block |
| Tequila | **17** | 17 — every one |
| Karu Distillery, entire range | **10** | 10 — every one |
| Odds (Bundaberg, Bacardi, Winding Road, McGuigan) | 4 | |

Gin, rum, wine and RTD are almost fully described. So this was never a
catalogue-wide content problem; it is three untouched blocks. That changes
the work from a 69-item slog into three coherent passes.

### Written and live: 39

The whisky block, in two passes — the 20 highest-value Scotch, Japanese and
blended lines first, then the remaining single malts, Irish whiskey and the
Australian and Indian distillers.

Each is two short paragraphs: what it is and where it comes from, then how it
tastes and how to drink it. Roughly 70–110 words, which is enough for Google
to have something to rank and enough for an assistant to answer "what does
this taste like" without inventing an answer.

**The rule these were written under: no numbers that belong on a label.** No
ABV, no standard drinks, no cask counts presented as fact where the producer
has not published one. Prose describes character; figures come off the bottle
and go in metafields. This is the same rule that left `standard_drinks` empty
on the Devil's Storm, applied consistently.

Where a producer's own account is well documented — Aberlour's double-cask
marriage, Amrut's two barleys, Lark restarting Tasmanian distilling after 153
years — that is in the copy, because it is checkable and it is exactly what a
citation engine quotes. Where nothing is documented, nothing was invented.

### Remaining: 30

| | count | note |
|---|---|---|
| Tequila | 17 | Straightforward; well-documented producers |
| **Karu Distillery** | 10 | **Needs research, not recall** |
| Winding Road, McGuigan Black Label Red | 2 | |
| Hibiki 700mL | 1 | Deliberately skipped — see below |

Karu is a small independent and its range is not something to write from
memory. Those ten need the producer's own material read first, or they will
read plausibly and be quietly wrong — which is worse than blank.

## 🔴 Hibiki is listed twice

Two active products, both live:

| handle | vendor | inventory | created |
|---|---|---|---|
| `hibiki-japanese-harmony` | House of Suntory | 0 | 1 Sept |
| `hibiki-japanese-harmony-700ml` | Suntory | 12 | 4 Sept |

Same whisky, two pages, two prices ($199.99 and $199.00), two vendor spellings.
Duplicate listings compete with each other for the same query and split
whatever authority either earns. The one customers can actually buy is the
second; the one created first has no stock.

Not merged here, because deleting or redirecting a product is the owner's call
and the stock sits on the newer one. The description was deliberately written
on one only — giving both the same copy would have made the duplication worse.

## ✅ Second vendor defect fixed

`penfolds-koonunga-hill-shiraz-cabernet` carried the vendor **`SPIRITHAUS`**
while its two siblings carried `Penfolds`. Vendor is `brand` in the product
schema, so the store was publishing itself as the producer of a Penfolds wine.
Corrected to `Penfolds`.

Worth noting the pattern: `SPIRITHAUS` appears to be what a product gets when
nobody set a vendor. The peanuts legitimately have it. A wine does not.

## 2026-09-24, later: 63 descriptions written — and the store moved underneath

### Where it landed

| | |
|---|---|
| Empty descriptions at the start | **69** of 217 active |
| Written this session | **63** |
| Still empty | **4** |
| Filled by someone other than me | **2** |

63 + 4 + 2 = 69. The reconciliation is exact, and the last column is the
finding — see below.

Written, in three passes:

| Block | Count |
|---|---|
| Whisky, Scotch, Irish, Japanese, Indian, Australian | 39 |
| Tequila | 16 |
| Karu Distillery | 5 |
| Tequila Blu, Winding Road, McGuigan Black Label Red | 3 |

### The four left are left deliberately

`karu-pourtrait-gin`, `karu-house-vodka`, `karu-outcask-old-fashioned` and
`karu-morita-grapefruit-soda`. Karu has published nothing findable about these
four. The other five in their range are written because the producer *has*
described them — Affinity's Daintree vanilla and Hawkesbury pomegranate,
Lightning's IWSC 2021 trophy for best contemporary gin, Morita's vapour-infused
chipotle, Outcask's re-used casks, Orsa being built on Affinity rather than
neutral spirit.

Four blanks is the correct outcome here. Copy that reads plausibly and is
quietly wrong is worse than a blank, and on a small independent distiller it is
also a discourtesy to them. These need Karu's own words, which the owner can
get by asking.

Direct fetches to `karudistillery.com.au` return `EGRESS_BLOCKED` from this
session, as the repository's own note warns. Web search works, which is how the
other five were sourced.

## ✅ The store was being edited in parallel — owner confirmed

Detected from the API, then confirmed by the owner: **the drafting was
deliberate and theirs.** Recorded because the detection matters more than the
answer did — a bulk write against a catalogue that is moving is a different
risk from one against a static catalogue, and nothing in the process was
watching for it until now.

Three independent signs, all inside this session:

**1. Products moved from active to draft.**

| | start of session | now |
|---|---|---|
| Active | 217 | **190** |
| Draft | 134 | **160** |
| Total | 351 | 351 |

Twenty-seven products switched, nothing deleted. The batch timestamped
`02:23` is the fine-wine block — Henschke Hill of Grace, Torbreck RunRig, Jim
Barry The Armagh, Best's Thomson Family Shiraz, Yalumba The Octavius,
Clonakilla Shiraz Viognier — plus **Lark Devil's Storm No. 183**.

**2. Two products gained descriptions I did not write.** `karu-rested-morita`
and `hibiki-japanese-harmony-700ml` were both empty in the first sweep and both
carry copy now. The Rested Morita text is Karu's own marketing voice
("We've taken our globally acclaimed World's Best Infused Vodka…"), so someone
is pasting producer copy into the Karu range — exactly the four-product gap
above.

**3. A product type changed.** `karu-rested-morita` read `Tequila` in the first
sweep and reads `Vodka` now.

### What this means for the work

**Two products I worked on are now drafts: deliberate, and fine.** Lark Devil's
Storm No. 183 and Tequila Blu were both drafted by the owner on purpose. The 23
September work on them is not lost — price, SKU, product type, metafields and
copy are all still on the products, ready for whenever they are published.

Worth keeping in view: both now carry full descriptions and correct data while
being invisible to search. That is a *deliberate* version of the 12
active-but-unpublished products found on 23 September, and the two should not be
confused when the storefront count is next measured.

**It also changes how writes should be sequenced from here.** Every batch in
this session was built from a snapshot, then applied minutes later. That was
safe while nobody else was in the admin. It is not safe now: a description
written by the owner between the snapshot and the write would be silently
overwritten, with no version history in Shopify to recover it from.

The rule that follows: **re-read a product's description immediately before
writing it, not once for the whole batch.** Cheap, and it is the only thing
standing between a bulk write and destroying someone's work.

## Order of work

1. ~~Publish the 12 active-but-unpublished products~~ — **done**, all 12.
   The two held at $0.00 were priced by the owner and are live.
2. ~~Write the missing descriptions~~ — **63 of 69 done.** Four left, all
   Karu, all needing the producer's own copy. Two were filled by someone else.
3. ~~Fill blank image alt text~~ — **done**, 275 alts, full coverage.
4. **Barcodes at import, from now on, without exception.** Backfill the
   existing 215 when convenient; never add a new SKU without one.
5. **Decide about the 134 drafts.** Either finish and publish them or accept
   they are not part of the store.

## Not measured here

Metafield coverage — `abv`, `volume_ml`, `standard_drinks`, `style`, `region`,
`country`, `producer`. These feed the spec table and `additionalProperty`, and
`standard_drinks` in particular is what an AI assistant answers with. They need
a separate metafield query; the counts above say nothing about them.
