# localliquormarsfield.com.au — **LIVE**

> ## ⚠️ EVERY DEPLOYMENT: set HTML handling to `auto-trailing-slash`
>
> On the Cloudflare upload screen, expand **Advanced settings** and set
> **HTML handling** to **`auto-trailing-slash`** before clicking Deploy.
>
> This is **per-deployment configuration, not a site setting.** Changing it in
> the Settings tab afterwards does not fix a deployment already running, and a
> new upload silently defaults it back.
>
> `none` looks correct — it serves `.html` files exactly as named — but it also
> stops `/` mapping to `index.html`, so **the homepage returns 404 while
> `/index.html` loads fine.** That exact mistake cost two rounds of debugging
> here, with the Google profile pointing at a 404 page in between.
>
> `check.sh` cannot catch this. It validates the files, and the files are fine;
> the fault lives in Cloudflare's deployment config, outside the repository.

Deployed 2026-09-02 on Cloudflare Workers static assets. Apex canonical, no `www`.
Update by editing files, running `./check.sh`, then Cloudflare → the project →
**New deployment** → drag the new zip.

Static site for Local Liquor Marsfield. Five pages, one stylesheet, no build
step, no JavaScript, no dependencies. Drop it on any host.

## Why it exists

MyFoodLink cannot host a separate liquor site — it is integrated to the POS via
Friendly Grocer. The bottle shop had a verified Google Business Profile and no
website, and no source on the web corroborating that "Local Liquor Marsfield"
exists. This site is the fix. See `../../seo/trafalgar/liquor-site-decision.md`.

## Before you publish

```bash
./check.sh
```

It fails while any placeholder remains, if `noindex` is present anywhere, if the
NAP does not match `seo/trafalgar/citations/NAP-master.md` byte-for-byte on every
page, if a retired address format has crept back in, or if the JSON-LD does not
parse.

## What still needs you

Search for `REPLACE` and `class="todo"`. Everything factual — name, address,
hours, phone, coordinates, plus code, schema — is already correct and verified.
What is missing is what only you know:

| Page | Needs |
|---|---|
| `index.html` | Two or three sentences on the range; licence number in the footer if required |
| `range.html` | **The important one.** What you actually stock, by name |
| `visit.html` | Parking, transport, where the entrance is |
| `about.html` | The real story — how long, who runs it |
| `contact.html` | A monitored email address, or delete that card |

On `range.html`: this is the page that makes you findable for something other
than your own name. "Wide selection of beer, wine and spirits" is what every
bottle shop in Australia says, and it ranks for nothing. Name brands, regions and
sizes. Delete any category you do not carry — an inaccurate range page costs you
a customer who drives over for something you never had.

## Deploying

The whole site is **14 files, 168 KB** of static HTML, CSS and PNG. No server
code, no database, no build step at runtime. Any static host works.

### GoDaddy — yes, but only the right product

| GoDaddy product | Works? |
|---|---|
| **Web Hosting (cPanel / Linux)** | ✅ Yes. Upload to `public_html` via File Manager or FTP. |
| **Domain registration only** | ❌ Not hosting. Point the DNS somewhere that is. |
| **Website Builder / Managed WordPress** | ❌ No. Neither accepts hand-written HTML uploads. |

If it is cPanel hosting:

1. cPanel → **File Manager** → `public_html`
2. Upload everything except `build/`, `check.sh` and `README.md` — those are
   development files and do not belong on the server
3. Confirm **SSL is active** and HTTPS loads. Some GoDaddy plans include a
   certificate, some charge for it. HTTPS is not optional.
4. `.htaccess` (included) forces HTTPS, 301s `www` to the apex, and sets caching
   and compression. It is read automatically by Apache.

### Two honest caveats

**Speed.** GoDaddy shared hosting is slower than a CDN. For 168 KB of static
files it will still be fine, but Cloudflare Pages or Netlify would serve it from
an edge node for free and score better on Core Web Vitals.

**Cost.** You would be paying for hosting to serve fourteen static files. If you
already pay for GoDaddy hosting, use it — one less account. If you do not,
Cloudflare Pages is free, includes SSL, and takes about five minutes.

**Do not let this decision delay launch.** An unpublished site is worth nothing,
and moving a static site between hosts later is a twenty-minute job. Pick
whichever you can do this week.

### Canonical host

Every page declares `https://localliquormarsfield.com.au/...` — the **apex**, no
`www`. Whatever host you choose must 301 `www` to the apex, or the two compete
and Google chooses for you. The bundled `.htaccess` does this on Apache; on
Cloudflare Pages or Netlify set it in the dashboard's redirect rules.

1. Point `localliquormarsfield.com.au` at the host.
2. Serve apex as canonical; 301 `www` to it (see above).
3. Force HTTPS.
4. Publish, then **check the live site for `noindex` one more time**.
5. Add the domain to Google Search Console as a **Domain property**, and submit
   `sitemap.xml`.
6. Put the URL in the Google Business Profile website field for Local Liquor
   Marsfield — this is the point of the whole exercise.
7. Ask MyFoodLink to link to it from the supermarket site.

