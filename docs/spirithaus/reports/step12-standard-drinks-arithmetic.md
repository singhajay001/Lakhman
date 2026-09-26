# Step 12 — a legal figure nobody was checking

**Asked for:** the standard-drinks recompute.

**Result:** 38 of 228 live products corrected on the store and verified on the
storefront; the arithmetic is now a gate; two figures held back for the bottle
to settle; one unrelated red on `main` found and fixed on the way through.

---

## The figure is derivable, so it was never anyone's opinion

A standard drink is 10 g of ethanol and ethanol is 0.789 g/mL, so

```
standard drinks = volume_mL / 1000 × ABV% × 0.789
```

All three are product metafields (`custom.volume_ml`, `custom.abv`,
`custom.standard_drinks`), so every live listing can be checked against
itself. 228 live products had all three set. **38 disagreed with their own
arithmetic.**

It is published twice: as a spec on the product page, and inside the
schema.org `Product` block, which is what Google reads.

## What was wrong, in three kinds

**One figure that was simply wrong.** Taittinger Comtes de Champagne carried
**10.0**. 750mL at 12.5% is **7.4**. For 10.0 to be right the wine would have
to be 16.9% ABV, which no Champagne is — so the ABV is fine and the figure
was not. Overstated by 35%.

**One pair that contradict each other.** Jansz Tasmania Vintage Cuvée lists
**14.0% ABV** with **7.4 standard drinks**. 7.4 is what 12.5% gives, and 12.5%
is normal for the style; 14.0% is not. One of the two fields is wrong and the
data cannot say which.

**Thirty-six rounding inconsistencies.** Identical bottles carried different
numbers:

| spec | stored as | true |
|---|---|---|
| 40% / 700mL | **22.0 on 16 products, 22.1 on 31** | 22.09 |
| 43% / 700mL | 23.7 ×11, 23.8 ×1, 24.0 ×2 | 23.75 |
| 14.5% / 750mL | 8.3 ×1, 8.6 ×8 | 8.58 |

…and nine more specs like it. Chivas Regal 12 and Aberlour 12 are both 40% at
700mL and disagreed with each other on the shelf.

## What was done

38 products recomputed and written back with `metafieldsSet`, one decimal
place, half up — the convention already in the majority of the data. Taittinger
and Jansz deliberately left alone: recomputing a figure from a wrong ABV only
makes it consistently wrong.

Verified three ways: the mutation returned no `userErrors`; a fresh read of
all 38 matches both the intended value and the formula; and the live product
pages serve the new numbers (`chivas-regal-12` 22.1, `talisker-storm` 25.3,
`the-dubliner` 16.6, `morris-of-rutherglen` 10.1), with Taittinger correctly
still on 10.0.

## The check that would have caught it

`docs/audit-export.py` checked that ABV and standard drinks were *present* and
never that they were *right*, and `preflight.py` gated on the same. Both now
do the arithmetic.

The tolerance is derived, not chosen: the value is stored to one decimal
place, so rounding moves a correct figure by at most 0.05. Anything past that
came from somewhere other than this arithmetic.

### The first version of the gate was worse than no gate

Run against `docs/products-export-2026-09-14b.csv` it reported **PASS**. It
had evaluated **nothing**. Every metafield in that file is stored as `"'700"`
— Excel's text-guard apostrophe, inside the quotes the CSV writer added — so
`num()` returned `None` for all 184 live rows and the check skipped every one
of them.

Two changes came out of that, and the second is the general one:

1. `num()` strips the apostrophe and the wrapping quotes.
2. **The gate prints the denominator it worked from, and fails outright when
   it is zero.** A check that silently skips what it cannot parse reports
   success over a catalogue it never read.

`patches/standard-drinks.test.py` pins both, in six cases: correct values
pass, a wrong figure fails, 0.05 of rounding is not an error, 0.09 is, the
apostrophe still parses, and a file it cannot read fails loudly. The driver's
`check` step runs it.

## One red that was not mine

Merging `main` into `staging` brought in two PRs from another session and the
check suite went red:

```
unknown filter 't'
  <dt class="sh-label">{{ 'products.product.current_vintage' | t }}</dt>
```

Confirmed on a clean checkout of `origin/main`: it fails there on its own, and
had done since the vintage spec landed. Every fragment went down, not just
that line.

Nothing was wrong with the storefront — `t` is real Shopify Liquid, and the
page renders "Current vintage" correctly live. python-liquid just has no `t`,
so the harness was calling good markup broken and hiding everything else the
pass measures. The harness now resolves `t` against `locales/en.default.json`,
the same file Shopify reads, rather than echoing the key back: a key that was
renamed or never added renders as its own key, visible and measured, instead
of coming out blank and looking deliberate.

(Worth noting for future storefront checks: `www.spirithaus.com.au` serves a
bot interstitial to a bare `curl`. The first fetch of the Hill of Grace page
returned 9 KB of "Verifying your connection…" and no spec fields at all, which
looked exactly like the vintage block failing to render. With a cookie jar the
real page comes back and the block is there. A storefront check without `-c/-b`
can quietly measure the wrong document.)

## Still open

- Taittinger Comtes and Jansz Vintage Cuvée — `docs/standard-drinks-open-questions.csv`,
  waiting on a label reading. Both fail the new gate on purpose.
- 9 live products have no ABV at all, so the arithmetic cannot run on them:
  `aberlour-abunadh`, `tequila-blu`, `penfolds-grange`, `krug-grande-cuvee`,
  `moet-chandon-dom-perignon`, `veuve-clicquot-la-grande-dame`, `krug-vintage`,
  `dom-perignon-rose`, plus `lark-devils-storm-no-183` which has ABV but no
  standard drinks. Volume is already set on all but `tequila-blu`, so an ABV
  off each label is enough to finish them.
- `nobbys-salted-peanuts-170g` is not alcohol and is flagged by the presence
  gates. It wants excluding, not filling in.

## Shipped

`claude/standard-drinks-arithmetic` → `staging` → `main` (`edb727c`). All of
it is in `.shopifyignore`, so no theme file changed; the catalogue corrections
went to the store directly through the Admin API.
