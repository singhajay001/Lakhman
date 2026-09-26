# 10 — Delivery plan and file manifest

## Phases

§40's seven phases, each with an exit gate. A phase is not finished when the code exists; it
is finished when the gate passes and what it could not verify is written down. §4 requires
type check, lint, unit and relevant integration tests after every milestone — that is
assumed throughout and not repeated per row.

### Phase 1 — Foundation

Monorepo, Docker Compose, embedded app shell with all 23 navigation sections (empty states,
not stubs that pretend), Shopify OAuth, session storage, HMAC-verified webhooks, product and
inventory sync with reconciliation, roles and permissions, audit log, the sixteen provider
interfaces with mock adapters, cost meter, structured logging.

*Exit gate:* app installs into a dev store (or the mock Shopify) and loads in Admin; a product
sync completes and reconciles; a webhook replay is provably idempotent; an unpermitted role is
refused at the loader; every provider reports `mock` honestly in the UI. **Buildable in this
container in full.**

### Phase 2 — Knowledge and campaigns

Research engine with claim/source/confidence and the approval interface; Brand Kit seeded from
`docs/spirithaus/theme-profile.json` with version history; campaign builder; six platform
variant generators; SEO and content-quality scoring with per-dimension reasons; the ABAC and
platform compliance engine; approvals with content hashing and dual control.

*Exit gate:* a campaign generates six genuinely different platform variants from one strategy;
an unapproved fact cannot reach copy; a caption edit invalidates its approval; a deliberately
non-compliant draft is blocked with rule, severity and evidence; dual control refuses a
single-user attempt. **Buildable here, with mock or real text providers.**

### Phase 3 — Protected media

The eight-stage pipeline in [06](06-protected-product-pipeline.md); mask editor; environment
generation; four-part verification; `packages/media-geometry` ported to platform profiles;
Remotion templates (whisky reveal, wine region, craft beer, cocktail recipe, new arrival,
weekend offer, gift guide, comparison, staff pick, collection showcase); voice with cloning
disabled; caption timing from word alignment; render queue with progress, cancellation and
cost estimate.

*Exit gate:* a composited asset passes all four protection checks; a deliberately altered
label fails on the correct check with a difference overlay; a 9:16 render completes as a
durable job that survives a worker restart; the geometry engine reports per viewport, and its
per-asset verdict is labelled as the worst viewport rather than a score.

### Phase 4 — Connections and publishing

OAuth for five platforms; the versioned capability registry with its verification gate;
preflight; content calendar with the twelve states; idempotent fan-out publishing; partial
success; retry of failed destinations only; TikTok's asynchronous polling; emergency stop.

*Exit gate:* one campaign action produces one job per destination; a forced failure on two of
five destinations reports partial success and retries only those two; a retry cannot
republish a success; an unavailable capability explains itself and offers an export.
**Needs the allowlist widened or a session with network access; runs fully against mocks
until then, and a mock never claims a publication succeeded.**

### Phase 5 — First-party data

Web Pixel extension; event ingestion with idempotency; marketing identity chain; Shopify
segments; contribution margin ex-GST; the eight-model attribution table; optional Klaviyo
adapter, disabled.

*Exit gate:* a seeded journey from post click to confirmed order appears under last-click,
first-click and assisted with different numbers; unattributed shows as its own row; a
duplicate pixel event does not double-count; margin is labelled estimated when `unitCost` is
absent.

### Phase 6 — Intelligence and optimisation

Competitor and trend intelligence with sources and freshness; predictive scheduling in
recommendation mode; evergreen assessment; near-duplicate prevention; forecasting with
calibration monitoring; experiments with stopping rules the AI cannot override.

*Exit gate:* a schedule recommendation shows window, alternatives, confidence, evidence,
sample size and freshness, and falls back safely on thin data; an evergreen classification
refuses on stock, margin or licence grounds; a near-duplicate is caught by perceptual hash;
an experiment cannot be stopped early by a favourable interim result.

### Phase 7 — Community and paid

Unified inbox; classification and AI-drafted replies that always require approval; paid
creative workflow; budget controls; dual approval above threshold.

*Exit gate:* a sensitive classification (refund, intoxication, minor, health, legal) cannot be
auto-sent under any configuration; a paid activation above threshold requires two distinct
users; a budget ceiling refuses rather than warns.

## File manifest

What Phase 1 creates. Later phases extend within the same tree; the shape does not change.

### Root

```
package.json                    pnpm workspaces, turbo pipeline
pnpm-workspace.yaml
turbo.json
tsconfig.base.json              strict, noUncheckedIndexedAccess
.editorconfig  .gitignore  .npmrc
eslint.config.js  .prettierrc
docker-compose.yml              postgres 16, redis 7, minio, mailhog
Dockerfile                      multi-stage; web and worker from one image
.env.example                    every variable, no secrets
README.md                       setup, commands, architecture map
docs/adr/0001-embedded-app-stack.md
docs/adr/0002-queues-bullmq-behind-a-port.md
docs/adr/0003-providers-are-adapters-with-first-class-mocks.md
docs/adr/0004-protected-product-composite-is-deterministic.md
docs/adr/0005-attribution-is-first-party-and-gst-exclusive.md
.github/workflows/ci.yml        typecheck, lint, unit, integration, migrate check
```

