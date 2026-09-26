# Deploying SPIRITHAUS Social Studio

Written for whoever puts this on a staging host for the first time.

## Read this before the guides

**Nothing here has ever been deployed.** These documents are derived from the code and from
what was verified on a development machine — not from a deployment anybody performed. Steps that
have been run somewhere are marked *verified*; steps that follow from the code but have never
been executed are marked *unverified*, and there are more of the second kind than the first.

That distinction matters more than usual on this project, because three things stay untrue until
someone with real credentials and real network access makes them true:

- **The Shopify Admin API has never been called.** This build's container refuses
  `*.myshopify.com`, so every Admin path is covered by tests against a mocked client and by this
  environment's real refusal. The failure path is well measured. The success path is not measured
  at all.
- **OAuth has never been completed**, so no session has ever been stored and no offline token has
  ever existed. The callback's failure modes were exercised against a running server; the success
  branch has never run.
- **No platform figure is verified.** Caption limits, hashtag ceilings, media specs and safe-zone
  insets are this repository's first-party reading, carrying `verified: false` and
  `PLATFORM_PROFILE_VERSION = '2026-09-26.unverified'`.

The first staging deployment is therefore the first real test of all three, and should be treated
as an experiment with expected findings rather than a rollout.

## The documents

| | |
| --- | --- |
| [`readiness-report.md`](readiness-report.md) | **Start here.** What is verified, what is not, what needs approval, and what it costs |
| [`platform.md`](platform.md) | The recommended staging platform, its cost, topology, health checks, backups and rollback |
| [`environment-matrix.md`](environment-matrix.md) | Every variable the code actually reads, and the minimum egress allowlist |
| [`session-security.md`](session-security.md) | How Shopify access tokens are stored, what protects them, and what to change before production |
| [`development-store.md`](development-store.md) | Partner Dashboard settings and the install runbook for a development store |
| [`configuration.md`](configuration.md) | Environment, egress and Partner Dashboard settings in prose |
| [`staging.md`](staging.md) | The deployment itself, in order, with what to check after each step |
| [`runbook.md`](runbook.md) | Symptom to cause to fix, for the failure modes this system deliberately produces |

## What must not happen without separate authorisation

Sections 39 and 43 of the brief require explicit, separate authorisation for each of these, and
none has been given:

- **No publishing.** Every publisher adapter is a mock and reports `published: false`. Staging
  must not be pointed at a real social account.
- **No spend.** No AI provider, no paid API, no advertising budget.
- **No live account connection.** Connecting a real Meta, TikTok, X, YouTube or Pinterest account
  is a separate decision.
- **No production data.** Staging should use a development store, not the live shop.

Deploying to staging is itself a step worth confirming before it is taken. This guide exists so
that the decision can be made with the facts in view; it is not the decision.
