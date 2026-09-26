# 2 — Architecture and service boundaries

## Stack

§5's preferred stack is adopted essentially as written, because there is no existing
architecture to preserve. Where a choice was left open, the default is below with its
reason.

| | Decision | Why |
| --- | --- | --- |
| Language | TypeScript, `strict: true`, `noUncheckedIndexedAccess` | §5 |
| App framework | React Router 7 — Shopify's current embedded app template | The Remix template was superseded; verify the template version at scaffold time rather than trusting this line |
| UI | Polaris + App Bridge, Polaris web components where the template uses them | §8 |
| DB | PostgreSQL 16 + Prisma | §5 |
| Queues | BullMQ on Redis 7 | See [Queues](#queues) |
| Storage | S3-compatible, private bucket, signed URLs with short TTL | §5 |
| Media | Remotion 4 (ships its own FFmpeg) + `ffmpeg-static` + `sharp` | §16; `ffmpeg` is absent from this container |
| Tests | Vitest (unit/integration), Playwright (e2e + the geometry engine's browser driver) | §5, §38 |
| Dev | Docker Compose: postgres, redis, minio, mailhog | §5 |
| Observability | pino → structured JSON, OpenTelemetry traces, Sentry for errors | §37 |
| Monorepo | pnpm workspaces + Turborepo | Worker and app share the domain packages; one lockfile |

Node 22 is what the container has and what the template targets, so `engines.node: ">=22"`.

## Queues

BullMQ on Redis is the default, and the reason is §36's requirement that scheduled
publication not depend on an open browser plus §22's requirement that a retry never
republish a successful job. BullMQ gives durable delayed jobs, per-queue concurrency,
rate-limit buckets sized to each platform's posted limits, and job IDs that make
idempotency a primary key rather than a convention.

§5 says to prefer SQS + EventBridge + Step Functions if the deployment is AWS-based. It is
not yet — that is blocking question 3. The publishing layer is therefore written against a
narrow internal `JobQueue` port (enqueue, enqueueAt, cancel, progress, complete, fail)
with the BullMQ adapter behind it, so an AWS answer costs one adapter rather than a
rewrite. Two clouds are not operated; §5 forbids it and nothing here needs it.

## Monorepo shape

```
apps/
  social-studio/          embedded Shopify app — React Router 7, Polaris, App Bridge
  worker/                 BullMQ workers; same domain packages, no HTTP surface
  render/                 Remotion project: compositions, fonts, templates
packages/
  db/                     Prisma schema, migrations, generated client, seed
  domain/                 entities, invariants, pure business rules — no I/O
  shopify/                Admin GraphQL client, sync, webhooks, HMAC, bulk ops
  providers/              the sixteen contracts + adapters + mocks + capability detection
  compliance/             ABAC rule engine, platform policy rules, report builder
  media-geometry/         port of docs/spirithaus/tools/calibrate.mjs to platform profiles
  protected-assets/       masks, composite, OCR + similarity verification
  attribution/            identity chain, event ingestion, margin computation
  capabilities/           versioned platform capability registry + verification gate
  jobs/                   JobQueue port, BullMQ adapter, job definitions, idempotency
  observability/          logger, tracer, metrics, cost meter
  testing/                fixtures, mock Shopify, factory helpers
```

`domain` has no imports outside itself and the standard library. That is what makes §38's
unit tests — UTMs, content similarity, dual approval, evergreen eligibility, timezone
conversion — fast and honest rather than integration tests wearing a unit test's name.

## Service boundaries

§6's list, as modules inside `packages/domain` with their own service objects. The
boundaries that carry a rule rather than just a namespace:

| Module | The rule it owns |
| --- | --- |
| `shopify-sync` | The only writer of `ShopifyProduct*`. Nothing else may write cached Shopify state |
| `research` | Separates verified claim from inference; conflicts are surfaced, never resolved |
| `brand-governance` | Resolves the Brand Kit **version** an asset was made under, and never mutates a published record |
| `protected-assets` | The only code that may composite product pixels; the only code that may declare a protected region intact |
| `compliance` | Advisory or blocking, never silent; every result carries rule, severity, evidence |
| `approvals` | Holds the content hash. Any material edit invalidates. Enforces key separation |
| `publishing` | One campaign action fans out to one idempotent job per destination |
| `scheduling` | Recommends; may only move within an approved window |
| `attribution` | Owns the metric ranking. Vanity metrics cannot be promoted by configuration |
| `governance` | Records model, prompt version, source facts and settings for every generated asset |

Two invariants are enforced at the database level rather than in a service, because a
service can be bypassed by the next feature: publication idempotency keys are unique, and
an approval key pair cannot be satisfied twice by the same user ([03](03-data-model.md)).

## The sixteen provider contracts

§6's list, each a TypeScript interface in `packages/providers/contracts/`. Every adapter
implements the same envelope — this is the part that makes provider independence real
rather than aspirational:

```ts
interface ProviderAdapter {
  readonly id: string;                      // "anthropic", "fal", "elevenlabs", "mock"
  capabilities(): Promise<Capability[]>;    // detected, not declared
  validateConfig(): ConfigResult;           // missing key is a startup error, not a 500
  health(): Promise<HealthResult>;
  estimateCost(req: unknown): CostEstimate; // AUD, from the configured rate card
}
```

and every call returns `Result<T, ProviderError>` where `ProviderError` carries a
classification (`auth` / `rate_limit` / `quota` / `invalid_input` / `policy` /
`transient` / `unavailable`), the provider's own request id, retry advice, and the usage
record to log. Timeouts and retries live in a shared wrapper, not in each adapter, so a
new adapter cannot forget them.

`TextGenerationProvider`, `ResearchProvider`, `TrendIntelligenceProvider`,
`CopyScoringProvider`, `ImageGenerationProvider`, `ImageEditingProvider`,
`AvatarVideoProvider`, `VoiceProvider`, `VideoGenerationProvider`, `VideoRenderProvider`,
`ModerationProvider`, `SocialPublishingProvider`, `SocialAnalyticsProvider`,
`AttributionProvider`, `EmailMarketingProvider`, `ObjectStorageProvider`.

**Mocks are first-class, not test doubles.** `PROVIDER_<NAME>=mock` is a supported
production-shaped configuration, because §21 forbids simulating publication success: a
mock publisher returns a mock-flagged result that the UI renders as *not published*, and
`PlatformPost.external` stays null. A mock that returned a plausible post URL would be the
exact failure §43 prohibits.

`ModerationProvider` deserves a note: the ABAC and platform rule engine in
`packages/compliance` is **not** a provider. It is first-party, versioned, auditable code,
because §32 requires evidence and a reviewer decision per rule and a vendor score cannot
supply either. An external moderation provider is advisory input to it, labelled as such.

## Request and job flow

Nothing user-facing does slow work inline. A generation request writes a job row, enqueues,
and returns; the editorial workspace subscribes to progress. This is §36's durability
requirement and also §19's — a browser closed mid-render must not lose the render.

Publication specifically, per §22:

1. Campaign action validated once (approval, facts, stock, price, URL, terms, media,
   disclosures, platform rules, token health) and the exact final content shown for
   confirmation.
2. One `PublicationJob` per destination, `idempotencyKey = sha256(campaignId, variantId,
   destinationId, approvalVersionId)`.
3. Dispatch. Provider response, external id, public URL and processing state recorded per
   attempt.
4. Asynchronous APIs (TikTok) keep the provider job id and poll to a terminal state.
5. Retry re-enqueues **failed destinations only**; a job in a succeeded state is refused
   at the queue boundary, not by a check inside the handler.

## Security posture

§33 in one place: server-side session validation on every request, CSRF tokens on
mutations, OAuth state plus PKCE where the platform supports it, HMAC verification on
every Shopify webhook before the body is parsed, tokens encrypted at rest with a KMS-held
key and never rendered into a response, CSP without `unsafe-inline`, upload MIME and size
checks with magic-byte sniffing, per-shop rate limits, dependency scanning in CI.

Two that need naming because they are specific to this product:

**Research sources are untrusted input.** Retrieved page content never enters a prompt as
instructions. It is wrapped, tagged with its origin, and the system prompt states that the
wrapped region is data. Extracted claims carry provenance and cannot become facts without
human approval anyway, which is the second line of defence.

**URL retrieval is SSRF-guarded**: DNS resolved and checked against a private-range
denylist before connect, redirects re-checked at each hop, outbound restricted to an
allowlist of research destinations, response size and content-type capped.
