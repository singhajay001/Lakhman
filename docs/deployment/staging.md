# Deploying to staging

In order. Each step says what to check before moving on, and whether the step has ever actually
been performed.

Prerequisites: Node 22, pnpm 9, PostgreSQL 16, Redis 7, an S3-compatible bucket, and a Shopify
**development store** — not the live shop.

## 0. Decide, first

Deploying this is a decision, not a formality. Before starting, confirm:

- The target is a development store.
- Every `PROVIDER_*` will remain `mock`. No provider has been authorised.
- Nobody expects a post to appear anywhere. Publishing is not implemented and is not authorised.
- Somebody owns the Partner Dashboard app and can change its settings.

## 1. Build the image — *unverified*

```sh
docker build -t spirithaus-social-studio .
```

The Dockerfile builds one image for both processes, because the app and the worker share every
dependency and building them twice only creates a chance for them to drift.

**This has not been run.** There is no Docker daemon in the environment this was developed in.
The manifest-collection stage was corrected after the per-package list was found to be missing
five of the fourteen workspaces — which would have failed `pnpm install --frozen-lockfile`
outright — but the build itself is unproven. Expect to iterate on the first attempt, and treat a
failure here as a defect in the Dockerfile rather than in your environment.

Development dependencies are intentionally kept in the runtime image: the worker runs its
TypeScript through `tsx`, which is one of them.

## 2. Configure — *partly verified*

Copy `.env.example` and fill it in against [`configuration.md`](configuration.md). Then, before
deploying anything:

```sh
# Does this host's network actually allow what the app needs?
curl -sS -o /dev/null -w '%{http_code}\n' https://<your-store>.myshopify.com/admin
curl -sS -o /dev/null -w '%{http_code}\n' https://cdn.shopify.com/
```

A `403` carrying `x-deny-reason` is an egress policy refusing you, not Shopify. If the host is
behind a proxy, set `NODE_USE_ENV_PROXY=1` — without it Node's `fetch` ignores `https_proxy` and
the resulting failure is indistinguishable from a rejected token until you read the header.

## 3. Migrate — *verified locally*

```sh
docker run --rm --env-file .env spirithaus-social-studio \
  pnpm --filter @spirithaus/db migrate
```

Ten migrations. Several invariants in this system are enforced by Postgres rather than by a
service — the audit trail rejects `UPDATE` and `DELETE`, approvals are invalidated by trigger on
a material edit, one person cannot hold both keys of a dual-control action — so a partial
migration leaves the application's guarantees partly absent. Check it completed:

```sh
docker run --rm --env-file .env spirithaus-social-studio \
  pnpm --filter @spirithaus/db exec prisma migrate status
```

Do **not** run `pnpm db:seed` against staging. It creates a development shop and a first
administrator, which is not what you want on a host anybody else can reach.

## 4. Start the web process — *verified locally*

```sh
docker run -d --env-file .env -p 3000:3000 --name studio-web \
  spirithaus-social-studio
```

Check it booted by asking it something:

```sh
curl -sS -w '\n[%{http_code}]\n' https://<staging-host>/auth/shopify/callback
```

Expect **400** and a JSON body with `"error": "missing_parameters"`. That proves the server is
up, the route table is wired and the handler ran. This is exactly what `pnpm smoke` does in CI,
and it exists because a build that cannot boot still builds — `tesseract.js` was bundled into the
ESM server output for three phases, where its CommonJS `__dirname` is undefined, and the server
threw on startup while every build passed.

With `NODE_ENV=production` the response carries the summary and the error code only. The remedy
is withheld, because an endpoint that tells an anonymous caller which environment variables are
unset is reconnaissance. The full reason is in the log.

## 5. Start the worker — *unverified against a real queue*

```sh
docker run -d --env-file .env --name studio-worker \
  spirithaus-social-studio pnpm --filter @spirithaus/worker start
```

The worker refuses to start without `REDIS_URL`. It runs two queues: general work, and renders at
concurrency 1 with a ten-minute lock. Renders need a Chromium headless shell — see
`REMOTION_BROWSER_EXECUTABLE` in [`configuration.md`](configuration.md).

## 6. Install the app — *never performed*

Open `https://<staging-host>/auth/shopify/login`, enter the development store domain, and
complete OAuth.

**This is the first time OAuth will ever have run.** Everything downstream of it — the offline
session, the Admin client, the product sync, the embedded UI — has never executed against a real
token. Expect findings. The most likely ones, in order:

