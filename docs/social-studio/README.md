# SPIRITHAUS Social Studio — first response

This folder is the response §44 of the master build prompt asks for **before any
repository file is edited**. Nothing here is application code; no runtime, package
manifest, schema or provider adapter has been created yet. The build starts when
you authorise it.

Read in this order. The first three carry every decision that is expensive to
reverse.

| | |
| --- | --- |
| [01-assessment.md](01-assessment.md) | What is in this repository, what is reusable, and what this container can and cannot reach |
| [02-architecture.md](02-architecture.md) | Stack, monorepo shape, service boundaries, the sixteen provider contracts |
| [03-data-model.md](03-data-model.md) | Entities, tenancy, idempotency, the migration sequence |
| [04-platforms-and-scopes.md](04-platforms-and-scopes.md) | Shopify scopes split mandatory/optional, and the six platforms' apps, reviews and alcohol limits |
| [05-providers.md](05-providers.md) | One provider per overlapping category, with metered unit and cost driver |
| [06-protected-product-pipeline.md](06-protected-product-pipeline.md) | How a real bottle survives a generated environment, and how that is proven |
| [07-attribution.md](07-attribution.md) | The identity chain, and contribution margin computed ex-GST |
| [08-approvals.md](08-approvals.md) | Roles, content hashing, dual control, emergency stop |
| [09-risks.md](09-risks.md) | Risks, assumptions, external dependencies |
| [10-delivery-plan.md](10-delivery-plan.md) | Seven phases with exit criteria, and the exact file manifest |

## The three findings that shape everything else

**1. Social Studio is greenfield, but the visual-truth work is already half-built.**
This repository holds no application — no `package.json`, no framework, no schema.
It holds something more useful: a measurement engine (`docs/spirithaus/tools/calibrate.mjs`,
790 lines, zero dependencies) that already answers, for a real photograph against a
real layout, *does the subject survive the crop, does type land on it, does the veil
swallow it*. That is the same question every platform variant asks, with a different
viewport matrix. §16's safe-zone validation is a port, not a build. See
[01](01-assessment.md#what-is-reusable) and [06](06-protected-product-pipeline.md#geometry-validation-is-a-port-not-a-build).

**2. This container cannot reach Shopify or any social platform.** The environment's
network policy answers 403 at CONNECT for `cdn.shopify.com`, `spirithaus.com.au` and
`graph.facebook.com`; package registries are open. So §4's instruction to verify every
API version and posting limit against current official documentation **cannot be
carried out from here**, and the capability registry cannot be seeded with verified
values. Everything platform-facing will be built against provider contracts and mocks,
with a documented verification gate before any of it is trusted. This is a real
limitation on what the first phases can claim, not a detail. See
[01](01-assessment.md#what-this-container-can-reach) and [09](09-risks.md).

**3. Two of §12's stated features look unavailable to an Australian liquor retailer.**
Instagram product tagging depends on Instagram Shopping, which sits under Meta's
Commerce Policy prohibition on alcohol; TikTok prohibits alcohol in paid advertising
outright. §21 requires the app to say so rather than ship a dead button. Both are
recorded as *expected unavailable, pending verification* in the capability registry
design rather than as features. See [04](04-platforms-and-scopes.md#alcohol-restrictions-expected).

## Ten blocking questions

Everything else in these documents has a default chosen and explained. These ten
change what gets built, so I have not guessed.

1. **Where does the application live?** This repo as `apps/social-studio` in a pnpm
   workspace, or a new dedicated repository? The empty `lakhman-platform` file at the
   root hints at a wider platform, which would argue for the monorepo. Every path in
   [10](10-delivery-plan.md) assumes the monorepo until you say otherwise.
2. **Shopify Partner org and a development store.** Can you create the app in your
   Partner organisation and add me to a dev store? Without it, OAuth, sync and webhooks
   are mock-only. Related: do you want the environment's network allowlist widened to
   `*.myshopify.com`, `cdn.shopify.com` and the platform API hosts? That is a settings
   change on your side and I can point you at the page.
3. **Hosting target.** AWS, GCP, or a PaaS (Fly/Render/Railway)? This decides BullMQ-on-Redis
   versus SQS + EventBridge ([02](02-architecture.md#queues)), the object store, and the
   secret manager. Default assumed: single-cloud PaaS with managed Postgres and Redis.
4. **Which AI providers am I authorised to write adapters against?** Text is assumed
   Anthropic. The image provider is the consequential one, because it decides the
   masking and conditioning API the protected-product pipeline is written to — fal.ai
   (FLUX Fill + depth) is the default; Replicate and Google are the alternatives.
   Data-sharing terms need an administrator's sign-off per §28 either way.
5. **Is paid advertising in scope for v1, or organic only?** Meta's Marketing API needs
   Business Verification and App Review with a lead time measured in weeks. Default
   assumed: organic only through Phase 4, paid deferred to Phase 7.
6. **What is the dual-control budget threshold, in AUD?** §20 requires two keys above a
   configured threshold. I will seed a placeholder and require an administrator to set
   it before any paid feature activates; naming it now avoids a migration.
7. **Is `inventoryItem.unitCost` populated in Shopify?** Contribution margin is the
   first-ranked metric in §26 and it needs COGS. If unit cost is empty, margin falls
   back to a per-collection default rate that a Finance Approver sets, and every margin
   figure is labelled as estimated.
8. **Who holds the six platform accounts?** PR #12 establishes that none exist yet and
   that `spirithausau` is the handle strategy. Until the accounts exist and the Meta
   ones are converted to Business/Creator, publishing can only be mocked. Confirm the
   handle and who will run the signups.
9. **Which address is the licensed premises?** PR #12 flagged that the storefront policy
   pages and the Shopify account name different suburbs. The Brand Kit is the
   authoritative record for business details under §14, so it should not be seeded with
   a contradiction. Licence number `LIQP700301260` is taken as confirmed, since the
   storefront already publishes it on five pages.
10. **Merge PR #12 first?** It adds `social/profiles.json`, which is the natural seed for
    the Social Connections registry — handle, tier, age-gate setting, per-platform URL
    shape. If it stays open, Phase 4 either duplicates that file or waits on it.

## Scope note

§41's MVP is sixteen capabilities deep and §35 lists forty-plus entities. A build this
size is not one authorisation. What I would like authorised now is **Phase 1**, which is
self-contained, testable without any external credential, and produces something you can
open: the embedded app shell, roles, audit, product sync against a mock Shopify, and the
sixteen provider interfaces with their mock implementations. Phases 2 onward each have an
exit gate in [10](10-delivery-plan.md) and I will not run past one without telling you
what it cost and what it could not verify.
