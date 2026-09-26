# SPIRITHAUS Social Studio

An embedded Shopify Admin application: a human-controlled, AI-assisted marketing command
centre for SPIRITHAUS, a Sydney liquor retailer.

**Phases 1 to 3 of seven are built.** The foundation — embedded app, authentication,
roles, audit, product sync, webhooks, the sixteen provider contracts with honest mocks —
then the knowledge and campaign layer: research with per-claim approval, a Brand Kit
seeded from the live theme, one strategy producing six independently derived platform
variants, the ABAC compliance engine, explainable content scoring, and approvals with
content hashing and dual control. Phase 3 adds the media layer: a protected-product
staging pipeline that composites a masked bottle over a generated environment without
touching a pixel of it, four independent checks that say so on real pixels, per-viewport
safe-zone measurement ported from `calibrate.mjs`, and programmatic video renders driven
headlessly from a worker.
Every later phase has a plan and an exit gate in
[`docs/social-studio/10-delivery-plan.md`](docs/social-studio/10-delivery-plan.md), and
every screen that belongs to one says which phase builds it instead of showing an empty
version of itself.

The design documents that precede the code are in
[`docs/social-studio/`](docs/social-studio/README.md); the decisions taken while writing
it are in [`docs/adr/`](docs/adr/).

## Running it

Requires Node 22 and pnpm 9.

```sh
cp .env.example .env          # fill in SHOPIFY_API_KEY and SHOPIFY_API_SECRET
docker compose up -d          # postgres, redis, minio
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed                  # roles, permissions, model registry, and a dev shop
pnpm dev                      # the app
pnpm dev:worker               # the queue worker, in another terminal
```

Without `SHOPIFY_API_KEY` the app refuses to start rather than failing halfway through an
OAuth callback. Without `REDIS_URL` it falls back to an in-memory queue and says so; the
worker refuses to start at all, because a worker with no queue would look healthy while
doing nothing.

To install into a development store you need a Shopify Partner app
(`shopify app config link` writes its client id into `shopify.app.toml`). Everything else
runs against mocks.

## Verifying it

```sh
pnpm verify            # typecheck, lint, 445 unit tests, and the app build
pnpm test:integration  # 85 tests against a real Postgres and Redis
```

The app build is part of `verify` deliberately: a shared package accidentally pulling a
Node built-in into the browser bundle is invisible to `tsc` and to the tests, and only the
bundler finds it (`docs/adr/0008`).

`pnpm test` needs neither Postgres nor Redis. The integration project needs both, which is
why they are separate projects rather than one suite that skips.

**The integration project truncates tables**, so point `DATABASE_URL` at a database you
are happy to lose. CI uses `spirithaus_test` for exactly this reason.

To see the app with data in it, without Shopify:

```sh
pnpm --filter @spirithaus/worker demo:sync
pnpm sync:shopify-assets      # real product artwork, if a catalogue is reachable
pnpm --filter @spirithaus/social-studio demo:media
pnpm calibrate:packshots      # re-runs the geometry against what was ingested
```

`demo:sync` fills the mirror from the fixture catalogue — five products including an
archived one, a draft, one out of stock and one with no unit cost, because a catalogue
that is all happy paths proves nothing.

`sync:shopify-assets` ingests real packshots into the protected-product pipeline: it takes
image #1 at its original resolution, cuts the backdrop where there is one, trims to the
subject, digests, masks, baselines the label colour and reads the label back. It needs a
rights basis stated on the command (`ASSET_LICENCE_HOLDER`, `ASSET_LICENCE_TERMS`) and has
no default, because a supplier's packshot carried in a retailer's catalogue is not
automatically licensed for marketing use. `SOURCE=admin` is the production path;
`SOURCE=storefront STOREFRONT_ORIGIN=…` reads the public catalogue, which is what works
where a network policy allows `cdn.shopify.com` but refuses `*.myshopify.com`. On Node 22
`fetch` ignores proxy environment variables, so behind an egress proxy it needs
`NODE_USE_ENV_PROXY=1`.

`demo:media` then composites whatever real masters were ingested, falling back to the
synthetic bottle and saying so when there are none. `calibrate:packshots` re-runs the
placement and per-viewport measurement against the ingested subjects and prints what it
finds; it writes nothing, because a calibration that silently rewrote the thresholds it
was checking would be worth nothing.