1. The redirect URI in the Partner Dashboard does not match `<SHOPIFY_APP_URL>/auth/shopify/callback` exactly.
2. `SHOPIFY_API_SECRET` belongs to a different app than the one the install started from.
3. The host cannot reach `*.myshopify.com`, so the exchange cannot complete at all.

The callback names each of these specifically when `NODE_ENV` is not `production`. If you are
debugging an install, that is a good reason to run staging at `NODE_ENV=development` briefly —
and a good reason not to leave it there.

## 7. Confirm it is actually connected — *never performed*

The point of this step is that a degraded system here looks healthy. Check the substance:

```sh
# Trigger a sync from the Products screen, then look at what it recorded.
```

- A `SyncRun` with status `SUCCEEDED` and non-zero counts means the Admin API answered. This will
  be the first time that has ever happened.
- Status `UNREACHABLE` means the sync never reached Shopify — no offline session, or the host is
  refused. It is deliberately not `FAILED`: nothing was attempted and retrying changes nothing.
  The row carries the diagnostic.
- Status `FAILED` means Shopify answered and said no. That one is a real fault.

Then open the embedded app in Shopify Admin. **Nobody has ever seen these screens.** App Bridge
loads from `cdn.shopify.com`, which the development environment refused, so every `/app/*` route
has been exercised only by its loader and its tests. Budget time for this.

## 8. What will not work, and should not

- **Nothing publishes.** Every publisher is a mock reporting `published: false`. If a post
  appears anywhere, something is wrong and should be stopped.
- **Media generation has no provider.** Compositing works from an uploaded or ingested master;
  generating an environment needs an image provider, and refuses rather than inventing a
  background.
- **Platform figures are unverified.** Caption limits and safe-zone insets are first-party
  estimates carrying `verified: false`.
- **Analytics are empty.** No platform account is connected and none may be without separate
  authorisation.

## Rollback

The image is stateless; migrations are not.

```sh
docker stop studio-web studio-worker
docker run -d --env-file .env -p 3000:3000 --name studio-web <previous-image>
```

Prisma migrations here are forward-only and several add constraints and triggers. There is no
down-migration path, and none should be invented under pressure: restore the database from a
snapshot taken before step 3. **Take that snapshot before step 3.**

## Going live afterwards

The steps above put staging up. Taking it to the live shop is a separate decision, and a plan for
it needs four corrections that are easy to make from the outside.

**The app is React Router 7 with Shopify Polaris, not Next.js with Radix.** Anyone reviewing the
embedded dashboard should expect Polaris components inside Shopify Admin's own frame, and there
is no custom dark theme to assess. `@shopify/shopify-app-react-router@3` handles session tokens;
token exchange is its default strategy for App Store distribution, so there is no full-page
redirect loop to watch for.

**There is no `SHOPIFY_ADMIN_ACCESS_TOKEN`.** Nothing reads such a variable. Offline tokens are
issued by OAuth and stored in the `Session` table by `PrismaSessionStorage`; pasting a token into
`.env` would have no effect, and would put a live credential in a file for no benefit. The path
to a working Admin client is completing the install, nothing else.

**There is no mock-to-live switch.** `ShopifyGateway` resolves a live session whenever one exists
and falls back to a flagged mock container when one does not. Completing OAuth is the whole
change; no code or configuration moves.

**The asset sync lives on the app, not the worker**, and it does not populate products:

```sh
# Ingests packshots into the protected-asset pipeline.
ASSET_LICENCE_HOLDER="Spirithaus Pty Ltd" \
ASSET_LICENCE_TERMS="Marketing and promotional use only" \
pnpm sync:shopify-assets
```

It writes `ProtectedProductAsset` rows and creates **no** `SyncRun`. Product mirroring is a
separate job, triggered from the Products screen, and that is what writes `SyncRun` and
`ShopifyProduct`. The success status is `SUCCEEDED`, not `COMPLETED`.

### Egress for publishing

`graph.facebook.com`, `graph.instagram.com` and `open-api.tiktok.com` are worth putting on an
infrastructure team's list, but **nothing in this build calls them**. Every publisher is a mock
returning `published: false`, no platform account may be connected without separate
authorisation, and opening those hosts before there is anything to send buys nothing. The two
that are needed today are `*.myshopify.com` and `cdn.shopify.com`.

## Afterwards

Whatever the first install finds, write it down — in `docs/adr/` if it changes a decision, in
this file if it changes these steps. Half the value of a first deployment is the list of things
that were not true.
