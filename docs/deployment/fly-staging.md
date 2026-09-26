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
fly apps create spirithaus-social-studio-staging -o <org>
```

`fly apps create` rather than `fly launch`: launch prompts to provision Postgres and Redis
extensions and rewrites your config file, and both are handled deliberately further down. An app
with no Machines, no volumes and no IPs costs nothing, so this step is free.

Then the secrets. **None of these belong in the repository or in `fly.staging.toml`.**

Use `fly secrets import`, not `fly secrets set`. Import reads `NAME=VALUE` pairs from **stdin**, so
the value never appears in a process argument — where any other user on the machine can read it
from the process list, and where your shell writes it to history. `--stage` installs the secret
without triggering a deployment.

```sh
# Session encryption. Generate with a CSPRNG straight into the pipe; never echoed.
printf 'SESSION_ENCRYPTION_KEYS=k1:%s\nSESSION_ENCRYPTION_CURRENT_KEY_ID=k1\n' \
  "$(openssl rand -base64 32)" \
  | fly secrets import --stage -a spirithaus-social-studio-staging

# Shopify, from the Partner Dashboard.
printf 'SHOPIFY_API_KEY=%s\nSHOPIFY_API_SECRET=%s\nSHOPIFY_APP_URL=%s\n' \
  "$KEY" "$SECRET" "https://spirithaus-social-studio-staging.fly.dev" \
  | fly secrets import --stage -a spirithaus-social-studio-staging
```

`fly secrets list` shows names, digests and staged/deployed status — never values. That is the
only verification available, and it is enough: a digest change proves a rotation happened.

**Keep a copy of that key somewhere durable before deploying.** If it is lost, every stored
Shopify token becomes unreadable and every shop must reinstall. Fly stores secrets encrypted and
will not show them to you again.

There is a genuine tension between that and the pipe above, which deliberately never shows you the
key. Resolve it on purpose rather than by accident: either generate into a password manager first
and pipe from there, or accept that the key is unrecoverable and that losing it means rotating. On
**staging with no shops installed**, rotation is cheap — there are no tokens worth keeping, so
generating a fresh key and redeploying costs nothing. On production it is not, and the copy must
exist before the first install.

The app **refuses to start** without a valid key ring, in both processes. That is deliberate: a
key discovered to be missing on the first OAuth callback is a token already written in plaintext.

## 2. Provision the dependencies

```sh
fly postgres create --name spirithaus-staging-db --org <org> --region syd \
  --initial-cluster-size 1 --vm-size shared-cpu-1x --vm-memory 512 --volume-size 10

fly postgres attach spirithaus-staging-db -a spirithaus-social-studio-staging
```

`--vm-memory 512` and `--volume-size 10` both work on flyctl v0.4.108, so the sizes are set at
creation rather than corrected afterwards.

**Do not pass `--enable-backups`.** Its help reads *"Create a new tigris bucket and enable
WAL-based backups"* — a second billable bucket outside the approved configuration. The consequence
is real and should be stated plainly: staging has **volume snapshots but no WAL backups**, which is
part of what "development-grade, not approved for production" means.

#### `fly postgres attach` needs an egress most sandboxes do not have

Verified live: attach opens a WebSocket tunnel into Fly's private network and fails without it:

```
Error: can't build tunnel for <org>: websocket: failed to WebSocket dial:
Get "https://iad1.gateway.6pn.dev:443/": Forbidden
```

It is HTTPS rather than UDP WireGuard, so an allowlisted egress *can* carry it — the host is
`<region>.gateway.6pn.dev`, and the region prefix varies by which gateway flyctl picks, so a single
pinned hostname may not be enough. `fly ssh console` and `fly proxy` need the same tunnel.

Attach is not optional and has no safe substitute: it creates a scoped database and role inside the
cluster and *then* sets `DATABASE_URL`. Pointing the app at the `postgres` superuser instead would
skip the privilege separation the step exists to create. **If the tunnel is unavailable, run that
one command from a machine that has the egress** — it is idempotent and touches nothing else.

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

### Redis (Upstash, through Fly)

This is the command that actually works non-interactively. Every flag on it is load-bearing:

```sh
fly redis create \
  --name spirithaus-staging-redis --org <org> --region syd \
  --plan "Fixed 250MB" \
  --no-replicas \
  --disable-eviction \
  --enable-auto-upgrade=false \
  --enable-prodpack=false

