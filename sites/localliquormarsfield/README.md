# localliquormarsfield.com.au

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

Any static host works — Cloudflare Pages, Netlify, or plain cPanel hosting.

1. Point `localliquormarsfield.com.au` at the host.
2. Serve `www` and apex from one canonical host; 301 the other.
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
