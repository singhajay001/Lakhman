# Spirithaus — filling every remaining metafield gap
2026-09-26

Followed the sweep by filling every field that could be filled from a verifiable
source, and established precisely which gaps genuinely cannot be closed without
the bottle in hand.

## What was written

**520 values across 136 products**, every call with zero errors.

| | Before | After |
|---|---|---|
| LIVE `country` / `producer` / `style` | 251 / 250 / 249 | **257 / 257 / 257** |
| LIVE `why_we_stock_it` | 209 | **257** |
| LIVE all six core | 242 | 245 |
| NOT LIVE `country` | 47 | **177** |
| NOT LIVE `producer` | 52 | **181** |
| NOT LIVE `style` | 50 | **181** |
| NOT LIVE `region` | 31 | **160** |
| NOT LIVE all four identity fields | 27 | **160 of 182** |

## Method, and why it is not guesswork

`producer` came from the `vendor` field, which was already populated on all 182
drafts. `country`, `region` and `style` were derived by matching **appellation
and region tokens in the product title** against a hand-built map — Gevrey-
Chambertin, Chablis, Barolo, Barbaresco, Montalcino, Bolgheri, Chianti Classico,
Valpolicella, Sancerre, Chateauneuf-du-Pape, Crozes-Hermitage, Saint-Emilion,
Douro, Marlborough, Margaret River, Barossa, Coonawarra, Clare, Yarra,
Adelaide Hills, Hunter, Tasmania and so on. An appellation name *is* the region;
reading it off the label is not inference.

**The rule output was then reviewed line by line, and 22 errors were found and
corrected before anything was written.** They are worth listing, because they are
exactly what an unreviewed bulk fill would have put into the store:

- **Cloudy Bay Te Wahi** was assigned Marlborough because the producer rule fired
  first. Te Wahi is Cloudy Bay's **Central Otago** pinot noir. This was the worst
  of them and it would have been invisible once written.
- **Joseph Drouhin Morgon** came out as pinot noir. Morgon is Beaujolais, so the
  grape is **gamay**.
- **Cape Mentelle Wallcliffe Cabernet Franc** came out as cabernet sauvignon,
  because `cabernet` matched before `cabernet franc`.
- **Chateau Galeteau Saint-Emilion Grand Cru** came out as *brut champagne*,
  because the word "Cuvee" in its name matched the champagne rule ahead of the
  Bordeaux rule.
- **Beaurenard Chateau Blanc Chateauneuf du Pape** came out as a red blend. It is
  a white — the word "Blanc" sits before "Chateauneuf" in the title, so the
  white-specific pattern never matched.
- **House of Arras** bottlings came out labelled *champagne*. They are Tasmanian.
  Calling an Australian sparkling wine champagne is both wrong and not legal
  labelling; corrected to "sparkling" forms.
- **Yalumba Signature** came out as plain shiraz; it is a cabernet shiraz blend.
- **Oakridge 864 Syrah** came out as "Shiraz"; the label says Syrah.
- Plus style fills for Collet Vintage, Collet Rose, Moet Vintage, Moet Rose,
  Henschke Keyneton Estate (shiraz cabernet blend), Torbreck Struie, and
  region/country/style for Chateau d'Esclans and Peyrassol (Provence) and
  JF Moreau Mont de Milieu, whose title never mentions Chablis even though the
  vineyard is a Chablis premier cru.

**One product was deliberately excluded.** *Tar & Roses Local Hero Barolo* has an
Australian producer (Heathcote, Victoria) in the vendor field against an Italian
Barolo appellation in the title. One of the two is wrong and I could not tell
which, so nothing was written. **This needs a human look.**

## What cannot be filled, and why

**`abv` and `standard_drinks` — 150 drafts and 12 live products.** These are not
derivable from anything on file. They cannot be computed from price, region or
producer, and they are the two fields where a plausible-looking wrong number does
real harm: standard drinks is a regulated figure. Only one product in the whole
catalogue allowed a legitimate derivation — Lark Devil's Storm, where ABV and
volume were both already stored, giving 700ml x 42% x 0.789 = 23.2 standard
drinks. Everything else needs the label.

Of the 12 live ones, 8 are vintage wines where ABV moves vintage to vintage, one
is Aberlour A'bunadh (batch-variable cask strength, so no single value is
correct), two are genuinely unknown, and one is a bag of peanuts.

**`region` — 22 drafts.** Almost all are products with no meaningful sub-region:
Bacardi, Gordon's, Smirnoff, Johnnie Walker, Grey Goose, Aperol, Campari,
Captain Morgan, Kraken, Sailor Jerry, and the multi-regional Australian wines
(Yellowglen, Jacob's Creek, Eileen Hardy). Leaving these blank is correct;
inventing a region would be worse than an empty field. `country` is also blank on
Captain Morgan, Kraken and Sailor Jerry, all blends of Caribbean rums where the
only figure on record is the bottling country, which is not the origin.

**`rrp` — 194 live products. This one was not filled on purpose, and should not
be.** RRP is a supplier's recommended retail price. We do not hold it. The only
competitor figure available is Dan Murphy's *selling* price for 54 products, and
putting that into an RRP field would display it as a struck-through "was" price
on the live page. That is a misleading representation of a saving under
Australian Consumer Law, quite apart from being wrong. RRP should be populated
from supplier price lists or left empty.

**`barcode` — 282 products (148 live).** A GTIN cannot be invented: the check
digit makes a fabricated one verifiably false, and a wrong GTIN is worse than
none because it matches someone else's product in Merchant Center. Every barcode
recoverable from the ALM APN extract by item code has already been recovered.
The rest are ALM Connect lines, which carry no barcode on file at all, and need
scanning off the bottle.

**`cost` — 39 live products.** I cross-referenced all of them against the ALM
extract by barcode and exactly **one** was recoverable: Penfolds Koonunga Hill
Shiraz Cabernet, written at $11.28 (carton $67.67 / 6, matching the convention
already used across the catalogue — verified against three products whose cost
was already stored). The other 38 have no ALM row reachable by barcode.

## Worksheet

`worksheets/metafield-gaps-2026-09-26.csv` — rewritten, now 329 rows with the
remaining gaps only, live first, columns for ABV, standard drinks, region and
barcode to write into. 154 of those rows need nothing but ABV and standard
drinks, which is a single pass with the bottles in front of you.