fly redis status spirithaus-staging-redis   # confirm before deploying anything
```

**Omitting `--enable-auto-upgrade` and `--enable-prodpack` is not the same as declining them.**
The CLI *prompts* for both regardless, so a scripted run without a TTY dies at the prompt — which
is the safe failure, but it means you must pass the explicit `=false` form. Both defaults cost
money if accepted: Auto Upgrade silently moves you to the next plan up when you hit a limit, and
ProdPack is **$200/month**, five times the entire staging budget.

`--plan "Fixed 250MB"` is the exact identifier from `fly redis plans`. Set it at creation:
`fly redis update` on flyctl v0.4.108 has **no `--plan` flag**, whatever the Fly docs say about
switching plans later. Getting this wrong leaves a pay-as-you-go database, and Upstash's own
BullMQ page warns why that matters: *"BullMQ accesses Redis regularly, even when there is no
queue activity. This can incur extra costs because Upstash charges per request on the
Pay-As-You-Go plan."* An idle worker alone exceeds the free tier's 500,000 commands a month.

Ignore the line `fly redis create` prints about `$0.20 per 100K commands` — it is boilerplate
shown to everyone, not a statement of your plan. `fly redis status` is the truth.

**The primary region cannot be changed later**, so `--region syd` matters permanently.
`--no-replicas` keeps read regions at zero; each one costs 50% of the base tier and replicated
writes are billed as commands.

`--disable-eviction` is deliberate. At the 256MB limit the database refuses writes instead of
evicting keys — for a job queue that means an enqueue fails loudly rather than a queued render
quietly disappearing.

#### Fly returns `redis://`; harden it to `rediss://`

Verified live: `fly redis create` prints a **`redis://`** URL on a **public `*.upstash.io`
hostname**, port 6379. That is plaintext on a public host, and ioredis derives TLS from the
scheme — so passing it through unchanged means credentials and queue payloads cross the internet
unencrypted, with no error to tell you.

Change **only** the scheme to `rediss://`, leaving every other byte untouched, and install it
through stdin so the value never reaches a process argument or your shell history:

```sh
printf 'REDIS_URL=%s\n' "$REDISS_URL" | fly secrets import --stage -a <app>
```

`--stage` sets the secret without triggering a deployment. Because the app only ever receives
`rediss://`, a TLS problem surfaces as a failed connection — it cannot silently downgrade.

### Object storage (Tigris, through Fly)

```sh
fly storage create -n spirithaus-staging-media
```

This sets `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3` and `BUCKET_NAME` as
app secrets, which both process groups inherit. That is what makes web and worker share a store;
they are separate machines and the bucket is the only thing they have in common.

**The app refuses to start without all four** (ADR 0015), in both processes, and refuses a
partially configured set in every environment including development. That is the guard against the
defect this replaced: a local directory looks like it works, because the write succeeds and only
the read from the other machine fails.

The bucket must stay **private**. Nothing in the pipeline writes a public-read ACL, and a protected
product master is not public artwork.

#### Placement is not proven until you prove it

`fly storage create` has **no region flag**, so it does not by itself produce a single-region Sydney
bucket — left alone, Tigris's default is **Global**. Do not infer Sydney placement from the endpoint
answering quickly from Sydney.

**Create the bucket with the Tigris CLI instead**, which does expose the control. `syd` is an
accepted value — verified from `tigris buckets create --help` on CLI v3.13.0:

```sh
npm install -g @tigrisdata/cli          # or the unscoped alias: npm install -g tigris
tigris login oauth                      # browser; choose Fly.io, then the Fly organisation
tigris buckets create spirithaus-staging-media --locations syd --access private
tigris buckets get spirithaus-staging-media --format json   # the only acceptable evidence
```

Location semantics: omit or `auto` = Global; one region code = single-region; two comma-separated =
dual-region; `usa`/`eur` = multi-region. `--access` already defaults to `private`; pass it anyway so
the intent is in the command. Never pass `--public`, `--allow-object-acl`,
`--enable-directory-listing` or `--enable-snapshots`.

