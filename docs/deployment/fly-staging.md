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

| Item | Size | Indicative |
| --- | --- | --- |
| Web machine | `shared-cpu-1x`, 1GB, suspends when idle | ~US$3–6 |
| Worker machine | `shared-cpu-1x`, 2GB, always on | ~US$11–15 |
| Fly Postgres (development, single node) | 1GB volume | ~US$5–8 |
| Upstash Redis | pay-as-you-go, low volume | ~US$0–5 |
| Tigris object storage | a few GB | ~US$1–3 |
| **Projected total** | | **~US$20–37** |

Under the ceiling with room, but the figures are indicative: this environment cannot reach
pricing pages, so confirm each at sign-up. Watch the worker — it is the always-on item and the
one that would grow if concurrency is raised.

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
  --initial-cluster-size 1 --vm-size shared-cpu-1x --volume-size 1
fly postgres attach spirithaus-staging-db --config fly.staging.toml
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
