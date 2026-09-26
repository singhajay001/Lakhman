# Environment variables

Built by enumerating every `process.env` reference in `apps/`, `packages/` and `scripts/`, not by
reading `.env.example`. Where the two disagreed, the code won — and they did disagree.

**Secrets never go in the repository.** Nothing in this table is a real value; the examples are
shaped like the real thing and are not usable.

## Consumed by the application

| Variable | Component | Required | Secret | Purpose and failure behaviour | Example | Source | Rotation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `SHOPIFY_API_KEY` | web | yes | no | App client id. **Refused at startup** — `required()` throws rather than failing halfway through an OAuth callback. | `a1b2c3d4e5f6...` | Partner Dashboard → Client credentials | On compromise |
| `SHOPIFY_API_SECRET` | web | yes | **yes** | Verifies webhook and callback HMACs. Startup fails without it; a wrong value fails every callback with `signature_mismatch`. | `shpss_…` | Partner Dashboard → Client credentials | On compromise; rotating invalidates in-flight installs |
| `SHOPIFY_APP_URL` | web | yes | no | Public origin. Shopify derives the redirect URI from it; a mismatch fails the install at the last step. No trailing slash. | `https://studio-staging.example` | You | Never |
| `DATABASE_URL` | web, worker, scripts | yes | **yes** | Read at module load by the Prisma client, which **throws on import** if unset — a script or worker dies before any handler runs. | `postgresql://user:pass@host:5432/db?schema=public&sslmode=require` | Database provider | Quarterly |
| `REDIS_URL` | web, worker | effectively | **yes** | The web app falls back to an in-memory queue **and warns**; the worker logs `REDIS_URL is not set. The worker cannot run.` and **exits 1**. Since compositing became queued work, an unset value means a request returns a job id for work nothing will ever run. | `rediss://default:pass@host:6379` | Queue provider | Quarterly |
| `SHOPIFY_API_VERSION` | web, worker | no (`2025-07`) | no | Pinned deliberately; an unpinned client changes behaviour without a deploy. | `2025-07` | Shopify release notes | Per Shopify's schedule |
| `NODE_ENV` | all | no (`development`) | no | `production` withholds developer diagnostics from the OAuth callback and disables the Prisma client global cache. | `production` | You | Never |
| `LOG_LEVEL` | all | no (`info`) | no | Pino level. The diagnostics this system relies on are logged, not displayed — do not set `silent` outside tests. | `info` | You | Never |
| `PORT` | web | no (`3000`) | no | Listen port. | `3000` | Platform | Never |
| `QUEUE_PREFIX` | web, worker | no (`spirithaus`) | no | BullMQ key prefix. **Must match between web and worker**, or the worker watches a queue nothing writes to. | `spirithaus` | You | Never |
| `SYNC_CONCURRENCY` | worker | no (`2`) | no | Sync jobs per worker. | `2` | You | Never |
| `COMPOSITE_CONCURRENCY` | worker | no (`2`) | no | Composites per worker. CPU-bound; sharp already uses several threads per operation. A starting point, not a measurement. | `2` | You | Never |
| `RENDER_CONCURRENCY` | worker | no (`1`) | no | Video renders per worker. Each drives a headless browser through every frame. Scale by adding workers. | `1` | You | Never |
| `MEDIA_STORE_DIR` | web, worker | no (`/tmp/spirithaus-media`) | no | Local store, **development and test only**. Read only when no bucket is configured, and a deployed process refuses to start in that state rather than using it — a local directory on separate hosts is not shared storage (ADR 0015). | `/var/lib/spirithaus/media` | You | Never |
| `AWS_ENDPOINT_URL_S3` | web, worker | **yes when deployed** | no | S3 endpoint, and one of the two variables that **select** object storage. Setting it makes the credentials and bucket mandatory. Not a secret, and worth having in a log: "which store did this machine write to" is the first question of a storage incident. | `https://fly.storage.tigris.dev` | `fly storage create` | Never |
| `BUCKET_NAME` | web, worker | **yes when deployed** | no | The bucket. The other selector. **Must be the same for web and worker** — they are separate machines and the bucket is the only thing they share. Must stay **private**; nothing writes a public-read ACL. | `spirithaus-staging-media` | `fly storage create` | Never |
| `AWS_ACCESS_KEY_ID` | web, worker | **yes when deployed** | **yes** | Object storage credential. Required once a bucket is selected, but **never selects one on its own** — it is ambient on many machines, and treating it as intent makes unrelated environments refuse to start. | `tid_…` | `fly storage create` | On compromise |
| `AWS_SECRET_ACCESS_KEY` | web, worker | **yes when deployed** | **yes** | As above. Never logged, and kept out of thrown errors: `StorageError` carries an error name, an HTTP status and the key, never the signed request. | `tsec_…` | `fly storage create` | On compromise |
| `AWS_REGION` | web, worker | no (`auto`) | no | Tigris routes for you, so `auto` is correct. Deliberately **not** a selector: it is set incidentally by unrelated tooling. | `auto` | — | Never |
| `REMOTION_BROWSER_EXECUTABLE` | worker | no | no | Chromium headless shell. Unset means Remotion downloads its own on first render, needing egress to its CDN. Must be the **headless shell**, not full Chrome. | `/opt/chromium/headless_shell` | Image | Never |
| `PROVIDER_*` (16) | web, worker | no (`mock`) | no | One per contract. `mock` is a supported configuration: a mocked publisher returns `published: false`. A named adapter this build does not implement is refused rather than silently mocked. | `mock` | You | Never |
| `SESSION_ENCRYPTION_KEYS` | web, worker | **yes when deployed** | **yes** | `id:key,id:key`. Every key can decrypt; only the current one encrypts. Each must decode to exactly 32 bytes. **Both processes refuse to start without a valid ring** when `NODE_ENV` is not `development` or `test`. | `k1:<base64 32 bytes>` | `openssl rand -base64 32` | Two-deploy rotation; see `fly-staging.md` |
| `SESSION_ENCRYPTION_CURRENT_KEY_ID` | web, worker | **yes when deployed** | no | Which listed key encrypts new writes. Must be one of the ids above. | `k1` | You | Changed to promote a new key |
| `SESSION_ENCRYPTION_ALLOW_PLAINTEXT_READS` | web, worker | no | no | Reads tokens written before encryption existed. **Refused outright** when deployed — the process will not start. Development only; run `pnpm db:encrypt-sessions` instead. | unset | — | Removed once the migration has run |
| `PRISMA_LOG` | all | no | no | `query` enables SQL logging. Do not enable in staging: queries carry parameter values. | unset | You | Never |

