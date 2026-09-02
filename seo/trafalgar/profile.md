# Trafalgar Supermarket and Cellars — SEO profile

> Facts below come from third-party citations found via search, not from the
> owner or from the live site (this session cannot reach it — see "Environment
> limitation"). **Every field needs owner verification before being used to
> correct listings.** Publishing wrong NAP data is worse than publishing none.

## Identity (unverified — confirm each)

| Field | Value found | Source |
|---|---|---|
| Business name | Trafalgar Supermarket and Cellars | Facebook, Yelp, Instagram |
| Address | Shop 5/1 Trafalgar Pl, **Marsfield NSW 2122** | Yelp, Facebook, Cylex, dlook |
| Council area | City of Ryde, Sydney | Wheree |
| Phone | +61 2 9868 1070 | Yelp, mapsus, dlook |
| Hours | Open 7 days | Facebook, dlook |
| Existing domain | `trafalgarsupermarketandcellars.com.au` | search result; also the owner's email domain |
| Under-construction site | `trafalgar-grocery.myfoodlink.com` | supplied by owner |
| Proposed new domain | `trafalgar.net.au` | supplied by owner — **see risk below** |
| Instagram | `@trafalgarsupermarket` | confirmed |
| Facebook | page id 61580472953531 | confirmed |

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

**Recommendation: keep `trafalgarsupermarketandcellars.com.au` as the canonical
domain.** If `trafalgar.net.au` is wanted for being short and memorable, own it
and **301-redirect it** to the canonical domain rather than making it the primary.
That keeps the brand shortcut without discarding entity clarity or splitting
authority across three hostnames.

This is a recommendation, not a veto. If the decision is to move to
`trafalgar.net.au` regardless, the migration plan below applies and must be
followed precisely.

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

## What winning looks like

This is a **physical store in Marsfield, Sydney** with an online grocery
offering. Two distinct surfaces:

**Local (primary).** Proximity searches from Marsfield, Macquarie Park, Eastwood,
North Ryde, Epping. `bottle shop near me`, `supermarket Marsfield`,
`liquor store Marsfield`. Decided in the map pack.

**Online grocery (secondary).** Delivery/click-and-collect within its radius.
Competes with Woolworths and Coles on convenience, not on catalogue.

## Priority order

1. **Settle the domain question.** Everything else is wasted effort until the
   canonical hostname is decided — including any content work, because it would
   need redoing.
2. **Google Business Profile.** Categories, hours, attributes, photos, products.
   Confirm the listing is claimed and verified.
3. **Citation cleanup.** Several listings carry inconsistent data — e.g.
   `cellars.com.au` lists the business as "Trafalgar Cellars" at "Shiop 5/1"
   (sic). Name and address must match GBP exactly, everywhere.
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
