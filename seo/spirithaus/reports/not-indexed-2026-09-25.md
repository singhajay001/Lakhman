# Why Google shows nothing for spirithaus.com.au — 2026-09-25

## The symptom

Searching `spirithaus.com.au` returns:

1. a **shop.app** listing (Shopify's marketplace mirror of the catalogue)
2. an **AI Overview** that redirects the user to `spirithouse.com.au` — the Spirit
   House restaurant in Yandina, Queensland, an unrelated 20-year-old business
3. organic results for that restaurant

**Not one page from spirithaus.com.au.** A `site:spirithaus.com.au` search returns
zero URLs from the domain.

The store has been crawlable for **7 days** (password removed 2026-09-18,
owner-confirmed; an earlier note in the profile said 24 Sept and was wrong).

## What was ruled out

| Suspect | Checked | Result |
|---|---|---|
| `noindex` meta tag | code search across the theme repo | **none — zero matches** |
| Wrong canonical | `layout/theme.liquid` | correct: `<link rel="canonical" href="{{ canonical_url }}">` |
| robots.txt blanket disallow | established 2026-09-24 | none |
| Not published / wrong domain | Admin API | Online Store publication active, `www.spirithaus.com.au`, SSL on |
| **Age gate blocking crawlers** | `assets/spirithaus.css` | **ruled out** — see below |

### The age gate is built correctly

```css
/* Overlay, never a blank page. The document renders underneath so crawlers and
   assistive technology both still see the content. */
.sh-age-gate { position: fixed; inset: 0; z-index: 100; ... }
```

It is a fixed overlay with a z-index, not a content replacement. `main` is never
hidden, and the only other class involved (`sh-age-locked`) just sets
`overflow: hidden` to stop background scroll. Googlebot renders the page and sees
the full document. This is the right way to build an age gate for an alcohol
retailer and it is **not** the cause.

## The conclusion

Every technical blocker is eliminated, which leaves discovery.

Google finds a new site in one of two ways: **a link from a page it already
crawls**, or **a sitemap submitted through Search Console**. This domain has
neither:

- **No backlinks.** Brand-new domain, nothing on the web points at it — which the
  `site:` result confirms.
- **No Search Console property or submitted sitemap.**

With no inbound link and no sitemap, **there is no path for Googlebot to discover
that the site exists.** Seven days of that produces exactly what we see. The site
is not being rejected; it has never been visited.

The shop.app listing does not help — Shopify syndicates the *catalogue* to its own
marketplace. That is a different domain with its own authority and it does not get
spirithaus.com.au crawled.

## Fixed in this session

The one Google surface the brand does have — the shop.app listing — was advertising
**Naked Life Non-Alcoholic Passionfruit Martini at A$100.99**, because feeds take
the *first* variant and the carton was sitting in position 1. Six live products had
the same defect:

| Product | Was showing | Now shows |
|---|---|---|
| Curatif Negroni | **$236.99** (Carton of 24) | **$12.99** (Single Can) |
| Bellarine Tarty Ted | $256.99 (Carton) | $42.99 (Pack of 4) |
| Brookie's Byron G&T | $129.99 (Carton) | $29.99 (Pack of 4) |
| Naked Life Classic G&T | $100.99 (Carton) | $16.99 (Pack of 4) |
| Naked Life Passionfruit Martini | $100.99 (Carton) | $16.99 (Pack of 4) |
| Absolut Vodka | $86.99 (1Ltr) | $57.99 (700ml) |

**Display order only — no price was touched.**

Absolut deliberately leads with the **700ml at $57.99**, not the cheapest variant.
The 200ml is a miniature, not the hero product; cheapest-first is right for pack
sizes, standard-size-first is right for bottle sizes.

Pink Paloma already had Pack of 4 first, which is why it showed $16.99 in the
screenshot while its two siblings showed $100.99 — the inconsistency was the tell.

## What has to happen next — owner action, needs a Google login

1. **Verify Google Search Console** for `www.spirithaus.com.au`.
2. **Submit the sitemap**: `https://www.spirithaus.com.au/sitemap.xml`.
3. **URL Inspection → Request Indexing** on the homepage and the top collections.
   This forces a crawl instead of waiting to be found.
4. **Bing Webmaster Tools** — same sitemap; it feeds ChatGPT and Copilot.
5. **Get one real inbound link** from anything Google already crawls — the Google
   Business Profile, an Instagram bio, the Trafalgar site. One link turns discovery
   from "possibly never" into "within days."

Until step 1–3 happen, every other piece of SEO work in this project is optimisation
of pages Google cannot see.

## Second-order

The AI Overview actively steers searchers to the Yandina restaurant. That is an
entity problem, not a ranking one, and needs Organization schema with `sameAs`,
consistent naming, and eventually a knowledge panel. It will not resolve on its own.
