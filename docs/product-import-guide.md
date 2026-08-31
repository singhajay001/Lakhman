# Product import guide

How to use `docs/product-import-template.csv` to load products into
`1312wd-hk.myshopify.com`.

---

## 0. Before you import 380 rows — verify the metafield headers

**Read this section first. It is the one part of this file that was not
verifiable when it was written.**

The metafield column headers in the template use this syntax:

```
Metafield: custom.abv [number_decimal]
Metafield: custom.why_we_stock_it [multi_line_text_field]
```

That is: the literal word `Metafield`, a colon, a space, `namespace.key`, a
space, then the metafield **type identifier** in square brackets.

**Confidence, stated honestly:**

| Part | Confidence | Why |
|---|---|---|
| Core Shopify columns (`Handle`, `Variant Price`, …) | High | Long-stable, unchanged for years |
| `Metafield: namespace.key [type]` shape | Medium-high | Matches Shopify's own export format |
| The exact type identifiers in brackets | Medium | These are the API type names; the CSV may accept a shorter label |
| That your store's export includes these columns at all | Unverified | Depends on your Shopify version |

Shopify's documentation is unreachable from the environment this was written
in, so none of the above was confirmed against a primary source.

**The 60-second verification that settles it — do this before the bulk import:**

1. Admin → **Products** → create one throwaway product by hand.
2. Fill in **every one of the eight metafields** on it.
3. Products → **Export** → *Current page* / *All products* → CSV.
4. Open the export and read the metafield column headers.

Whatever that export says is the truth for your store. If it differs from the
template even by a space or a bracket, change the template to match the export
and not the other way round. An exported header is authoritative; this file is
a best effort.

If the export contains no metafield columns at all, your Shopify version does
not do metafields through the product CSV. In that case import the products
first and load metafields separately — a second CSV through a bulk-editor app,
or the Bulk editor in admin.

**Also verify your tags.** The template uses `spirits, gin, australian` and so
on. Your 24 collections are automated and tag-driven, so the tag text must match
the condition each collection actually uses. Open one collection in admin and
read its condition. A tag mismatch does not error — the product imports fine and
silently never appears in the collection, which is worse.

---

## 1. Multi-line text in a CSV cell

`why_we_stock_it` is the only field here that spans paragraphs, and it is the
one most likely to break a file.

The rules:

- The whole field is wrapped in **double quotes**.
- Real line breaks live **inside** those quotes. You do not escape them, and you
  do not write `\n` — a literal backslash-n imports as the characters `\n`.
- A blank line between paragraphs is **two consecutive newlines**.
- Any double quote *inside* the text is written **twice**: `""like this""`.
- Commas inside a quoted field are just commas. They do not split the cell.

So one cell holding three paragraphs looks like this in the raw file:

```
"First paragraph here.

Second paragraph here.

Third paragraph."
```

That is four newline characters inside one field, and the row does not end until
the closing quote.

**How to edit this safely.** Excel, Numbers and Google Sheets all handle this
correctly when you type Alt+Enter (Windows) or Ctrl+Option+Enter (Mac) for an
in-cell line break, and they re-quote it properly on save. What breaks it is
saving as anything other than **CSV UTF-8**, or opening and re-saving in a text
editor that converts line endings.

The theme renders this field by splitting on newlines and wrapping each non-empty
line in a `<p>`. So paragraph breaks in the cell become paragraph breaks on the
product page. There is no Markdown and no HTML — angle brackets are escaped
before rendering, deliberately, so `<b>` would display as text rather than bold.

---

## 2. Images

`Image Src` takes a **publicly reachable URL**, not a filename and not a local
path. Shopify fetches the file at import time and copies it into your CDN. The
URL only needs to work during the import.

- Must be `https://` and require no login. A Google Drive or Dropbox share link
  usually fails — those serve an HTML preview page, not the image bytes.
- If Shopify cannot fetch a URL, that row's **image** fails but the **product
  still imports**. You get a product with no photo and, often, no error at all.
  Check for imageless products after every import.
- `Image Alt Text` is a real accessibility requirement, not optional metadata.
  Describe the bottle: *"Four Pillars Rare Dry Gin 700 mL bottle"*.

**More than one image per product:** add extra rows that repeat the **same
`Handle`** and fill in only `Image Src`, `Image Position` and `Image Alt Text`.
Leave every other column empty — including `Title`. The template's fourth row
does exactly this for the gin. A repeated `Title` on a continuation row can
create a duplicate product.

`Image Position` is 1-based and sets the order. Position 1 is the product's main
image.

`Variant Image` is different: it is the image shown when a specific variant is
selected, and it must be a URL already present in one of that product's
`Image Src` rows.

---

## 3. Variants and weight

**If a product has one variant** — which is most of a 380-SKU bottle shop — use:

```
Option1 Name  = Title
Option1 Value = Default Title
```

Those exact strings. That is how Shopify represents "no real options".

