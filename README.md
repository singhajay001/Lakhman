# SPIRITHAUS Social Studio

An embedded Shopify Admin application: a human-controlled, AI-assisted marketing command
centre for SPIRITHAUS, a Sydney liquor retailer.

**Phase 1 of seven is built.** The foundation — embedded app, authentication, roles,
audit, product sync, webhooks, and the sixteen provider contracts with honest mocks.
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
pnpm verify            # typecheck, lint, 167 unit tests
pnpm test:integration  # 22 tests against a real Postgres and Redis
```

`pnpm test` needs neither Postgres nor Redis. The integration project needs both, which is
why they are separate projects rather than one suite that skips.

**The integration project truncates tables**, so point `DATABASE_URL` at a database you
are happy to lose. CI uses `spirithaus_test` for exactly this reason.

To see the app with data in it, without Shopify:

```sh
pnpm --filter @spirithaus/worker demo:sync
```

That fills the mirror from the fixture catalogue — five products including an archived
one, a draft, one out of stock and one with no unit cost, because a catalogue that is all
happy paths proves nothing. It is a development script that refuses to run in production,
and the mock is not reachable from the real sync, so no environment variable can make the
worker serve fixture data.

## What is built

|                          |                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| `apps/social-studio`     | The embedded app: 23 sections, OAuth, webhooks, product screens                             |
| `apps/worker`            | BullMQ workers. Scheduled work does not depend on an open browser                           |
| `packages/domain`        | Roles, permissions, audit vocabulary, Sydney time. No I/O, so its tests are fast and honest |
| `packages/providers`     | The sixteen contracts, the retry/timeout/redaction wrapper, and the mocks                   |
| `packages/shopify`       | HMAC verification, Admin GraphQL client, scope declarations, sync and reconciliation        |
| `packages/jobs`          | The `JobQueue` port, its BullMQ and in-memory adapters, idempotency keys                    |
| `packages/db`            | Prisma schema, migrations, seed, the append-only audit writer                               |
| `packages/observability` | Structured logs with declared redaction, and the cost meter                                 |
| `packages/testing`       | A mock Shopify Admin API as a `fetch` implementation, and fixtures                          |

## Four things worth knowing before reading the code

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

**Two rules are enforced by Postgres, not by a service.** The audit trail rejects UPDATE
and DELETE; webhook events are unique per `(shop, topic, event id)`. A service can be
bypassed by the next feature; a constraint cannot. Both are tested against the real
schema.

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
- **No platform capability is verified**, for the reason above.

## Not done, and deliberately

No deployment, no live account connection, no spend, no publication. Sections 39 and 43
require separate explicit authorisation for each, and none has been given.
