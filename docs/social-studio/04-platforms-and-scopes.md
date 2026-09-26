# 4 — Shopify scopes, platform applications, alcohol restrictions

## A warning about every figure in this document

§4 requires API versions, scopes, posting limits, media specifications, review
requirements and market availability to be verified against current official
documentation at implementation time. **This container cannot reach any of that
documentation** — `cdn.shopify.com`, `spirithaus.com.au` and `graph.facebook.com` are all
refused at CONNECT by the environment's network policy.

So this document states what I believe to be true and *marks it as unverified*. It is a
list of things to check, not a record of things checked. Every row lands in
`PlatformCapability` with `verified: false` and a documentation URL, and the app refuses to
enable an unverified capability. The alternative — writing these down as facts — is exactly
the "remembered endpoints" §4 prohibits.

## Shopify Admin API scopes

Requested at install, split so that declining the optional set still leaves a working app.
§7 requires the split and an explanation per scope.

### Mandatory

| Scope | Why it cannot be dropped |
| --- | --- |
| `read_products` | Products, variants, collections, titles, descriptions, type, vendor, tags, price, compare-at, images, status, handle, metafields. Without it there is no product truth and §3's first principle fails |
| `read_inventory` | Availability and inventory levels for the pre-publication revalidation in §7 and the stock-unsafe pause in §31. Also `inventoryItem.unitCost`, which is COGS for the contribution margin in §26 |
| `read_orders` | Confirmed orders, refunds, cancellations — the numerator of every metric §26 ranks above engagement. Note the 60-day window below |
| `write_pixels` + `read_customer_events` | The Web Pixel extension and its events. §26's first-party attribution is not possible without both |
| `read_marketing_events` + `write_marketing_events` | Registers campaigns as Shopify Marketing Activities so spend and results appear in Shopify's own reporting rather than only in this app |

### Optional, each gated behind the feature that needs it

| Scope | Feature | If declined |
| --- | --- | --- |
| `read_customers` | Audience segments (§25) | Segment features disabled; campaigns target platform-native audiences only |
| `read_all_orders` | Attribution beyond 60 days | Historical analysis limited to 60 days. **Requires Shopify's approval**, not just the merchant's |
| `write_discounts` | Offer codes for offer-code attribution (§26) | Offer codes created by hand in Shopify and pasted in |
| `read_files` / `write_files` | Storing generated assets in Shopify Files | Assets live only in our S3 bucket — which is the default anyway |
| `read_publications` | Verifying a product is published to the Online Store sales channel before promoting it | Preflight checks product status only |

**Never requested:** `write_products`, `write_inventory`, `write_orders`, `write_customers`,
`write_themes`. This app has no business editing the catalogue, and §15's product-truth
principle is stronger if it *cannot*. Worth stating in the app listing, because it is a
genuine answer to "what will this app do to my store".

The 60-day order window is a real constraint on §27's forecasting: comparable-history
features are thin until either `read_all_orders` is approved or the app has been installed
long enough to have accumulated its own history. The forecaster must report low sample size
rather than produce a confident number, which §27 requires anyway.

## The six platforms

Every row below is **unverified from this container**.

### Meta — Facebook Page + Instagram Business

Graph API. Needs a Meta app, Business Verification, and App Review for the publishing
permissions. Expected permission set: `pages_show_list`, `pages_read_engagement`,
`pages_manage_posts`, `pages_manage_engagement` (comments), `instagram_basic`,
`instagram_content_publish`, `instagram_manage_comments`, `business_management`; and
`ads_management` + `ads_read` only if paid is in scope.

- The Instagram account must be a **Business** account linked to a Facebook Page. A Creator
  or personal account cannot use the Content Publishing API.
- Publishing is a two-step create-container / publish-container flow with its own rate
  limit measured per 24 hours, separate from the Graph API's general limit.
- Alcohol ads in Australia require age targeting at 18+ and are prohibited in some
  markets — the ad account's own restrictions apply, not just ours.

### X

API v2. Paid access tiers; the free tier's write allowance is small and read access is
effectively absent. Posting limits, media upload limits and thread support all vary by
tier, so the capability registry must carry the **tier** as a field — a capability that is
true on Basic and false on Free is not a property of the platform.

Ads API is a separate restricted application. Assume unavailable for v1.

### TikTok

Content Posting API. Two things to establish before this is usable at all:

- **App audit.** An unaudited app can only post to the developer's own account, or in a
  sandbox. Direct posting on behalf of the business account requires TikTok's audit.
- **Asynchronous by design.** Publish returns a job id; status is polled to a terminal
  state. §22 requires exactly this and the `PublicationJob` model carries the provider job
  id for it.

### YouTube

Data API v3, OAuth on a Google Cloud project. The constraint that shapes the feature is
**quota**: an upload costs on the order of 1600 units against a default daily quota of
10,000, so roughly six uploads a day before a quota increase request. Publishing more than
that is a scheduling constraint the calendar must know about, not a runtime surprise.

Requires a verified channel for videos over 15 minutes, which Shorts and standard product
videos will not hit.

### Pinterest

API v5. Standard access requires an app review; trial access is rate-limited and
account-limited. Pinterest's advertising policy on alcohol varies by market and must be
checked for Australia specifically before any paid Pin is built.

## Alcohol restrictions expected

These are the ones that likely remove a stated feature. §21 requires the app to explain
why an action is unavailable and offer an export or assisted workflow instead — never a
disabled button with no reason, and never a simulated success.

| Feature in the prompt | Expected status | Consequence |
| --- | --- | --- |
| §12 "eligible product tags" on Instagram | **Expected unavailable.** Product tagging requires Instagram Shopping, which sits under Meta's Commerce Policy prohibition on alcohol | Instagram variants carry a tracked link in bio/Story sticker instead; the product-tag field is absent, with the reason shown |
| §21 TikTok Shop / native checkout | **Expected unavailable** for an Australian liquor retailer | Age-appropriate link to the Shopify store. §21 already instructs this |
| TikTok paid advertising | **Expected prohibited** — TikTok's policy excludes alcohol from advertising | Organic only on TikTok. Paid creative for TikTok is not built |
| Meta paid advertising | Available with 18+ age targeting in AU, subject to the ad account's restrictions | Built, behind dual control (§20) |
| Instagram Story stickers with links | Depends on account eligibility | Capability-gated; falls back to link in bio |
| Age-gating on profiles | Platform-specific settings, some manual | `social/profiles.json` on PR #12 already records the per-platform setting |

Two further Australian constraints that are ours rather than the platforms':

- **ABAC** applies to the content itself and is enforced by `packages/compliance` before
  approval, not by the platform.
- **Age-restricted targeting** must be set on every paid campaign and verified in the
  preflight check, because a correct audience configured once can be edited later by
  anyone with ad account access.
