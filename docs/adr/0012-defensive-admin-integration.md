# 0012 — Reaching an Admin API that may not be reachable

**Status:** accepted, 2026-09-26

## Context

Two things stop an Admin call from happening here, and neither is a fault to fix in the app:
OAuth has never been completed, so `PrismaSessionStorage` has no offline session to hand out;
and `*.myshopify.com` is refused by the container's egress policy, so even a real token would not
get out. Background work has to survive both without taking the worker down, and whoever is
debugging has to be told which of the two it was.

Three failure shapes were measured in this container rather than assumed.

**A refused proxy tunnel does not look like one.** With `NODE_USE_ENV_PROXY=1`:

```
TypeError: fetch failed
  cause: Error: Request was cancelled.
    cause: AbortError: Proxy response (403) !== 200 when HTTP Tunneling  [UND_ERR_ABORTED]
```

The thrown value is a `TypeError`, so the client's `thrown.name === 'AbortError'` check was false
and the failure was classed `transient`, **retryable** — three attempts with backoff against a
host that will never answer. Had the check matched, it would have reported a timeout instead.

**Without the proxy it looks like an authentication failure.** Node's `fetch` ignores
`https_proxy` unless the process was started with `NODE_USE_ENV_PROXY`, so the call goes direct
and the egress gateway answers it:

```
403 Forbidden
x-deny-reason: host_not_allowed
Host not in allowlist: <host>. Add this host to your network egress settings to allow access.
```

The client classed any 403 as `auth` — "Shopify rejected the access token. The app may need
reinstalling." That sends someone to the Partner Dashboard to fix a network setting.

**The built server did not start.** Unrelated to Shopify, and found only because this phase ran
it: `tesseract.js` was bundled into the ESM server output, where its CommonJS `__dirname` is
undefined, so the production server threw before serving anything. `pnpm verify` had built the app
for three phases without ever booting it, so the build passed every time.

## Decision

**A blocked host is its own error class.** `network_blocked`, non-retryable, checked before both
the abort branch and the 403-is-auth branch. The diagnostic names the host, says the egress policy
rather than Shopify refused it, says retrying will not help, and — when proxy variables are set
but `NODE_USE_ENV_PROXY` is not — names that as the reason the call went direct. Detection is
deliberately narrow: it walks the cause chain for the proxy's own tunnelling message and reads
the gateway's `x-deny-reason` header, so an ordinary timeout stays a timeout and a genuine 403
from Shopify stays an authentication failure.

Nothing tries to switch `NODE_USE_ENV_PROXY` on from application code. Node reads it once at
startup to install its proxy-aware dispatcher; code that runs later cannot change that, so the
honest thing is to detect the misconfiguration and say so.

**A session that cannot be obtained returns a container, not null.** `ShopifyGateway.resolveSession`
never throws and never returns null: with no offline token it returns `isMock: true` carrying the
reason, so a caller reports *why* it is degraded instead of reporting that something is missing.
A session store that throws is caught too — a database that cannot answer is not a reason to take
down a worker — and recorded as a distinct reason.

**A sandboxed mutation is never reported as applied.** This is the part worth being stubborn
about. A mutation that reports success without having happened is the most dangerous failure mode
in this system: operations would believe inventory was checked or a tag was written, act on it,
and find out later. So the outcome is a three-way union with no field called `success`:

```ts
type MutationOutcome<T> =
  | { outcome: 'applied'; data: T }
  | { outcome: 'sandboxed'; reason: string }
  | { outcome: 'failed'; error: AdminError };
```

`applied` is the only value that means the write reached Shopify. The compiler makes every caller
handle `sandboxed`, the call does not throw, the worker does not die, and nothing downstream can
mistake a bypassed mutation for a completed one. It logs
`[SANDBOX] Outbound mutation bypassed due to network proxy isolation` with the reason. Reads
behave the same way: `sandboxed` rather than empty data, because "we could not ask" must not be
mistakable for "Shopify says there is nothing".

This follows the provider mocks, which are a production shape rather than a test double —
`mock: true`, `verified: false`, publishers returning `published: false` — and section 21, which
forbids simulating an outcome.

**A sync that never reached Shopify is `UNREACHABLE`, not `FAILED`.** `FAILED` sends someone
looking for a fault in the sync and has BullMQ retry work that cannot succeed. The run row carries
the diagnostic, so the reason is visible in the app rather than only in a log, and nothing is
thrown.

**The OAuth callback explains itself.** `authPathPrefix` is `/auth/shopify`, which derives
`/auth/shopify/callback` along with the login, session-token and exit-iframe paths — they move
together or not at all. The route runs a preflight in order (configuration, then parameters, then
shop domain, then signature), so a signature mismatch is never reported for a request that was
malformed or for an app that has no secret to check against. Each failure names the one thing to
change and where.

Two rules the diagnostics obey, because the endpoint is reachable by anyone who knows the URL:
nothing echoes a secret, not even its length; and the detailed remedy is withheld in production,
where the response carries the summary and the code while the log keeps the rest. An endpoint that
tells an anonymous caller which environment variables are unset is reconnaissance.

**`pnpm verify` boots the server.** A build that cannot start still builds, so the build alone was
never evidence. The smoke check spawns the built artefact and probes the callback route, which
answers a parameterless request with its own 400 — proving the server is up, the route table is
wired and the handler runs, with no Shopify, no network and no real credentials.

## Consequences

- `sharp`, `tesseract.js` and `@tesseract.js-data/eng` are declared as dependencies of the app and
  kept external to the SSR build. They are native or CommonJS and cannot be bundled into an ESM
  server; under pnpm's strict layout they must also be resolvable from the app to be externalised.
- `PrismaProductStore` moved to `@spirithaus/shopify/server`, the ADR 0008 pattern again: the
  barrel was importing Prisma, which reads `DATABASE_URL` at module load, so a unit test of HMAC
  verification depended on a database being configured.
- The smoke check sets an exit code rather than calling `process.exit`, because `process.exit`
  skips `finally` — the first version orphaned its server, and the next run passed by connecting
  to the orphan. That was found by deliberately breaking the build and watching the check pass
  anyway; it now fails with the `__dirname` error and leaves no listener behind.
- The Admin API still has not been called. Everything here is exercised against a mocked client
  and against this container's real refusal of `*.myshopify.com`, which is a real measurement of
  the failure path and no measurement at all of the success path.
- Compositing still ran OCR and image processing inside a request handler when this was written.
  It has since moved to the worker — see ADR 0013.
