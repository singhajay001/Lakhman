# Staging hardening: completion report

Repository work only. **Nothing deployed, nothing provisioned, no charge incurred, no Shopify
store connected, no OAuth performed.**

## 1. Repository status

Branch `claude/spirithaus-social-platform-7msuug`. Clean tree, 528 unit tests, 107 integration
tests, `pnpm verify` green, no migration drift.

## 2. What changed

**New package `packages/session-crypto`** — `keys.ts` (key ring, 32-byte decoded validation),
`envelope.ts` (AES-256-GCM, versioned envelope), `policy.ts` (startup validation, fail closed),
`storage.ts` (the `SessionStorage` decorator), plus 49 unit tests and 17 integration tests.

**Encryption wired in** — `apps/social-studio/app/shopify.server.ts` wraps `PrismaSessionStorage`;
`apps/worker/src/sessions.ts` decrypts, because the worker reads the row directly rather than
through the storage interface. Both validate at module load.

**Health endpoints** — `routes/livez.tsx`, `routes/readyz.tsx`, `lib/redis.server.ts` (one shared
connection), registered in `routes.ts`.

**Migrations** — `20260926083000_session_refresh_token` adds `refreshToken` and
`refreshTokenExpires`. See §7; this one is not cosmetic.

**Migration command** — `packages/db/src/encrypt-sessions.ts`, `pnpm db:encrypt-sessions`.

**Staging configuration** — `fly.staging.toml` (deliberately not `fly.toml`), plus
`docs/deployment/fly-staging.md` and `docs/deployment/session-encryption.md`.

**CI** — the `image` job gains three checks: startup with `--network none`, refusal without a
key, and `/livez` + `/readyz` behaviour including a leakage check on the readiness body.

**ADR 0014** — threat model, envelope, rotation, recovery.

## 3. Docker and CI

Verified against a real image in a real engine (Docker 29.3.1, BuildKit). Every check the CI
`image` job performs was run by hand against the built image first:

| Check | Result |
| --- | --- |
| Image builds | pass |
| Starts with `--network none` | pass — no registry access needed at startup |
| Refuses to start with no encryption key | pass — error names `SESSION_ENCRYPTION_KEYS` |
| `/livez` with no dependencies in the container | `200 {"status":"alive"}` |
| `/readyz` with no dependencies | `503 {"status":"not_ready"}` |
| `/readyz` body leaks no dependency detail | clean — no host, port, driver name or stack |
| Callback preflight still runs | `400` |
| No `.env` in the image | none |
| Credential literals in build history | 0 |
| Prisma client generated and exported | pass |
| `sharp`, `tesseract.js`, lang data resolve | pass |
| Worker refuses without a queue | pass |

Image ~1.6GB.

The verification build differs from the committed `Dockerfile` in exactly two
environment-specific lines: the base image pinned to an already-cached digest (Docker Hub answers
429 to manifest lookups here) and this container's proxy CA injected (it intercepts TLS). CI has
ordinary TLS and no rate limit and needs neither. **The committed Dockerfile has not been built
without those two lines** — the CI `image` job closes that on its first run.

## 4. Encryption design

```
shpenc.v1.<keyId>.<nonce>.<tag>.<ciphertext>
```

Six dot-separated base64url fields. AES-256-GCM. 12-byte nonce, fresh per encryption, never
derived — GCM's security collapses entirely if a nonce repeats under one key. 16-byte tag,
verified on every decryption.

`shpenc` earns its place: a stored value is **classified without decrypting it**, so legacy
plaintext is detected rather than inferred. The alternative — treating a decryption failure as
"probably plaintext" — would swallow exactly the tampering the tag exists to catch.

**Every credential, not only the offline access token.** Online session tokens are live
credentials for as long as they live, and `refreshToken` is the more valuable of the two because
it mints access tokens. A session with no token stores `''` and is left alone.

## 5. Key rotation

```
SESSION_ENCRYPTION_KEYS            k1:<base64>,k0:<base64>
SESSION_ENCRYPTION_CURRENT_KEY_ID  k1
```

Every listed key decrypts; only the current one encrypts. Add, then promote, then — much later —
remove. Sessions encrypted under a retired key are re-encrypted **when read**, so a shop nobody
has touched is still on the old key. Removing it costs those shops a reinstall; there is a query
in `session-encryption.md` to check before removing, and a test asserting the failure mode.

**Losing every valid key means every shop reinstalls.** No recovery.

## 6. Legacy sessions

Refused by default — the session does not load. `SESSION_ENCRYPTION_ALLOW_PLAINTEXT_READS=true`
reads them, emits a redacted warning per read, and is **refused outright when deployed**: the
process will not start. `pnpm db:encrypt-sessions [--apply]` migrates, covering both credentials.
Removal point: once the first environment holding real sessions has migrated.

No schema change was needed for size — the column is `text`, unbounded in PostgreSQL, confirmed
against the live column definition rather than assumed.

## 7. Session storage integration — and a defect it exposed