### Object storage is all-or-nothing

The five storage variables are resolved once at startup, by the same resolver in both processes, and
there are exactly three outcomes (ADR 0015):

| State | Result |
| --- | --- |
| A bucket selected and fully configured | S3 is used |
| Nothing selected, `NODE_ENV` is `development` or `test` | local directory, with a warning |
| Anything else | **the process does not start** |

"Anything else" covers two cases worth naming. A deployed process with no bucket refuses, because
falling back to a local directory would make the web machine's writes invisible to the worker and
every composite would fail blaming the artwork. And a *partially* configured bucket refuses in every
environment, including development — a named bucket with a missing credential is a typo, and a
silent fallback would hide it until exactly the same failure.

Web and worker must resolve to the same endpoint and bucket. Nothing enforces that across machines,
so set them at the app level (`fly secrets set` applies to both process groups) rather than per
group.

## Consumed by scripts only

None of these are read by the running application.

| Variable | Script | Required | Notes |
| --- | --- | --- | --- |
| `ASSET_LICENCE_HOLDER` | `sync:shopify-assets` | yes | **No default, deliberately.** A supplier's packshot in a retailer's catalogue is not automatically licensed for marketing use; the rights basis is asserted by whoever runs the ingestion. |
| `ASSET_LICENCE_TERMS` | `sync:shopify-assets` | yes | As above. |
| `ASSET_LICENCE_KIND` | `sync:shopify-assets` | no (`LICENSED`) | `OWNED`, `COMMISSIONED` or `LICENSED`. |
| `ASSET_LICENCE_USES` | `sync:shopify-assets` | no (`social`) | Comma-separated. |
| `ASSET_LICENCE_EVIDENCE_URL` | `sync:shopify-assets` | no | Where the rights basis is recorded. |
| `SOURCE` | `sync:shopify-assets` | no (`admin`) | `admin` or `storefront`. |
| `STOREFRONT_ORIGIN` | `sync:shopify-assets` | with `SOURCE=storefront` | Not guessed from the shop domain. |
| `PRODUCT_TYPES`, `LIMIT` | `sync:shopify-assets` | no | Narrow what is read. |
| `DEMO_ASSETS` | `demo:media` | no (`3`) | Development only. |
| `SEED_SHOP_DOMAIN` | `db:seed`, demo scripts | no | **Development only. Do not set in staging** — the seed creates a shop and a first administrator. |
| `SMOKE_PORT` | `pnpm smoke` | no (`3919`) | CI only. |
| `TESSERACT_LANG_PATH`, `TESSERACT_CACHE_PATH` | OCR | no | Resolved from `node_modules` by default. |
| `THEME_PROFILE_PATH`, `RENDER_OUTPUT_DIR` | tooling | no | Development. |

