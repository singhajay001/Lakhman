# 9 — Risks, assumptions, external dependencies

## Risks, worst first

**1. The network policy blocks verification, and §4 requires it.**
`cdn.shopify.com`, `spirithaus.com.au` and `graph.facebook.com` are refused at CONNECT.
Every API version, scope, posting limit, media specification and market restriction in
[04](04-platforms-and-scopes.md) is therefore unverified. *Mitigation:* the capability
registry carries `verified: false` plus a documentation URL, the UI refuses to enable an
unverified capability, and Phases 1–3 are scoped to need no external host. *Resolution:*
widen the allowlist (settings change on your side — I can point you at the page), or run
Phase 4 from a session that has access.

**2. App review lead times are not engineering time.**
Meta Business Verification plus App Review, TikTok's app audit, Pinterest standard access,
and possibly a YouTube quota increase. Weeks, in parallel, and none of them start until the
accounts exist — and per PR #12, none of the accounts exist. *Mitigation:* start the
applications during Phase 1, not Phase 4; build every adapter against its mock so review
status gates a feature flag rather than a delivery date.

**3. Two features in the prompt are probably not available at all.**
Instagram product tagging (Commerce Policy on alcohol) and TikTok paid advertising (policy
prohibition). *Mitigation:* both recorded as expected-unavailable with the reason surfaced in
the UI, per §21. *Risk that remains:* this changes what §41 and §42 can mean. It should be
acknowledged rather than engineered around.

**4. The photography corpus does not meet the current guidance.**
Nine of fifteen delivered hero frames put the subject outside the safe horizontal band, and
all fifteen fail both scrim models at phone width. The Media Studio's early output is limited
by its inputs. *Mitigation:* the reshoot run sheet already exists in
`docs/spirithaus/image-prompt-pack.md`; the geometry engine makes the failure legible per
viewport instead of per asset.

**5. Verification thresholds are uncalibrated, everywhere.**
The scrim harness's 90/5/40 are uncalibrated starting points; the ΔE and SSIM thresholds in
[06](06-protected-product-pipeline.md) will be too. A threshold presented as derived when it
was chosen is the failure mode the existing reports in this repo were careful to avoid.
*Mitigation:* ship configurable, label uncalibrated, derive from a labelled corpus later —
and note that the last attempt at deriving thresholds returned null on all six because every
label was a viewport judgement and no frame was judged as a frame. Calibration is harder than
it looks.

**6. Scope. §35 lists forty-plus entities and §41 an MVP sixteen capabilities deep.**
Built as one undifferentiated push, this produces a large amount of untested surface.
*Mitigation:* the seven phases in [10](10-delivery-plan.md), each with an exit gate, each
shippable. I would rather deliver Phase 1 working than Phase 1–4 nearly working.

**7. Cost is unbounded by default in a generative product.**
A careless batch of video renders costs real money. *Mitigation:* the four-level budget model
in [05](05-providers.md), estimates before expensive work, hard ceilings that refuse. The
estimator's own drift is monitored, because a budget control built on a bad estimate is not one.

**8. Prompt injection through research sources.**
The research engine reads third-party pages by design. *Mitigation:* [02](02-architecture.md#security-posture)
— wrapped as data, provenance tagged, SSRF-guarded fetch, and the standing requirement that no
claim becomes a fact without human approval.

**9. The 60-day order window starves forecasting.**
Without `read_all_orders` (Shopify's approval, not the merchant's), comparable history is thin
and §27's forecasts must report low sample size rather than a confident range. *Mitigation:*
that is what §27 requires anyway; the app accumulates its own history from install.

**10. The licensed-premises contradiction.**
The storefront policy pages and the Shopify account name different suburbs. The Brand Kit is
the authoritative record of business details under §14 and should not be seeded with a
contradiction. Blocking, only for the Brand Kit seed. Blocking question 9.

## Assumptions

Each of these is acted on unless you say otherwise.

1. SPIRITHAUS is a single Shopify store; the app is multi-tenant by construction anyway.
2. Prices in Shopify are AUD and GST-inclusive; net revenue divides by 1.1
   ([07](07-attribution.md)).
3. `Australia/Sydney` for display, UTC in storage.
4. The theme is Dawn-derived and `theme-profile.json` describes it accurately as of
   2026-09-24; the staleness check is the tooling's job, not this app's.
5. Theme writes remain blocked over the Admin API on this store, so anything touching the
   storefront (the Web Pixel aside, which installs as an app extension) is a documented
   manual step.
6. Licence number `LIQP700301260` is correct — the storefront publishes it on five pages.
7. Organic first, paid deferred to Phase 7 (blocking question 5).
8. Voice cloning stays disabled; licensed synthetic voices only (§17).
9. AI-avatar video stays disabled through Phase 6 (§18).
10. No deployment, no purchase, no live account connection, no spend and no publication
    without separate explicit authorisation (§39, §43). This includes creating the platform
    accounts and creating the Shopify app in your Partner org.

## External dependencies

| | Needed by | Blocked until |
| --- | --- | --- |
| Shopify Partner org + app + dev store | Phase 1 real OAuth | you create it (question 2) |
| Network allowlist widened | Phase 4 verification | settings change on your side |
| Six platform accounts, business-converted | Phase 4 | signups (question 8) |
| Meta app + Business Verification + App Review | Phase 4 Meta publishing | Meta |
| TikTok app + audit | Phase 4 TikTok publishing | TikTok |
| Google Cloud project + OAuth consent + possible quota increase | Phase 4 YouTube | Google |
| Pinterest app + standard access | Phase 4 Pinterest | Pinterest |
| X developer account at a tier that permits posting | Phase 4 X | a paid subscription decision |
| Provider API keys | Phases 2–3 with real providers | your enablement + data-sharing review |
| Hosting, managed Postgres, Redis, object storage | any deployment | question 3 |
| A labelled corpus of composited assets | threshold calibration | after Phase 3 produces assets |