## Verifying the schema

The homepage carries `LiquorStore` JSON-LD identical to
`seo/trafalgar/schema/local-liquor.jsonld`. After publishing, run the URL through
the Rich Results Test and the Schema Markup Validator. Before publishing, paste
the block into validator.schema.org's Code snippet tab.

## Range page numbers

Every figure on `range.html` is derived from `seo/trafalgar/range-data/liquor-products.xlsx`
and was checked against `summary.json` — 16 claims, all supported.

**They are still gated behind a placeholder**, deliberately. The counts describe
the spreadsheet, and the spreadsheet may be a supplier catalogue rather than an
export of actual shelf stock: it is named for the retired "Trafalgar Cellars"
trading name and every image URL points at BWS's media server. Confirm the range
is what is genuinely in Shop 5A before removing that box and publishing.

See `seo/trafalgar/range-data/ANALYSIS.md` for the full read, including why the
supplied image URLs and product descriptions must not be used.

## Regenerating the range pages

`spirits.html` and `range.html` are **generated**, not hand-edited. Editing them
directly means the next rebuild silently discards your changes.

```bash
python3 build/build.py                      # current live state, no prices
python3 build/build.py --prices             # step 2
python3 build/build.py --source fresh.xlsx  # a newer stock export
```

Verified to reproduce the committed pages byte-for-byte, so a rebuild is safe.
The other four pages are hand-written and untouched by the build.

## Step 2 — adding prices

Prices are deliberately omitted for now. `--prices` is built and tested; it adds
the price to each named bottle and swaps the "ring for today's price" note for
one saying prices were current at the last update.

**Before turning it on, decide who re-runs the build and how often.** A price
list is a promise. Stale prices cause arguments at the counter and are worse than
no prices at all, so the honest sequence is:

1. Export current stock and prices.
2. `python3 build/build.py --source <export>.xlsx --prices`
3. `./check.sh`, then publish.
4. Repeat on a set cadence — monthly at minimum, and after any major price move.

If nobody owns that cadence, leave prices off. "Ring for today's price" is
accurate forever and produces a phone call, which converts better than a number
on a page.

### Do not add Product/Offer schema with those prices

Tempting, and wrong here. Google's product structured data expects a way to buy —
this is a brochure site with no cart. Marking up `Offer` with a price and no
purchase path is a structured-data mismatch and risks a manual action.

Prices stay as plain page content. The `LiquorStore` schema on the homepage is
the correct markup for this site and already carries `priceRange`.

## ~~Unresolved before publishing: the wine count~~ — RESOLVED

The owner's own About copy says **"Wine — Over 120 Local & Imported Labels"**.
`range.html` says **"There are over 2,100 wines in store"**, taken from the
supplied product spreadsheet, which counted 2,153.

Those cannot both be right, and 120 is far more plausible for a suburban bottle
shop. The likely explanation is that the spreadsheet is the **orderable** range
available through the group, not what is physically on the shelf — the same
concern the BWS image URLs raised earlier.

**Do not publish until this is settled.** A page claiming 2,100 wines when the
shop holds 120 is exactly the failure the range page exists to prevent: someone
drives over for a bottle that was never there.

Once decided, rebuild — the numbers live in `build/build.py`, not in the HTML.


## Resolved: wine is 120, and that changed every other count

The owner confirmed wine is **over 120 labels**, not the spreadsheet's 2,153.

That single answer settles the provenance question: the supplied spreadsheet is
the **orderable range** available through the group, not what stands on the
shelf. Wine being off by a factor of eighteen means craft beer (453), spirits
(1,493), whisky (219) and gin (157) are from the same source and equally
unreliable as shelf claims.

So every catalogue-derived count has been removed from the site, not just the
wine one. What remains is:

- **the owner's own figure** — over 120 wine labels
- **qualitative range descriptions**, in the owner's own words
- **89 named bottles**, which are real products and the actual SEO value

The counts were never the valuable part. A page naming Hakushu 12 and Hibiki
Harmony reaches searches that "over 450 craft beers" never could, and it cannot
be wrong in the way a count can.

`check.sh` blocks any of those figures returning through a rebuild.

**If you want numbers back, supply shelf counts for beer and spirits** and they
go straight in — they are persuasive when true.


## Images: none of the shop, one of the brand

No storefront or interior photography. The shop's own photos live on the Google
Business Profile, which is where people actually look at a bottle shop, and a
text-only site stays fast on a phone with nothing to re-shoot when the shelves
change.

The one image that is not a store photo, and does matter:

`assets/og-image.png` — a 1200×630 typographic card used as the social preview.
Without it, every share of this site on Facebook, WhatsApp, Instagram DM or
Messenger renders as a bare blue link. With it, the shop name, tagline, address
and phone appear in the preview. It is a share and click-through asset, not
decoration, and it needs no camera.

Plus `favicon-32.png` and `apple-touch-icon.png` for the browser tab and iOS home
screen.

To restyle any of them, edit the generator block in the commit that added them —
they are drawn in Pillow from the site's own palette, so they stay consistent
with the CSS.