All are development scripts that refuse to run in production, and no mock is reachable
from a runtime path, so no environment variable can make the worker serve fixture data.

## What is built

|                             |                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| `apps/social-studio`        | The embedded app: 23 sections, OAuth, webhooks, product screens                             |
| `apps/worker`               | BullMQ workers. Scheduled work does not depend on an open browser                           |
| `packages/domain`           | Roles, permissions, audit vocabulary, Sydney time. No I/O, so its tests are fast and honest |
| `packages/providers`        | The sixteen contracts, the retry/timeout/redaction wrapper, and the mocks                   |
| `packages/shopify`          | HMAC verification, Admin GraphQL client, scope declarations, sync and reconciliation        |
| `packages/jobs`             | The `JobQueue` port, its BullMQ and in-memory adapters, idempotency keys                    |
| `packages/db`               | Prisma schema, migrations, seed, the append-only audit writer                               |
| `packages/observability`    | Structured logs with declared redaction, and the cost meter                                 |
| `packages/testing`          | A mock Shopify Admin API as a `fetch` implementation, and fixtures                          |
| `packages/media-geometry`   | The closed-form port of `calibrate.mjs`: safe zones and per-viewport visibility             |
| `packages/protected-assets` | Masks, deterministic compositing, renditions, and the four verification checks              |
| `apps/render`               | Remotion compositions, rendered headlessly. Imports nothing from the app                    |

## Eight things worth knowing before reading the code

**Mocks do not imitate success.** `PROVIDER_*=mock` is a supported configuration, not a
test double. A mocked publisher returns `published: false, state: 'not_published'` on
every platform, with no external id and no public URL, and a test asserts it. Section 21
of the brief forbids simulating publication, and a plausible post URL from a mock would be
exactly that.

**Nothing platform-facing is verified.** This environment's network policy refuses
`cdn.shopify.com`, `spirithaus.com.au` and `graph.facebook.com` at CONNECT, so no API
version, posting limit or policy could be checked against current documentation. Every
capability carries `verified: false`, and the Social Connections screen says so rather
than implying otherwise. See
[`docs/social-studio/04-platforms-and-scopes.md`](docs/social-studio/04-platforms-and-scopes.md).

**The app asks for no write access to merchant data.** No `write_products`,
`write_inventory`, `write_orders`, `write_customers` or `write_themes`. Product data is
truth, not output, and section 15's principle is stronger if the app _cannot_ edit it. The
Settings screen lists every scope with its reason, and the scopes it refuses to request.

**Several rules are enforced by Postgres, not by a service.** The audit trail rejects
UPDATE and DELETE; webhook events are unique per `(shop, topic, event id)`; a material
edit to a variant invalidates its approval by trigger and cascades to the approval row; a
key cannot be added to a closed approval, to one that already has its keys, or with a hash
the content has moved past; and an approval is granted atomically when its last key
lands. One person cannot hold both keys of a dual-control action, because a unique index
says so. All of it is tested against the real schema.

**Only approved facts reach copy, and the guard is honest about its reach.** The generator
receives a frozen fact sheet built from APPROVED research claims and Shopify data, and
nothing else. On top of that, the compliance engine blocks an ABV, age statement, award,
rating, vintage, price or availability claim the sheet does not support. That is a guard
over the claim types that carry the most risk when invented — it will not catch a
fabricated tasting note, and the rule documentation and a test both say so.

**Real packshots broke four things the synthetic bottle had made look true.** Its subject
is 0.643 wide for its height; real single-product packshots run 0.219 to 0.55. A packshot
is mostly empty canvas, so placing the frame rather than the subject undersized every
bottle. A minimum-edge gate is aspect-blind — it refused a 528×1622 Jack Daniel's that has
ample resolution and accepted a 600×600 square that has too little. And image #1 is not
always one product: Talisker 10 and Lark Devil's Storm are photographed beside their gift
boxes, and about a third of primary images are opaque JPEGs on white. Each of those is now
measured per product and recorded on the asset rather than assumed. `docs/adr/0011` has
the numbers.

**A protected product layer is never resampled.** Where a bottle must be smaller than its
master, a rendition is made as a recorded step with its own digest, and the composite
places it at scale 1 — because under a downscale the pixel check cannot run, OCR reads
identical honest content two different ways, and the structural check cannot separate a
resample (SSIM 0.9998) from a changed strength statement (0.9983). The master's bytes are
re-hashed on every composite; if storage no longer holds the artwork approved at ingestion
the composite is refused outright, not produced carrying a failure. `docs/adr/0009` has
the measurements.

