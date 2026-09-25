# What matters next — 2026-09-25

Ordered by effect on sales, not by effort.

## Correction to something I said earlier

I reported that "zero of the top 20 have an SEO title or meta description" and framed
it as a store-wide gap. It is not. **All 206 live products have both.** Those 20 were
all drafts, and every one of the 280 drafts is missing them. The live store is clean.

---

## P0 — Blocking revenue right now

### 1. 133 drafts are in no collection
Publishing them changes nothing: they would not appear in `/collections/fine-wine`,
`/collections/red`, or anywhere else a customer browses. Only direct URL or search
would reach them.

This — not the image gap — is why the Fine Wine collection reads empty. It is pure
configuration, costs nothing, and I can do it in one pass.

**All 206 live products are correctly collected.** The problem is entirely in the
drafts I created.

### 2. 248 products have no image
Every one is wine. This blocks publishing the fine wine range at all — nobody buys a
$500 Champagne from a grey placeholder. The shoot-order worksheet ranks all 248; the
19 live-with-no-image products are already cleared.

---

## P1 — Money on the table, on products already selling

### 3. 77 products priced below ALM's recommended retail
Decided but not yet applied: set `compareAtPrice` to ALM RRP and keep the current
price as the "special". Needs the Dawn template to render it as **`RRP $X`** rather
than a bare strikethrough, which reads as "our old price" and is the ACL exposure.
Prices and theme change should ship together.

### 4. Two live wines under the 25% GP floor
| | Price | Cost | GP |
|---|---|---|---|
| Turkey Flat Rosé | $26.99 | $23.07 | **14.5%** |
| Shaw + Smith Sauvignon Blanc | $29.99 | $25.27 | **15.7%** |

These are on each product's **own recorded cost**, not an ALM proxy. Real breaches.

### 5. 181 of 515 variants have no cost recorded
Margin is unmonitorable across 35% of the range. Any GP report is guesswork until
this is filled. ALM's landed cost is **not** a safe substitute — the median ratio is
0.96 with wide variance, which is how I produced a false alarm earlier today.

---

## P2 — SEO on what is already indexed

### 6. 23 live products have no body copy at all
Indexable right now and thin. Four Karu lines, the Taylors Estate trio, both Wyndham
BINs, Wynns The Siding, and most of the cheap NZ whites.

### 7. PR #5 is still open on `singhajay001/spirithaus-theme`
The AI-crawler robots.txt fix. Until it merges, ChatGPT, Perplexity and Claude's
crawlers ignore the `*` group entirely (RFC 9309 — groups do not inherit), so they get
no disallow rules and will crawl `/cart`, `/checkout` and search pages. Wasted crawl
budget and junk in AI answers about the store. Tested and ready.
https://github.com/singhajay001/spirithaus-theme/pull/5

### 8. Four handles damaged by accent-stripping
`mo-t-and-chandon-dom-perignon` is the worst. Needs a manual 301 — Shopify does not
create one. Best done **before** images are named after those handles.

---

## P3 — Required before the 280 drafts can go live

- **280 drafts** need an SEO title and meta description
- **~253 drafts** need body copy
- **Grange 2021 barcode** `9310297066544`, verified and waiting
- **Fine-wine barcodes** need a second ALM extract covering the `3xxxxxxx` specialty
  range — the current master stops at `00999254`

---

## P4 — Range and strategy

- **Three range gaps, $967 total**: Bollinger Special Cuvée ($99), Penfolds Bin 389
  ($530), Penfolds Bin 128 ($338). The Bin ladder currently has 707 and 407 but no
  entry rung.
- **Validate the demand ranking against real AU search volume.** The Top 20 economics
  are ALM's data; the demand half is my brand-recognition judgement.

---

## My recommendation on sequence

**P0.1 costs nothing and unblocks everything else** — do the collections first.
Then P1.3 and P1.4, because they change revenue per order on products already selling.
Then merge PR #5, which is a one-click job already tested.

Images are the long pole. They gate P3 entirely, and no amount of other work
substitutes for them.
