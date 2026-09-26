# Staging platform

A recommendation, its cost, and what it would take to run. **Nothing here has been created.** No
account exists, no resource has been provisioned, and no money has been committed.

## What has to run

Six things, and the coupling between them is what constrains the choice:

| Component | Notes |
| --- | --- |
| Web | HTTP, needs a stable public HTTPS origin — Shopify derives the OAuth redirect URI from it and it must match the Partner Dashboard byte for byte. |
| Worker | No inbound traffic. Long jobs: renders take minutes, composites seconds. Must not be scaled to zero or killed mid-job. |
| PostgreSQL 16 | Ten migrations; several invariants are enforced by triggers and constraints rather than by services. |
| Redis 7 | BullMQ. **Not optional now that compositing is queued**: without it a composite request returns a job id for work nothing will run. |
| Object storage | S3-compatible. Web and worker must see the **same** store — the local-directory fallback does not survive a restart and is not shared between two hosts. |
| Secrets | `SHOPIFY_API_SECRET`, `DATABASE_URL`, `REDIS_URL`, storage credentials. Never in the repository or an image layer. |

The web and worker share one image and one codebase, so a platform that runs two processes from
one build is a natural fit.

## Recommendation: Fly.io

Two processes from one image, managed Postgres and Redis, private networking between them, free
TLS on a `.fly.dev` hostname, secrets as first-class objects, and no egress filtering to work
around. The repository already has the Dockerfile it needs.

The things that actually decide it:

- **Two process groups, one image.** `fly.toml` runs `web` and `worker` from the same build, which
  is how the repository is already structured.
- **A stable HTTPS origin without buying a domain**, which matters because changing
  `SHOPIFY_APP_URL` means editing the Partner Dashboard again.
- **Machines can be told not to stop.** Scale-to-zero would kill a render mid-job.
- **Object storage is an add-on (Tigris), S3-compatible**, so the same credentials shape works.

### Alternatives, honestly

| Platform | Why you might | Why not |
| --- | --- | --- |
| **Render** | Simplest UI; managed Postgres and Redis; Docker native. | Free Postgres instances expire after 30 days; free web services sleep, which breaks a worker. |
| **Railway** | Fastest to stand up; usage-priced. | Usage pricing on a worker that idles is unpredictable; less control over process lifecycle. |
| **Hetzner + Docker Compose** | Cheapest by a wide margin (~€4–8/month for everything). | You own Postgres, Redis, backups, TLS and patching. Cheapest to run, most expensive in attention. |
| **AWS / GCP** | Where it would eventually live. | Disproportionate for a staging environment nobody has deployed yet. |

If the goal is to learn whether the app works against a real Shopify store, Fly is the shortest
path. If the goal is the cheapest possible long-lived staging, Hetzner wins on cost and loses on
everything else.

## Cost