**If a product has real variants** — a 700 mL and a 1 L of the same gin — write
one row per variant, all sharing the same `Handle`:

```
Handle              Title            Option1 Name  Option1 Value  Variant SKU     Variant Price
hendricks-gin       Hendrick's Gin   Size          700 mL         SH-GIN-HEN-700  75.00
hendricks-gin                        Size          1 L            SH-GIN-HEN-1000 99.00
```

Only the **first** row carries `Title`, `Body (HTML)`, `Vendor`, `Tags` and the
metafields — those are product-level. Later rows carry only variant fields. Note
that `volume_ml` is a *product* metafield, so a genuinely multi-size product can
only hold one value for it. If you stock both sizes, prefer two separate products
over variants; the spec table will then be correct for each.

**Weight.** `Variant Grams` is **always in grams**, regardless of what
`Variant Weight Unit` says. The unit column controls display only. Setting
`Variant Grams` to `1.25` because your store is configured in kilograms gives you
a 1.25-gram bottle of gin and wrecks your shipping rates.

Use the **packed** weight, glass included, not the liquid volume:

| | typical packed weight |
|---|---|
| 700 mL spirits bottle | ~1250 g |
| 750 mL wine bottle | ~1300 g |
| 330 mL can | ~360 g |
| 130 mL can | ~190 g |

`Variant Requires Shipping` is `TRUE` for everything you sell. `Variant Taxable`
is `TRUE` — prices are GST-inclusive, and Shopify handles the GST component from
your tax settings rather than from the CSV.

**Standard drinks is not calculated here.** The template's values are
illustrative. Every one must be transcribed from the actual bottle label before
import. It is a regulated figure under the Food Standards Code, the label is the
source of truth, and a number that disagrees with the bottle is a compliance
problem rather than a display bug. The theme reads the metafield and never
computes it, for the same reason.

---

## 4. The three most common reasons an import fails

### 1. The file is not UTF-8, or Excel re-encoded it

By far the most common. Excel on Windows defaults to a regional encoding, so
curly quotes, `é` in *rosé*, and en-dashes arrive as mojibake — `rosÃ©` — or the
import rejects the file outright.

Always **Save As → CSV UTF-8 (Comma delimited)**. If you have already mangled a
file, fix it at the source and re-export; find-and-replace on the damaged
characters misses cases.

A related failure: a spreadsheet app "helpfully" reformatting a cell. `41.8`
becoming `41.80000000001`, a SKU losing a leading zero, or a barcode turning into
`1.23457E+12`. Format those columns as **Text** before typing into them.

### 2. Column headers do not match exactly

Shopify matches headers by exact string. `Variant price` fails where
`Variant Price` works. So do a trailing space, a smart quote, or a non-breaking
space pasted in from a web page.

Columns may be **omitted** and may appear in **any order** — but every one that
is present must be spelled exactly right. This is the failure mode most likely to
hit the metafield columns, which is why section 0 exists.

### 3. Handle problems

`Handle` is the unique key. Three distinct ways this bites:

- **A handle that already exists overwrites that product**, silently and without
  a confirmation prompt. This is how a "new products" import quietly destroys
  descriptions on live products. Import as `draft` first and check.
- **Rows for one product must be contiguous.** All rows sharing a handle have to
  sit together. Sorting the spreadsheet by price or title scatters them and turns
  your continuation rows into separate broken products.
- **Handles must be lowercase**, with hyphens, no spaces, no apostrophes.
  `Hendrick's Gin` must become `hendricks-gin`.

### Honourable mention: it did not fail, it just did nothing

An import can report success while achieving nothing visible — products land as
`draft` with `Published` false and do not appear on the storefront, or tags do not
match any collection condition so the products exist but no collection shows
them. Neither is an error. Both look like a broken site.

---

## 5. Recommended first run

0. Run the checker over your file first:

   ```bash
   python3 docs/check-import-csv.py my-380-products.csv
   ```

   With a CSV exported from your own admin it will also diff your columns
   against what Shopify actually emits, which settles section 0 mechanically:

   ```bash
   python3 docs/check-import-csv.py my-380-products.csv --against shopify-export.csv
   ```

   It catches wrong header case, `%` or `mL` left in numeric fields, literal
   `\n` in the multi-line field, malformed handles, non-contiguous product rows
   and non-https image URLs. It found a genuine contiguity bug in this very
   template on its first run. If you cannot run Python, send me the file and I
   will run it.

1. Verify the metafield headers per section 0.
2. Cut the file down to **three rows**, import those, and look at the result.
3. Check the product page renders the price ticket, the "Why we stock it" block
   and the spec table with all eight fields.
4. Only then import the remaining 377.

The template ships with `Status = draft` and `Published = FALSE` on every row
deliberately. Nothing goes live until you flip it, which means a bad import is
recoverable rather than public.

Keep a copy of the file you actually imported. If something goes wrong at row
300, knowing exactly what you sent is the difference between a fix and a rebuild.