**Six platforms, one strategy, and the structure is ours.** Platform differences — which
fields exist, how many hashtags, whether a link is clickable, what a storyboard needs —
are decisions in code, not something a model is trusted to get right. The prose comes from
the text provider. That split is why six genuinely different variants come out even with a
mocked provider, and why a test can assert the difference pairwise.

## Where the existing SPIRITHAUS work fits

`docs/spirithaus/` predates this application and is not documentation of it — it is input
to it. `theme-profile.json` holds the brand tokens the Phase 2 Brand Kit is seeded from;
`fonts/` holds the two licensed faces Remotion will render with; `image-prompt-pack.md`
is the seed for environment-generation prompts, already written to the ABAC code; and
`tools/calibrate.mjs` is the measurement engine that Phase 3's per-platform safe-zone
validation is a port of, not a rewrite.

## What could not be verified here

Stated rather than left for someone to discover:

- **The embedded UI has not been loaded.** Every `/app/*` route requires a Shopify session
  token, and App Bridge loads from `cdn.shopify.com`, which this environment's network
  policy refuses. The app builds, the server starts, `/auth/login` renders, `/` redirects,
  and the webhook endpoints were exercised end to end with real signatures — but nobody
  has looked at the Dashboard.
- **OAuth has not been run.** Consequently the worker's happy path is untested against a
  real token: it was observed failing correctly with "No offline session for this shop",
  which is the honest outcome, and the sync itself is covered against Postgres with a
  mocked Shopify.
- **The Shopify Admin API has still not been called.** `*.myshopify.com` is refused at
  CONNECT, so the Admin catalogue source is covered by tests against a mocked client and has
  never run against a live Admin endpoint. Every asset ingested here came through the public
  storefront reader, and each one records which source it came from.
- **No platform capability is verified**, for the reason above. Every caption limit,
  hashtag ceiling and media spec in `packages/domain/src/content/platform-specs.ts` carries
  `verified: false` and a spec version, for the same reason.
- **The compliance ruleset cites no clause numbers.** It describes each standard in its own
  words and links nothing, because a wrong clause reference is worse than none — it looks
  authoritative. A Compliance Reviewer reads the standard text and decides; the report says
  so verbatim.
- **The platform profile is still `unverified`, on purpose.** Real packshots calibrate the
  subject half of the geometry model — how tall and narrow a product is, how much of a safe
  zone it fills, how far it is scaled. They say nothing about where Instagram draws its
  caption bar or TikTok its right rail, because no platform client could be loaded here to
  photograph one. Flipping `PLATFORM_PROFILE_VERSION` on the strength of a bottle
  measurement would let a real number vouch for a guess, so the measured half is recorded
  separately as `PRODUCT_GEOMETRY_BASELINE` and the insets keep saying what they are.
- **No threshold or score here is calibrated.** The quality dimensions measure the copy in
  front of them and predict nothing; the near-duplicate distance of 12 bits is a starting
  candidate, not a derived value. The same is true of the media thresholds: the ΔE, SSIM,
  pHash and visibility numbers were set from measurements on a synthetic bottle in this
  container, never against real packshots or a human panel, and `PLATFORM_PROFILE_VERSION`
  is literally `2026-09-26.unverified`.
- **The safe-zone insets are modelled, not observed.** No Instagram, TikTok or YouTube
  client could be loaded here to photograph its interface furniture, so the per-surface
  insets are this repo's best reading of `calibrate.mjs` and public layout guidance. The
  geometry engine is exact; its inputs are not confirmed.
- **A rendered video is not verified.** The four checks are defined over a still composite.
  A render produces a `MediaAsset` with `verification: 'NOT_APPLICABLE'` rather than a
  verdict it has not earned.
- **`@remotion/media-parser` prints a licence notice** — "Some companies are required to
  obtain a license to use @remotion/media-parser". No licence has been purchased and none
  may be without separate authorisation. Flagged here rather than buried in a lockfile.

## Not done, and deliberately

No deployment, no live account connection, no spend, no publication. Sections 39 and 43
require separate explicit authorisation for each, and none has been given.