Logging in with Fly SSO is what ties ownership to the Fly organisation. Tigris's docs: *"If you use
Fly to log in to Tigris, Tigris will use the Fly Organization to manage access… Users who log in
with Fly must use Fly Organizations."*

Two environment traps, both verified live:

- **Behind an HTTPS proxy, the Tigris CLI needs `NODE_USE_ENV_PROXY=1`.** It uses Node's built-in
  `fetch`, which ignores `HTTPS_PROXY` on Node ≥ 22.21, so every request bypasses the proxy and the
  login fails as a bare `✖ Authentication failed` with no hint. Set `NODE_EXTRA_CA_CERTS` to the
  proxy CA as well.
- **It contacts more hosts than the data plane.** `console.storage.dev` (browser),
  `iam.storageapi.dev` (device-flow identity) and `mgmt.storageapi.dev` (bucket create/get) are all
  required in addition to `t3.storage.dev`. An allowlist with only the data-plane host produces the
  same opaque authentication failure.
- The CLI also reads `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` from the environment. On a
  machine that has unrelated AWS credentials set, clear them for the Tigris commands or you may
  authenticate as something other than you intend.

Global placement is not a neutral default here. Tigris documents that on a Global bucket a GET or
HEAD for a key that does not exist triggers a cross-region existence check adding *several hundred
milliseconds per request*, and this pipeline checks keys constantly.

## 3. Deploy

Before deploying, confirm every prerequisite. The app **fails closed** on three of them, so a
missing one is a deployment that does not come up rather than one that half works:

| Prerequisite | Why it blocks |
| --- | --- |
| `DATABASE_URL` | Set by `fly postgres attach`; Prisma throws on import without it |
| `REDIS_URL` (`rediss://`) | Worker exits 1 without it; web falls back and warns |
| `SESSION_ENCRYPTION_KEYS` + `..._CURRENT_KEY_ID` | Both processes refuse to start (ADR 0014) |
| `AWS_ENDPOINT_URL_S3`, `BUCKET_NAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Both processes refuse to start (ADR 0015) |
| `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_APP_URL` | `required()` throws at module load |

`fly secrets list -a <app>` should show all of these before you run the deploy.

**Egress:** `fly deploy` builds the image and pushes it to **`registry.fly.io`**. A restricted
network needs that host allowed; `--remote-only` moves the *build* to Fly's builders but the image
still lands in the same registry, so it is not a way around the requirement.

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

# Or remove it entirely, in this order. Each is irreversible and destroys its data.
fly postgres detach spirithaus-staging-db --config fly.staging.toml
fly apps destroy spirithaus-social-studio-staging   # app, machines and volumes
fly apps destroy spirithaus-staging-db              # database and its volume
fly redis destroy spirithaus-staging-redis
fly storage destroy spirithaus-staging-media        # confirm the current flag with --help first
```

Destroying the app does **not** destroy the Postgres app, the Redis instance or the bucket — each
is separate and each bills separately. Check `fly apps list`, `fly redis list`, `fly storage list`
and the dashboard afterwards.

Three things that make "scaled to zero" less free than it sounds:

- **Volumes bill on provisioned capacity**, attached or not, running or not. Scaling to zero leaves
  the 10GB Postgres volume billing at $0.15/GB/month. Only destroying the app releases it.
- **Stopped machines still bill for their root filesystem**, at $0.15/GB per 30 days.
- **Snapshots outlive their volume.** The first 10GB a month are free; beyond that they bill at
  $0.08/GB/month until deleted.

### Recovering media after a teardown

The bucket is the only durable copy of every master, composite and environment plate — the database
holds `objectKey` references, not bytes. So:

- **Destroying the bucket orphans every `media_asset` and `protected_product_asset` row.** The rows
  survive, the artwork does not, and a composite against an ingested master fails its digest check
  because there is nothing to hash. There is no recovery short of re-ingesting from the Shopify
  catalogue with `pnpm sync:shopify-assets`.
- **Destroy the app before the bucket, never after.** A running worker with a destroyed bucket
  fails every job with a storage error rather than refusing at startup — the fail-closed check runs
  once, at boot, and cannot notice a bucket that disappeared underneath it.
- **Keep the bucket if you intend to redeploy.** Recreating the app and pointing it at the existing
  bucket restores every asset, because keys are derived from content digests and asset ids rather
  than from anything the deployment owns.

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
