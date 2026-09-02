# Trafalgar Supermarket and Cellars — SEO profile

> Facts below come from third-party citations found via search, not from the
> owner or from the live site (this session cannot reach it — see "Environment
> limitation"). **Every field needs owner verification before being used to
> correct listings.** Publishing wrong NAP data is worse than publishing none.

## Identity (unverified — confirm each)

| Field | Value found | Source |
|---|---|---|
| Business name | **FRAGMENTED — see gbp-checklist.md.** Five names in use across the web | multiple |
| GBP 1 — supermarket | **Trafalgar Supermarket and Cellars**, Shop 5, 1 Trafalgar Place · `-33.767749, 151.108628` · Verified | owner |
| GBP 2 — bottle shop | **Local Liquor Marsfield**, 5A, 1 Trafalgar Place · `-33.767734, 151.107974` · plus code `64J5+R5` · store code `03435376679661119338` · Verified | owner |
| Pin separation | 60.5 m — two distinct locations in one complex | computed |
| Bottle shop hours | Mon–Wed 08:00–21:00 · Thu–Sat 08:00–22:00 · Sun 10:00–21:00 | owner |
| Address | **Shop 5** (supermarket) and **Shop 5A** (liquor), 1 Trafalgar Place, Marsfield NSW 2122 | owner (confirmed) |
| Grocery banner | **Friendly Grocer** (Metcash) — banner site carries two duplicate pages | friendlygrocer.com.au |
| Council area | City of Ryde, Sydney | Wheree |
| Phone — supermarket | (02) 9868 1070 | owner |
| Phone — bottle shop | **0452 480 487** | owner, confirmed against live profile |
| Supermarket hours | Mon–Wed 08:00–21:00 · Thu–Sat 08:00–22:00 · Sun 08:00–21:00 | owner |
| ⚠️ Directory error | aussie-hours, Shopfully, openinghoursau all publish `09:00` open — **one hour late, every day** | — |
| Existing domain | `trafalgarsupermarketandcellars.com.au` | search result; also the owner's email domain |
| Under-construction site | `trafalgar-grocery.myfoodlink.com` | supplied by owner |
| **Canonical domain (DECIDED)** | `trafalgarsupermarketandcellars.com.au` | owner decision |
| Short domain | `trafalgar.net.au` — permanent 301 into canonical, **never published on** | owner decision |
| Instagram | `@trafalgarsupermarket` | confirmed |
| Facebook | page id 61580472953531 | confirmed |

## Domain decision — SETTLED

`trafalgarsupermarketandcellars.com.au` is canonical. `trafalgar.net.au` is
acquired as the short spoken/print form and **permanently 301s into the
canonical domain**. Nothing is ever published on it.

Owner's reasoning, recorded because it should survive this session:

- `.com.au` carries more trust than `.net.au` in Australian retail, where
  `.net.au` is rare enough to read as a fallback.
- The long domain matches the registered business name exactly, which is what
  feeds the NAP consistency Google uses for local ranking. A physical store's
  traffic arrives through Maps and GBP, not typed URLs — so domain length costs
  almost nothing.
- Switching canonical after indexing means 301ing everything and taking a
  temporary hit for no gain.

`trafalgar-grocery.myfoodlink.com` must be `noindex` while under construction,
then 301 to the canonical domain at launch.

## ⚠️ Name collision — the defining SEO problem

There is an **unrelated** business, **IGA Trafalgar**, at 5 McCrorey St,
**Trafalgar VIC 3824** (a town in Gippsland, Victoria), phone (03) 5633 1124.
It is a different company in a different state.

Searches for "Trafalgar supermarket" surface *that* store. The word "Trafalgar"
also carries Trafalgar Square, Trafalgar tours, and the suburb-street name in
Marsfield. This business is competing for a term it does not own and cannot win
generically.

**Consequence for the domain decision.** `trafalgar.net.au` is a generic-term
domain in the most contested possible name space for this business. It carries:

- no entity signal tying it to *this* store
- direct competition with a Victorian supermarket of nearly the same name
- zero existing authority or index history

Whereas `trafalgarsupermarketandcellars.com.au` is **entity-exact**, already
associated with the business (it is the owner's email domain), already appears
in search results, and disambiguates from IGA Trafalgar automatically.

Do not expect to own the word "Trafalgar" as a standalone brand term — it
collides with Trafalgar Square, the Battle of Trafalgar, Trafalgar Tours (a
large travel company) and IGA Trafalgar VIC. Target the full business name plus
locality instead: "Trafalgar Supermarket Marsfield", "bottle shop Marsfield".

## Three hostnames is the real risk

Right now the business is associated with, or planning:

1. `trafalgarsupermarketandcellars.com.au` — existing
2. `trafalgar-grocery.myfoodlink.com` — under construction
3. `trafalgar.net.au` — planned

Only **one** may be canonical. The other two must 301-redirect to it. Leaving
two live and indexable splits authority, creates duplicate content, and lets
Google pick the canonical for you — usually the wrong one.

The MyFoodLink subdomain should be `noindex` while under construction, then
**301-redirected** at launch. Do not simply switch it off: a subdomain that
accrued any links or index presence should pass that signal on, not 404.

## Migration checklist (whichever domain wins)

1. Capture a `seo drift baseline` of the current site **before** anything moves.
2. Map every old URL to its new equivalent. No blanket redirect to the homepage.
3. 301 (permanent), not 302. Keep them live at least 12 months.
4. Submit both properties in Search Console; use **Change of Address**.
5. Submit the new XML sitemap; keep the old one reachable briefly.
6. Update GBP, Facebook, Instagram, Yelp, Untappd, Cylex, dlook, and the other
   citations to the new URL — GBP first.
7. Remove `noindex` at launch. This is the single most common launch failure:
   a staging `noindex` shipped to production.
8. `seo drift compare` weekly for the first month.

## Platform: MyFoodLink

An Australian e-commerce platform for independent grocery and liquor retailers
(partners include IGA groups, Ritchies, Drakes, FoodWorks, Liquor Marketing
Group). It is a hosted SaaS platform, so template-level SEO control is likely
limited. **Before planning technical work, establish what MyFoodLink actually
exposes**: custom meta titles/descriptions, JSON-LD, `robots.txt`, XML sitemaps,
canonical tags, redirects, and custom domain support.

Ask MyFoodLink support directly. Do not assume Shopify-equivalent control.

## Current work

| Artefact | Status |
|---|---|
| `gbp-checklist.md` | Google Business Profile plan, prioritised |
| `schema/supermarket.jsonld` | `GroceryStore` @ Shop 5, shared parent `Organization` |
| `schema/local-liquor.jsonld` | `LiquorStore` @ Shop 5A, same parent `Organization` |
| `liquor-site-decision.md` | Bottle shop needs its own site — MyFoodLink cannot host one |
| `ranking-diagnosis.md` | Why the bottle shop is not ranking yet |

Two independent entities rather than one with a `department`: the distinct suite
numbers make them separately addressable, which is the stronger model.

Both files are complete. No placeholders remain; every value is owner-confirmed.

## What winning looks like

This is a **physical store in Marsfield, Sydney** with an online grocery
offering. Two distinct surfaces:

**Local (primary).** Proximity searches from Marsfield, Macquarie Park, Eastwood,
North Ryde, Epping. `bottle shop near me`, `supermarket Marsfield`,
`liquor store Marsfield`. Decided in the map pack.

**Online grocery (secondary).** Delivery/click-and-collect within its radius.
Competes with Woolworths and Coles on convenience, not on catalogue.

## Priority order

1. **Google Business Profile.** Categories, hours, attributes, photos, products.
   Confirm the listing is claimed and verified.
2. **Converge the name.** Five names are in use: Local Liquor Marsfield (the
   GBP), Trafalgar Supermarket and Cellars, Trafalgar Cellars, Friendly Grocer
   Marsfield, and Trafalgar Supermarket. Pick one canonical trading name and
   apply it byte-for-byte everywhere. This is the top-priority fix.
3. **Citation cleanup.** `cellars.com.au` says "Trafalgar Cellars" at "Shiop 5/1"
   (sic); `friendlygrocer.com.au` carries two duplicate pages for the one store.
4. **Entity disambiguation from IGA Trafalgar VIC.** Consistent use of the full
   name plus "Marsfield" / "NSW" across site, schema, and citations.
5. **`LocalBusiness` / `Store` schema** matching GBP byte-for-byte.
6. **Reviews** — velocity and response rate.

## Explicitly deprioritised

National keyword strategy, blog content, topic clusters. Wrong tools for a
suburban store.

## Skills to use

`seo-local` · `seo-maps` · `seo-schema` · `seo-drift` (essential through the
migration) · `seo-technical`

## Environment limitation

This remote Claude Code session's network egress proxy **blocks direct page
fetches** — `trafalgar-grocery.myfoodlink.com`, `myfoodlink.com` and even
`developers.google.com` all return `EGRESS_BLOCKED`. Web search works; fetching
does not.

Any toolkit command that loads a live page therefore cannot run here:
`seo audit`, `seo page`, `seo drift baseline`, `seo technical`, `seo local`,
PageSpeed, and rendering. **Run those from Claude Code in a local terminal**,
where there is no egress proxy. Planning, schema generation, and strategy work
fine in this session.
