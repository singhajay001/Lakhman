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

### 1. The file may be truncated

The supplied content ends mid-sentence:

> `# Microsoft — Bing Copilot draws from the Bing index, so no extra rule is`
> `# needed beyond bingbot, which Shopify's defaults already`

No closing word, no trailing rule. This is most likely the paste being cut
rather than the file itself, but it is worth confirming the live file ends
cleanly. A truncated `robots.txt` is usually still parsed — directives are read
line by line and a malformed trailing comment is ignored — so even in the worst
case this is cosmetic. Confirm and move on.

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
