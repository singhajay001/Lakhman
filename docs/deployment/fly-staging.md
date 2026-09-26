# Fly.io staging runbook

Everything needed to stand this up, in order. **Nothing here has been run.** No Fly organisation,
app, database or bucket exists, and no payment method has been provided.

`fly.staging.toml` is the configuration. It is deliberately not called `fly.toml`, so a bare
`fly deploy` in this directory does nothing.

> **The Postgres this describes is not approved for production.** Single-node development-grade
> Fly Postgres: one machine, no replica, no automatic failover. Right for a staging environment
> holding a development store's data; wrong for a real shop.

## Budget ceiling: US$40 per month

If the projection below exceeds it, stop and re-scope rather than proceeding.

This is the canonical cost table. The other deployment documents point here rather than keeping
their own copy, because four copies drifted once already.

Rates retrieved 2026-09-26 from each vendor's own documentation source and **priced from
1 October 2026**, when Fly raises RAM 20% and shared CPU 12.9%. Sydney carries a **1.269230769
markup** over Ashburn — every third-party figure you will read online is the Ashburn rate.
730-hour month, USD, excluding Australian GST.

**Guaranteed fixed charges**

| Item | Size | US$/month | Confidence |
| --- | --- | --- | --- |
| Web machine | `shared-cpu-1x`, 512MB, `min_machines_running = 1` | 4.75 | High |
| Worker machine | `shared-cpu-1x`, 1GB, always on | 8.62 | High |
| Postgres machine | `shared-cpu-1x`, 512MB, single node, unmanaged | 4.75 | High |
| Postgres volume | 10GB provisioned | 1.50 | High |
| Upstash Redis | Fixed 250MB, primary `ap-southeast-2`, 0 read regions | 10.00 | High |
| **Fixed subtotal** | | **29.63** | |

**Usage-dependent**, normal staging: Fly egress ~$0.40 (10GB @ $0.04/GB, Asia-Pacific band),
Tigris ~$0.20. Shared IPv4, Anycast IPv6, the first TLS certificate, the first 10GB of volume
snapshots and Community support are all **free**. Tigris charges **no egress**.

**Expected ~US$30.23/month. Maximum plausible ~US$31.79.** Headroom against the ceiling:
~US$8–10 ex-GST. If 10% Australian GST applies the worst case is ~US$34.97, still under.

Two sizes here are load-bearing and must not be raised casually:

- **Worker at 1GB is measured, not guessed.** One `COMPOSITE_STILL` job across four formats peaks
  at 456.9MB on a 1366×1932 master, 512.4MB at 2048×2048 and 578.8MB at 2400×3200 — so 512MB is
  an OOM kill on a real packshot, not a tight fit. Raising it to 2GB costs $7.72/month and
  **breaches the ceiling** ($41.81 total).
- **Fly Managed Postgres is not usable here.** Its cheapest plan is $38.00/month plus $0.28/GB
  storage, and all plans include a replica — there is no single-node development tier. Hence
  unmanaged Postgres (a plain Machine plus a volume).

To reduce: stop the environment between test sessions (`fly scale count web=0 worker=0`). Stopped
machines are not billed for compute, but note Fly still bills **$0.15/GB of root filesystem per
30 days**, and volumes bill on provisioned capacity whether attached or not.

To reduce: stop the environment between test sessions (`fly scale count web=0 worker=0`).
Suspended machines are not billed for compute.

## 1. Create the app and set secrets

```sh
fly launch --no-deploy --copy-config --config fly.staging.toml --region syd
```

Then the secrets. **None of these belong in the repository or in `fly.staging.toml`.**

```sh
# Shopify, from the Partner Dashboard.
fly secrets set --config fly.staging.toml \
  SHOPIFY_API_KEY=... \
  SHOPIFY_API_SECRET=... \
  SHOPIFY_APP_URL=https://spirithaus-social-studio-staging.fly.dev

# Session encryption. Generate the key locally; it is never echoed back by the app.
fly secrets set --config fly.staging.toml \
  SESSION_ENCRYPTION_KEYS="k1:$(openssl rand -base64 32)" \
  SESSION_ENCRYPTION_CURRENT_KEY_ID=k1
```

**Keep a copy of that key somewhere durable before deploying.** If it is lost, every stored
Shopify token becomes unreadable and every shop must reinstall. Fly stores secrets encrypted and
will not show them to you again.

The app **refuses to start** without a valid key ring, in both processes. That is deliberate: a
key discovered to be missing on the first OAuth callback is a token already written in plaintext.

## 2. Provision the dependencies

```sh
fly postgres create --name spirithaus-staging-db --region syd \
  --initial-cluster-size 1 --vm-size shared-cpu-1x --volume-size 10
fly postgres attach spirithaus-staging-db --config fly.staging.toml
```

