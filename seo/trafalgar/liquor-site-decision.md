# Local Liquor Marsfield — web presence decision

Dated 2026-09-02. Supersedes the earlier plan to serve the bottle shop from
`trafalgarsupermarketandcellars.com.au/local-liquor`.

## The constraint

MyFoodLink confirmed it **cannot** separate the liquor site: the platform is
integrated to the POS through Friendly Grocer, and the storefront is one
grocery-shaped entity. A distinct liquor site is not available on that platform.

That kills the `/local-liquor` path plan. The two schema files stand; only where
they are hosted changes.

## Option A — buy the domain and redirect it: **do not do this**

Buying `localliquormarsfield.com.au` and 301-ing it to `trafalgar.net.au` (which
itself 301s to the canonical domain) delivers **nothing** for the problem we are
trying to solve.

A redirecting domain has no page, no content, and nothing to index. Google would
see a hostname that immediately bounces to a supermarket site. Specifically it:

- adds **zero** content about the bottle shop, which is the actual deficit
- gives the profile's website field a link that lands users on a grocery site
- creates a **redirect chain** — `localliquormarsfield` → `trafalgar.net.au` →
  `trafalgarsupermarketandcellars.com.au` — which is worse than one hop
- costs money for no ranking or discovery benefit

The diagnosis was that **nothing on the web corroborates that Local Liquor
Marsfield exists**. A redirect does not corroborate anything. It is a signpost
pointing at a different business.

## Option B — a small site without ecommerce: **do this**

Correct call, and the reasoning is stronger than "it is the other option":

- **The bottle shop does not need ecommerce.** Online liquor sales in NSW carry
  real compliance weight — age verification, delivery conditions, licence terms.
  Skipping it removes cost and risk while losing nothing that drives map-pack
  ranking.
- **What is missing is an indexable entity, not a checkout.** Prominence comes
  from a real page that states who this business is, where, when it opens, and
  what it stocks.
- **It unblocks the schema.** `schema/local-liquor.jsonld` is written and
  validated but has nowhere to live. A small static site can carry it exactly.
- **It gives the profile a website to point at.** A verified profile with no
  website competes with a hand tied.

### Where to host it

**Recommendation: `localliquormarsfield.com.au`**, as its own small site.

The core problem is that no source on the web says "Local Liquor Marsfield". A
domain carrying that exact name, with a real page behind it, is the most direct
fix available — it corroborates the profile name rather than contradicting it,
the way every existing citation currently does.

⚠️ Set expectations correctly: **exact-match domains carry no ranking bonus.**
Google stopped rewarding them long ago. The value here is entity clarity and
having a genuine site at all — not the keywords in the hostname. Anyone promising
an EMD boost is selling something.

Alternative worth considering: `liquor.trafalgarsupermarketandcellars.com.au` as
a subdomain on separate hosting, if DNS for that domain is under your control
rather than MyFoodLink's. It keeps brand association with the established domain.
For local ranking the difference between these two is small — the local pack
barely uses domain authority — so pick on brand grounds, not SEO ones.

### Ask MyFoodLink one more question first

They said no separate liquor **site**. That is not the same as no liquor **page**.
Ask specifically:

> Can you add a single page on our existing site — for example
> `/local-liquor` — with our own heading, copy, address, trading hours and
> photos for the bottle shop? Not a separate store, just one content page.

If yes, build it **as well as** the small site and cross-link them. Two
corroborating sources beat one. If no, the small site stands alone.

### What the site needs — and nothing more

Four or five pages is plenty. Static, fast, crawlable.

| Page | Purpose |
|---|---|
| Home | Who, where, hours, phone, map, photos. Carries the `LiquorStore` schema. |
| Range | What is stocked — beer, wine, spirits, by category and notable brands |
| Visit us | Address with `Shop 5A`, parking, directions, the plus code |
| About | The store, the people, its relationship to Trafalgar Supermarket and Cellars |
| Contact | Phone, hours, enquiry form |

Non-negotiables:

- `LiquorStore` JSON-LD from `schema/local-liquor.jsonld`, unchanged
- NAP byte-identical to `citations/NAP-master.md` — `Shop 5A, 1 Trafalgar Place`
- The **exact** profile name "Local Liquor Marsfield" in the `<h1>` and title
- Trading hours including the Sunday 10:00 open
- Link to the supermarket site, and a link back from it if MyFoodLink allows
- Genuinely mobile-fast — most of this traffic is a phone on the street
- No `noindex` at launch. Check it. Then check it again.

Explicitly **not** needed: a blog, a cart, accounts, delivery booking, a loyalty
scheme. Every one is cost and compliance for no map-pack gain.

### Do buy the domain either way

Register `localliquormarsfield.com.au` now regardless of which option wins —
cheap, and it stops a competitor or squatter taking the name of a business you
are trying to establish. Publish on one hostname only; park the rest.

Check `.com.au` eligibility against your ABN before assuming the registration
will clear.

## What this changes

| Previously | Now |
|---|---|
| `/supermarket` and `/local-liquor` on one MyFoodLink site | Supermarket on MyFoodLink; bottle shop on its own small site |
| Both schema files on one domain | `supermarket.jsonld` on MyFoodLink if it allows custom JSON-LD; `local-liquor.jsonld` on the new site |
| One canonical domain | One canonical **per entity**, cross-linked |

The two-profile, two-entity model is unchanged and still correct — distinct
suites, distinct names, distinct categories. Only the hosting changed.
