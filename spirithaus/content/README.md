# SPIRITHAUS — SEO content

Publish-ready articles for spirithaus.com.au, written against the live
catalogue (pulled from Shopify, 24 Sep 2026) so every internal link points at a
collection or product that actually exists.

## What's here

| File | Target query cluster | Intent |
|---|---|---|
| `articles/islay-whisky-guide.md` | islay whisky, peated whisky, smoky scotch | Informational → whisky |
| `articles/first-single-malt.md` | best single malt for beginners, speyside whisky | Informational → whisky |
| `articles/tequila-blanco-reposado-anejo.md` | blanco vs reposado vs añejo, tequila types | Informational → tequila |
| `articles/japanese-whisky-and-gin.md` | japanese whisky, japanese gin, hibiki, roku | Informational → whisky/gin |
| `articles/australian-spirits-guide.md` | australian whisky, australian gin, australian made spirits | Informational → australian-made |
| `articles/stocking-a-bar-for-an-event.md` | how much alcohol for a party, bar for 50 guests | **Commercial** → spirits/cocktails |

Each file carries YAML front matter with the title tag, meta description,
slug, primary and secondary queries, internal links and FAQ schema entries.

## A caveat you should hold me to

**I have no keyword tool and no verified search data.** These targets are
reasoned from your catalogue, your market and how people phrase these
questions — not measured. Before you commit a quarter to this, run the primary
queries through Search Console, Ahrefs, Semrush or even Keyword Planner and
re-rank. Treat the priority order here as a hypothesis, not a finding.

What I did not do: invent volume figures, difficulty scores or traffic
projections. Any SEO deliverable quoting those without a tool attached is
making them up.

## Internal linking

Collections referenced (all verified live):

`/collections/whisky` (52) · `/collections/tequila` (16) · `/collections/gin` (29)
`/collections/rum` (16) · `/collections/vodka` (15) · `/collections/spirits` (289)
`/collections/australian-made` (192) · `/collections/cocktails` (27)
`/collections/staff-picks` (21) · `/collections/liqueurs-aperitifs` (3)

Every article links **up** to its category collection and **across** to one or
two sibling articles. That is the whole internal-linking model — no orphan
posts, no link dumps.

## Before publishing — compliance

Alcohol marketing in Australia sits under the **ABAC scheme**, and a licensee's
own website content is generally in scope. These drafts were written to it:
no social, sexual or professional success framing; no suggestion that more is
better; no therapeutic or health claims; nothing that would appeal to
under-18s; responsible-service language where serving is discussed.

I am not your compliance adviser. Have someone who is read
`stocking-a-bar-for-an-event.md` in particular — quantity-planning content is
the piece most likely to attract scrutiny, and it is also the one most likely
to convert. ABAC runs a pre-vetting service.

Also confirm your site's age-verification arrangement covers the blog, not
just checkout.

## What will move the needle more than these articles

Pulled from the live catalogue while writing. Ranked by what I'd fix first:

1. **Most product pages have no description.** Of the 20 active whiskies I
   sampled, 15 had an empty `description` — including Aberlour 12, Chivas 12
   and 18, Johnnie Walker Black, Double Black and 18, Glenfiddich 18. Product
   pages are the money pages; right now most of them have nothing for Google
   to rank. Articles send traffic *to* pages that cannot convert it. The five
   that do have copy (Glenfiddich 12, Hakushu 12, Hibiki, Lagavulin 16,
   Laphroaig 10) are genuinely well written — that voice, applied to the other
   47, is worth more than any blog post here.

2. **The Spirits collection is pulling in wine.** Its rule is
   `tag:spirits OR tag:GIN OR tag:Australian`, applied disjunctively — so
   anything tagged `australian` lands in Spirits. Penfolds Koonunga Hill
   Shiraz, Pepperjack Barossa Shiraz and McGuigan Black Label are all sitting
   in `/collections/spirits` right now. That is 289 products in a collection
   that should be smaller, and a confusing page for anyone landing on it.

3. **Duplicate Hibiki listing.** `hibiki-japanese-harmony` ($199.99, no stock)
   and `hibiki-japanese-harmony-700ml` ($199.00, 12 in stock) are the same
   product on two URLs. Two pages compete for the same query and the one more
   likely to rank is the one you cannot sell. Merge, and 301 the loser.

4. **Four published collections are empty**: `low-no`, `new-this-month`,
   `specials`, `under-50`. Three more are near-empty: `gifting` (1),
   `canned-cocktails` (1), `premium-collabs` (2). Empty collection pages are
   thin content and a poor landing experience. Fill them or unpublish them.

5. **`single-malt` holds one product and has no rule**, while `whisky` holds
   52. "Single malt" is a strong commercial query and that collection is
   currently a dead end. Give it a rule.

6. **Nearly everything shows zero inventory.** If that is real rather than
   untracked, out-of-stock items get demoted or dropped from Shopping and
   organic over time.

None of that is writing work, which is why it is listed separately — but if
you only have time for one thing this month, it is item 1.

## Publishing

Markdown with YAML front matter. For Shopify, the body converts straight to
the blog post editor; the front matter maps to the SEO title, meta
description and handle fields. I can publish these to your Shopify blog
directly if you want them live rather than in files.