See [fly-staging.md](fly-staging.md#budget-ceiling-us40-per-month) for the verified per-line
breakdown; it is the single source of truth. Summary for the Fly/Upstash/Tigris shape in `syd`,
priced from 1 October 2026 and excluding Australian GST:

| Item | US$/month |
| --- | --- |
| Web machine (`shared-cpu-1x`, 512MB) | 4.75 |
| Worker machine (`shared-cpu-1x`, 1GB — measured, see below) | 8.62 |
| Unmanaged single-node Postgres (`shared-cpu-1x`, 512MB) + 10GB volume | 6.25 |
| Upstash Redis Fixed 250MB (`ap-southeast-2`) | 10.00 |
| Object storage (Tigris, single-region `syd`, private) | ~0.20 |
| Egress (Asia-Pacific band, $0.04/GB) | ~0.40 |
| **Total** | **~US$30.23** |

**Fly Managed Postgres was ruled out:** cheapest plan US$38.00/month plus $0.28/GB storage, and
every plan includes a replica — there is no single-node development tier.

Cheaper shapes, if cost is the binding constraint:

- **Run Redis and Postgres on one small machine** rather than managed: roughly halves it, and you
  own backups.
- **Stop the staging environment between test sessions.** Staging does not need to be up
  continuously, and machines that are stopped are not billed for compute.
- **Hetzner CX22 running everything under Compose:** ~€4/month, and you are the DBA.

The worker is the item worth attention, and it has now been measured rather than estimated. One
`COMPOSITE_STILL` job across all four formats peaks at:

| Master | Megapixels | Peak RSS |
| --- | --- | --- |
| 1366×1932 (a real Shopify original) | 2.64 | 456.9MB |
| 1600×1600 (a real packshot frame) | 2.56 | 475.5MB |
| 2048×2048 | 4.19 | 512.4MB |
| 2400×3200 | 7.68 | 578.8MB |

So **512MB is an OOM kill on a real full-resolution packshot, not a tight fit**, and the earlier
guess that "1GB is likely to be tight, 2GB is safer" was wrong in both directions: 1GB holds the
worst case measured with ~42% headroom, and 2GB would breach the US$40 ceiling. Treat these as a
floor — the measurement excluded Prisma, BullMQ, ioredis and the storage client, which this
process also loads. Re-measure before trusting 1GB with masters much beyond 8 megapixels.

## Configuration

Ports: the web process listens on `PORT` (default 3000) and is the only thing that needs an
inbound route. The worker listens on nothing.

Commands:

| | |
| --- | --- |
| Build | `docker build -t spirithaus-social-studio .` |
| Web | the image's default command |
| Worker | `--workdir /app pnpm --filter @spirithaus/worker start` |
| Migrate | `--workdir /app pnpm --filter @spirithaus/db migrate` |

Migrations run as a release step, before new machines take traffic, and never concurrently with
themselves.

### Health checks

Two endpoints, deliberately separate.

`GET /livez` → `200 {"status":"alive"}`. Touches nothing. This is what a **liveness** probe uses:
a probe that touches a dependency turns a slow database into a restart loop, killing healthy
processes and making the database slower.

`GET /readyz` → `200 {"status":"ready"}` or `503 {"status":"not_ready"}`. Runs a `SELECT 1` and a
Redis `PING`, each bounded at 1.5s with a 2.5s overall budget, on the connections the application
already holds. This is what a **readiness** probe uses: a failure takes the machine out of
rotation and puts it back when the dependency returns, without restarting anything.

The readiness response never says *which* dependency failed — that would hand an anonymous caller
a map of the deployment. The detail is in the log.

Measured locally: `/livez` answers in ~5ms with both dependencies down; `/readyz` returns 503 in
1.5s (bounded by its own timeout) and recovers to 200 without a restart.

### Logs

Both processes log structured JSON to stdout with redaction declared at the logger. Whatever the
platform aggregates is the log; there is no second destination. Keep `LOG_LEVEL=info` — the
diagnostics this system relies on are logged rather than displayed. Never set `PRISMA_LOG=query`:
query logs carry parameter values.

### Backups

Postgres is the only thing that matters. The object store holds derived artefacts that can be
rebuilt from masters; masters can be re-ingested from Shopify. Redis holds in-flight jobs and
losing it costs a re-queue.

**Take a snapshot before every migration.** Prisma migrations here are forward-only and several
add constraints and triggers; there is no down path, and inventing one under pressure is how a
staging incident becomes a data incident. Confirm the provider encrypts snapshots at rest — an
unencrypted dump is the most likely way an access token leaves the system
(see [`session-security.md`](session-security.md)).

### Rollback

The image is stateless and rolls back by redeploying the previous tag. Migrations do not. If a
release includes a migration, rolling back means restoring the snapshot taken before it.

### Egress

Only what [`environment-matrix.md`](environment-matrix.md) lists: the shop's `*.myshopify.com`
host, plus the database, Redis and object storage endpoints. `cdn.shopify.com` is needed by the
asset-ingestion script, not by the running application. No social host is required by any code
path that exists today.

## Known limitations

- **Two processes, one image, one deploy.** A worker change redeploys the web process too. Fine at
  this size, worth splitting later.
- **No dedicated health endpoint** (above).
- **No autoscaling policy.** Concurrency is set by environment variables and is a starting point,
  not a measurement of any host.
- **The local media store is a trap in a two-host deployment.** If `MEDIA_STORE_DIR` is left at its
  default, the web process writes an environment image the worker cannot read, and the composite
  fails with a missing-environment error. Configure shared object storage before the first
  composite.
- **Nothing here has been deployed**, so every number above is a projection.

## What needs approval before anything is created

1. The platform.
2. The expected monthly cost.
3. A payment method — which is a paid resource and outside the current authorisation.

None of that is started.