All 17 integration tests pass through the real `PrismaSessionStorage` against a real database:
store, load, `findSessionsByShop`, delete, `deleteSessions`, online and offline, no double
encryption, no mutation of the caller's session, rotation, refusal of tampered and
foreign-key values, legacy refusal and migration.

**The first run failed every `storeSession`** with ``Unknown argument `refreshToken` ``. The
`session` model was missing `refreshToken` and `refreshTokenExpires`, which
`PrismaSessionStorage` 11 writes on every store — so **OAuth could never have persisted a
session**. The app would have completed the token exchange and then failed to save the result.

This had nothing to do with encryption and was found only because the storage was exercised
against the real library. It is the single most valuable thing in this milestone.

## 8. Liveness and readiness

Measured locally against the built server:

| Scenario | `/livez` | `/readyz` |
| --- | --- | --- |
| Both dependencies up | 200 `{"status":"alive"}`, 22ms | 200 `{"status":"ready"}`, 21ms |
| Redis stopped | 200, 5ms | 503 `{"status":"not_ready"}`, 276ms |
| Redis and Postgres stopped | 200, 5ms | 503, **1.506s** — bounded by the 1.5s per-check timeout |
| Both restarted | 200 | 200, 20ms, **without a restart** |

`/livez` stayed 200 throughout, which is the point: a liveness probe that touched a dependency
would have restarted a healthy process and made the outage worse. The readiness response never
names the failing dependency; the log line carries `database` and `queue` booleans.

Two defects found here, both by running it rather than reading it:

- `lazyConnect` with `enableOfflineQueue: false` made the very first Redis command fail before
  the connection finished opening, so readiness reported not-ready against a perfectly healthy
  Redis.
- `redis()` throws synchronously when `REDIS_URL` is unset, and it was being evaluated in an
  argument list — so the throw escaped the timeout wrapper and surfaced as a **500 rather than a
  503**. A readiness probe that 500s is a readiness probe a load balancer cannot interpret. The
  check now takes a thunk. Verified with no `REDIS_URL` and an unreachable database:
  `/livez` 200, `/readyz` 503 `{"status":"not_ready"}`.

## 9. Fly topology

`syd`. Web and worker as separate process groups from one image. Web: `shared-cpu-1x`/512MB,
`min_machines_running = 1`. Worker: `shared-cpu-1x`/1GB (measured — see fly-staging.md), **no
`auto_stop_machines`** — a suspended worker is a worker that stopped mid-render holding a
ten-minute queue lock. Single-node development-grade Fly Postgres, **marked not approved for
production** in the config itself and in the runbook. Upstash Redis, Tigris storage, private
networking via `fly postgres attach`. Secrets only through `fly secrets set`; `fly.staging.toml`
contains none. Migrations as a `release_command`, rolling strategy.

## 10. Cost, against the US$40 ceiling

Superseded by the verified table in [fly-staging.md](fly-staging.md#budget-ceiling-us40-per-month),
which is now the single source of truth. In summary: **~US$30.23/month expected, ~US$31.79
worst case**, from rates retrieved 2026-09-26 out of each vendor's own documentation source and
priced from the 1 October 2026 Fly increase, with the Sydney markup applied.

The figures previously in this section were indicative and two of them were wrong in the
expensive direction: they assumed a 1GB web machine and a 2GB worker, which together total
US$41.81 and breach the ceiling. The corrected sizes are 512MB web and 1GB worker.

The worker is the always-on item and the one that
grows if concurrency is raised. `fly scale count web=0 worker=0` between test sessions removes
most of it.

## 11. Remaining risks

| Risk | Status |
| --- | --- |
| Committed Dockerfile unbuilt as committed | Two environment-specific lines differed; CI closes it |
| Admin API never called, OAuth never completed | Unchanged. Every success path is mocked |
| Nobody has seen the embedded dashboard | Unchanged |
| Key loss means universal reinstall | By design. Mitigation is operational, not technical |
| Early key retirement | Same effect for shops not read since rotation. Query provided |
| Encryption does not stop an attacker inside the process | Stated in the ADR rather than implied away |
| Development-grade Postgres | Single node, no failover. Staging only, marked in three places |
| Cost figures unconfirmed | Cannot reach pricing pages |
| Readiness has no circuit breaker | A flapping dependency flaps the probe. Fly's grace periods absorb it; not load-tested |
| Image ~1.6GB | Dev dependencies kept because the worker runs TypeScript through `tsx` |

## 12. External actions needing approval

1. **Choose Fly and confirm the ~US$20–37 projection against the US$40 ceiling.**
2. Create the Fly organisation and add a payment method — a paid resource.
3. Provision app, Postgres, Redis, Tigris.
4. Generate and durably store the session encryption key.
5. Create the Shopify development store and configure the Partner app.
6. Run the first OAuth install.

Steps 1–4 are yours alone. I can execute 5's configuration and 6's verification once deployment
is authorised and access is provided.

**Stopped here, as instructed.** Nothing provisioned, nothing deployed, no OAuth, no charge.