### `apps/social-studio`

```
shopify.app.toml                scopes split mandatory/optional, webhooks
app/shopify.server.ts           OAuth, session storage, GraphQL client
app/root.tsx  app/entry.*.tsx
app/routes/app.tsx              App Bridge + Polaris frame, nav
app/routes/app._index.tsx                       Dashboard
app/routes/app.products.*.tsx                   Products
app/routes/app.research.*.tsx                   Research Library
app/routes/app.intelligence.*.tsx               Intelligence Hub
app/routes/app.trends.*.tsx                     Trend Opportunities
app/routes/app.competitors.*.tsx                Competitor Watch
app/routes/app.campaigns.*.tsx                  Campaigns
app/routes/app.create.*.tsx                     Create
app/routes/app.media.*.tsx                      Media Studio
app/routes/app.calendar.*.tsx                   Content Calendar
app/routes/app.approvals.*.tsx                  Approvals
app/routes/app.queue.*.tsx                      Publish Queue
app/routes/app.inbox.*.tsx                      Community Inbox
app/routes/app.segments.*.tsx                   Audience Segments
app/routes/app.forecasting.*.tsx                Forecasting
app/routes/app.experiments.*.tsx                Experiment Centre
app/routes/app.analytics.*.tsx                  Analytics
app/routes/app.brand-kit.*.tsx                  Brand Kit
app/routes/app.connections.*.tsx                Social Connections
app/routes/app.automation.*.tsx                 Automation Centre
app/routes/app.governance.*.tsx                 AI Governance
app/routes/app.settings.*.tsx                   Settings
app/routes/app.audit.*.tsx                      Audit Log
app/routes/webhooks.$topic.tsx                  HMAC verified before parse
app/routes/api.events.tsx                       Web Pixel sink (Phase 5)
app/lib/auth/require-permission.server.ts
app/lib/session.server.ts
extensions/web-pixel/                           Phase 5
```

### `apps/worker`

```
src/index.ts                    worker bootstrap, graceful shutdown
src/queues/shopify-sync.ts  research.ts  generation.ts  render.ts
src/queues/transcode.ts  publication.ts  analytics.ts  attribution.ts
src/queues/token-refresh.ts  reconciliation.ts  cleanup.ts
src/middleware/idempotency.ts  cost-guard.ts  tracing.ts
```

### `packages`

```
db/prisma/schema.prisma         migration 1–3 in Phase 1
db/prisma/migrations/
db/src/client.ts  seed.ts
domain/src/{shopify-sync,research,intelligence,strategy,brand,content,
            protected-assets,media,seo,compliance,approvals,connections,
            publishing,scheduling,community,analytics,attribution,
            forecasting,experiments,notifications,audit}/
providers/src/contracts/*.ts    the sixteen interfaces
providers/src/wrapper/{retry,timeout,usage,cost,redact}.ts
providers/src/adapters/{anthropic,fal,elevenlabs,s3,klaviyo,
                        meta,x,tiktok,youtube,pinterest}/
providers/src/adapters/mock/*.ts
capabilities/src/{registry.ts,profiles/*.json,verification-gate.ts}
compliance/src/{abac,platform-policy,acl,report}/
media-geometry/src/{engine.ts,platform-profile.ts,profiles/*.json}
protected-assets/src/{mask.ts,composite.ts,verify/{pixel,ocr,structure,colour}.ts}
attribution/src/{identity.ts,ingest.ts,models/*.ts,margin.ts}
jobs/src/{port.ts,bullmq-adapter.ts,definitions/*.ts}
observability/src/{logger.ts,tracer.ts,metrics.ts,cost-meter.ts}
testing/src/{mock-shopify,factories,fixtures}/
```

### `apps/render` (Phase 3)

```
remotion.config.ts
src/Root.tsx
src/compositions/{WhiskyReveal,WineRegion,CraftBeer,CocktailRecipe,
                  NewArrival,WeekendOffer,GiftGuide,Comparison,
                  StaffPick,CollectionShowcase}.tsx
src/components/{ProductLayer,Scrim,AnimatedType,CaptionTrack,
                ResponsibilityEndFrame}.tsx
src/fonts/                      symlinked from docs/spirithaus/fonts
```

### Modified, not created

`docs/spirithaus/tools/calibrate.mjs` is **not modified** — it keeps working as the storefront
tool. `packages/media-geometry` is a port with its measurement logic extracted into a shared
module and the two callers reading different profiles, so a defect fixed in one is fixed in
both. `docs/spirithaus/theme-profile.json`, `fonts/` and `image-prompt-pack.md` are read as
Brand Kit and prompt seeds, never written.

The root `lakhman-platform` file is removed if the monorepo answer to blocking question 1 is
yes, since the workspace root replaces whatever it was a placeholder for. Not before you
confirm.

## What I need to start

Phase 1 needs none of the external dependencies in [09](09-risks.md) and no credential. It
needs answers to blocking questions 1 and 3 — where the code lives, and what it deploys to —
and it can start on question 1 alone, with the deployment target deferred to the first
Dockerfile decision.