## Container and platform

| Variable | Notes |
| --- | --- |
| `NODE_USE_ENV_PROXY` | **Set to `1` whenever `https_proxy` is set.** Node reads it once at startup to install its proxy-aware dispatcher; nothing in the application can switch it on afterwards. Without it `fetch` bypasses the proxy and an egress denial arrives as a `403` that reads exactly like a rejected Shopify token. |
| `https_proxy` / `HTTPS_PROXY` | Credentials in the URL are redacted before anything is logged. |

## Removed from `.env.example`

- **`SCOPES`** — listed, never read. Scopes come from `mandatoryScopeList()` in
  `packages/shopify/src/scopes.ts`. Setting it had no effect and implied it did.
- **`ANTHROPIC_API_KEY`, `FAL_KEY`, `ELEVENLABS_API_KEY`, `S3_*`** — commented placeholders for
  providers that are not implemented. They read as a checklist for a live deployment, which they
  are not. They return when an adapter reads them.

## Losing every encryption key means every shop reinstalls

There is no recovery path. Store `SESSION_ENCRYPTION_KEYS` somewhere durable before deploying —
Fly stores secrets encrypted and will not show them to you again.

## There is no Admin access token variable

Deliberately. Offline tokens are issued by OAuth and stored in the `Session` table by
`PrismaSessionStorage`. Nothing reads a token from the environment, and putting a live credential
in a file would achieve nothing except exposure.

## Minimum egress, as the code stands today

| Host | Needed by | Why |
| --- | --- | --- |
| `<shop>.myshopify.com` | web, worker | Admin GraphQL and the OAuth token exchange. The only Shopify hosts the app calls. |
| `cdn.shopify.com` | app script | Downloading packshots during asset ingestion. Not needed by the running application. |
| PostgreSQL host | web, worker | |
| Redis host | web, worker | |
| Object storage endpoint | web, worker | Once configured; the local fallback needs no egress and does not survive the host. |
| Remotion CDN | worker | First render only, and only when `REMOTION_BROWSER_EXECUTABLE` is unset. |

**Not required:** `graph.facebook.com`, `graph.instagram.com`, `open-api.tiktok.com` and every
other social host. No code path calls them, every publisher is a non-publishing mock, and no
account connection is authorised. Opening them now widens the egress surface for nothing.

`accounts.shopify.com` and `admin.shopify.com` are where a person's browser goes, not the server.
They belong on a workstation's allowlist, not the application host's.
