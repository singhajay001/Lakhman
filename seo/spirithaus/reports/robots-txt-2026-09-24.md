# Spirithaus — robots.txt review

**2026-09-24.** Read from the live file supplied by the owner. Egress is blocked
in this session, so this is a review of the pasted content, not a fetch.

## The headline: the store is genuinely crawlable

`User-agent: *` carries **no blanket `Disallow: /`**. Combined with the password
being off, this settles the question that has been open since the audit:
**Google can crawl the site now.** Every finding in
`spirithaus.com.au-audit/` is a live defect, not pre-launch housekeeping.

The sitemap is declared correctly:
`Sitemap: https://www.spirithaus.com.au/sitemap.xml`

## What is right

**Shopify's defaults are intact and sensible.** Faceted navigation is properly
fenced — `sort_by`, `*+*`, `%2B`, `%2b` and the `filter*&*filter*` combination
are all disallowed across `/collections/` and `/blogs/`. That is the single
biggest source of crawl waste on a Shopify store and it is handled.

`/search` is disallowed — correct. Internal search result pages are thin by
definition and should never be indexed.

`/cart`, `/checkout`, `/checkouts/`, `/orders`, `/account` — all blocked.
Standard and correct.

**The AI-crawler block at the end is a deliberate, well-judged addition:**

| Crawler | Rule | Effect |
|---|---|---|
| GPTBot, OAI-SearchBot | `Allow: /` | ChatGPT web search can cite the store |
| ClaudeBot | `Allow: /` | Claude web search can cite the store |
| PerplexityBot | `Allow: /` | Perplexity can cite the store |
| Google-Extended | `Allow: /` | Opts **into** Gemini grounding |

The inline comment on Google-Extended is accurate and worth preserving:
disallowing it does not remove the site from Google Search, it only opts out of
Gemini grounding — which for an online retailer is backwards. Whoever wrote that
understood the distinction; most sites get it wrong.

Given the `spirithouse.com.au` homophone problem, AI-answer citation is a
genuinely useful channel here. A conversational query like "where can I buy
Yamazaki 12 in Sydney" does not collide with a Sunshine Coast restaurant the way
a bare brand search does.

## Two things to check

### 1. File integrity — RESOLVED

The full file was supplied and ends cleanly at
`# needed beyond bingbot, which Shopify's defaults already allow.`
The earlier truncation was the paste, not the file.

### 2. `/policies/` is disallowed — verify nothing important lives there

`Disallow: /policies/` is a Shopify default and blocks the **auto-generated**
policy documents. The store has three of these, and checkout links to them:

- `PRIVACY_POLICY`, `REFUND_POLICY`, `TERMS_OF_SERVICE`

**The custom pages are unaffected.** They sit at `/pages/`, not `/policies/`:
`contact`, `delivery`, `photo-id-on-delivery`, `responsible-service-of-alcohol`,
`returns`, `terms`, `privacy`. All seven are crawlable, and all seven now carry
the SEO titles and meta descriptions written on 24 September.

The only question this raises is editorial, not technical: there are now two
privacy policies and two sets of terms — the custom page and the Shopify policy
document. Only the custom one is indexable. **Make sure they say the same
thing**, because the one customers agree to at checkout is the `/policies/` one.

## What robots.txt does NOT protect you from

Nothing here blocks `/collections/fine-wine` or `/collections/specials`. Both
are live, crawlable and **empty** — 0 live products each, both carrying written
meta descriptions. Fine Wine's promises eight named wines that cannot be bought.

robots.txt is working as intended. These pages are a catalogue problem, and the
open crawl path means Google will find them.

---

## DEFECT — the AI crawler groups have no restrictions at all

This is the one real problem in the file, and it is subtle.

**robots.txt user-agent groups do not inherit from each other.** Under the
Robots Exclusion Protocol (RFC 9309), a crawler obeys the single most specific
group that matches its name and **ignores `User-agent: *` entirely**. Groups
are not merged.

The AI block gives each crawler its own group containing one line:

```
User-agent: GPTBot
Allow: /
```

So GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot and Google-Extended are
**not** bound by any of the careful fencing written for `*`. Every one of them
may currently crawl:

| Path | Fenced for `*` | Fenced for AI crawlers |
|---|---|---|
| `/search` | yes | **no** |
| `/collections/*sort_by*` | yes | **no** |
| `/collections/*+*`, `%2B`, `%2b` | yes | **no** |
| `*/collections/*filter*&*filter*` | yes | **no** |
| `/cart`, `/checkout`, `/checkouts/` | yes | **no** |
| `/account`, `/orders`, `/carts` | yes | **no** |
| `/*preview_theme_id*` | yes | **no** |

### Why this matters here specifically

It will not hurt Google rankings — none of these are Google's indexing crawler,
and Google-Extended does not affect Search. The damage is to the exact goal the
block was written to serve.

Faceted navigation on a 200-product store generates thousands of URL
combinations. An AI crawler with a finite budget that is free to wander
`/collections/red?sort_by=price-ascending&filter.v.price.gte=20` will spend that
budget on permutations instead of on the 207 product pages that carry the
descriptions, the ABV, the region and the `why_we_stock_it` copy.

The AI-citation channel is more valuable to Spirithaus than to most retailers,
because the `spirithouse.com.au` homophone makes brand search a lost cause.
Handing those crawlers an unbounded URL space undercuts the one channel that
routes around the problem.

### The fix

Each AI crawler group needs its own copy of the restrictions. The file lives in
the theme as `templates/robots.txt.liquid` — the AI block is a custom addition,
so that file already exists in `singhajay001/spirithaus-theme`.

Minimum viable version, repeated per crawler:

```
User-agent: GPTBot
Disallow: /search
Disallow: /cart
Disallow: /carts
Disallow: /checkout
Disallow: /checkouts/
Disallow: /account
Disallow: /orders
Disallow: /collections/*sort_by*
Disallow: /collections/*+*
Disallow: /collections/*%2B*
Disallow: /collections/*%2b*
Disallow: */collections/*filter*&*filter*
Disallow: /*preview_theme_id*
Disallow: /*preview_script_id*
Allow: /
```

`Allow: /` is kept last as the explicit statement of intent; it is redundant
against the default-allow behaviour but documents the decision for the next
reader.

**Do not** simply delete the AI groups to make them fall back to `*`. That
would work mechanically, but it would also delete the deliberate Google-Extended
opt-in and the reasoning attached to it, which is the most valuable comment in
the file.