`--initial-cluster-size 1` is what makes this single-node, and `--volume-size 10` matches the
costed 10GB. **A volume can be grown but never shrunk**, so oversizing it here is a permanent
charge at $0.15/GB/month.

Confirm the memory landed at 512MB — `fly postgres create` picks a default for the VM size, and
the costing assumes 512MB:

```sh
fly machine list --app spirithaus-staging-db
# if it is not 512MB:
fly machine update <machine-id> --vm-memory 512 --app spirithaus-staging-db
```

`attach` sets `DATABASE_URL` as a secret and uses Fly's private network, so the database is not
publicly reachable.

Redis (Upstash, via Fly) and object storage (Tigris):

```sh
fly redis create --name spirithaus-staging-redis --region syd
fly secrets set --config fly.staging.toml REDIS_URL='<the rediss:// url it prints>'

fly storage create --name spirithaus-staging-media
```

`fly storage create` sets the bucket credentials as secrets automatically.

**Both processes must see the same object storage.** If `MEDIA_STORE_DIR` is left at its default,
the web process writes an environment image to a local directory the worker cannot read, and
every composite fails with a missing-environment error. This is the most likely first-day
mistake.

## 3. Deploy

```sh
fly deploy --config fly.staging.toml
```

The release command runs migrations before any new machine takes traffic. **Snapshot first** —
migrations here are forward-only and several add constraints and triggers.

```sh
fly postgres db list --app spirithaus-staging-db     # confirm it is there
# then take a snapshot through the Fly dashboard or `fly volumes snapshots create`
```

## 4. Confirm it is up

```sh
curl -sS https://spirithaus-social-studio-staging.fly.dev/livez    # {"status":"alive"}
curl -sS https://spirithaus-social-studio-staging.fly.dev/readyz   # {"status":"ready"}
fly status --config fly.staging.toml
fly logs --config fly.staging.toml
```

`/readyz` answering `{"status":"not_ready"}` with 503 means Postgres or Redis did not respond
within 1.5s. **The response never says which** — that would hand an anonymous caller a map of the
deployment. The log does:

```sh
fly logs --config fly.staging.toml | grep readyz
```

## 5. Rollback

The image rolls back; migrations do not.

```sh
fly releases --config fly.staging.toml
fly deploy --config fly.staging.toml --image <previous image ref>
```

If the release included a migration, rolling back the image is not enough — restore the snapshot
taken before step 3. There is no down-migration path and inventing one under pressure is how a
staging incident becomes a data incident.

## 6. Destroying it

Staging is disposable, and leaving it running is the main way this costs more than it should.

```sh
# Stop spending without losing anything:
fly scale count web=0 worker=0 --config fly.staging.toml

# Or remove it entirely. Each is irreversible and destroys its data.
fly apps destroy spirithaus-social-studio-staging
fly postgres detach spirithaus-staging-db --config fly.staging.toml
fly apps destroy spirithaus-staging-db
fly redis destroy spirithaus-staging-redis
fly storage destroy spirithaus-staging-media
```

Destroying the app does **not** destroy the Postgres app, the Redis instance or the bucket — each
is separate and each bills separately. Check `fly apps list` and the dashboard afterwards.

## 7. Key rotation

Two deploys, never one, so there is no window where the app cannot read its own sessions.

```sh
# 1. Add the new key. k1 stays; existing sessions keep opening.
fly secrets set --config fly.staging.toml \
  SESSION_ENCRYPTION_KEYS="k2:$(openssl rand -base64 32),k1:<the existing k1 value>"

# 2. Promote it. New writes use k2; sessions encrypted under k1 are re-encrypted as they are read.
fly secrets set --config fly.staging.toml SESSION_ENCRYPTION_CURRENT_KEY_ID=k2

# 3. Later — only once nothing is still encrypted under k1 — remove it.
fly secrets set --config fly.staging.toml SESSION_ENCRYPTION_KEYS="k2:<k2 value>"
```

Step 3 is the dangerous one. A session still encrypted under a removed key cannot be opened, and
that shop must reinstall. Re-encryption happens when a session is *read*, so a shop nobody has
touched since the rotation is still on the old key.

## Known limitations

- **One deploy for both processes.** A worker change redeploys the web process.
- **Development-grade Postgres.** Single node, no failover. Staging only.
- **Renders need a browser.** Remotion downloads its own headless shell on first use, which needs
  egress to its CDN. Set `REMOTION_BROWSER_EXECUTABLE` to a baked-in shell if that is not allowed.
- **Nothing here has been executed.** Every command is derived from the configuration in this
  repository and from Fly's documented interface, not from a run.
