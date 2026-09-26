# Staging readiness report

Commit at the time of writing: `f2192ee` on `claude/spirithaus-social-platform-7msuug`.

**Nothing has been deployed. No infrastructure exists. No money has been committed.** This report
is what you asked for before any of that is decided.

## 1. Evidence key

Used consistently below and throughout `docs/deployment/`.

| Mark | Meaning |
| --- | --- |
| **Local** | Ran on this development machine |
| **CI** | Runs in GitHub Actions on every push |
| **Docker** | Ran against a real image in a real engine |
| **Staging** | Ran in a deployed staging environment — *nothing has this mark* |
| **Shopify** | Ran against a real Shopify store — *nothing has this mark* |
| **Mocked** | Exercised against a mock |
| **Unverified** | Follows from the code; never executed |

## 2. Docker and CI results

A Docker daemon (29.3.1, BuildKit) turned out to be startable in this environment, so the image
was built and run for real rather than left unverified.

| Check | Result | Evidence |
| --- | --- | --- |
| Full workspace available during install | **pass** | Docker. All 15 manifests collected; the previous hand-written list was missing 5 |
| `pnpm install --frozen-lockfile` | **pass** | Docker |
| Workspace dependency resolution | **pass** | Docker |
| Production app build | **pass** | Docker + CI |
| Prisma generated at the right stage | **pass** | Docker. `PrismaClient` resolves and is a function from the app's context |
| `sharp`, `tesseract.js`, lang data resolve | **pass** | Docker |
| Image starts | **pass** | Docker. Answers in **4 seconds** |
| Startup probe | **pass** | Docker. `GET /auth/shopify/callback` → `400 missing_parameters` |
| No orphaned process | **pass** | Local. `pnpm smoke` sets an exit code instead of calling `process.exit`, which skips `finally` |
| No secrets in the image | **pass** | Docker. No `.env`; no credential literals in `docker history` |
| Worker refuses without a queue | **pass** | Docker. Logs `REDIS_URL is not set. The worker cannot run.` |
| Caching | **improved** | Added `.dockerignore`; context was **313MB**, almost all `node_modules` the build discards |

### Two real defects found by running it

Neither would have been found by building alone, and both would have stopped the first staging
deploy.

**The container could not start.** `corepack enable` installs shims but downloads the package
manager on first use. That happened during the build, but the runtime stage inherited only the
shims — so every container start reached for the npm registry, and **the container exited before
serving anything**. On a host without that egress it could never start. Fixed by baking pnpm in
with `corepack prepare pnpm@9.15.0 --activate`, and by making the default command run `node`
directly: starting a production process should not depend on a package manager resolving a
workspace filter.

**The build context was 313MB.** No `.dockerignore`, so `node_modules`, `.git` and build
outputs were shipped to the daemon on every build and any change anywhere invalidated the cache.

### What CI now does

`.github/workflows/ci.yml` gains a `pnpm smoke` step in `verify`, and an independent `image`
job that builds the Dockerfile, checks runtime dependency resolution, checks the Prisma client,
scans for secrets in layers and history, starts the container and probes it, tears down with
`if: always()`, and asserts the worker's refusal. It **pushes nothing**.

### One honest caveat

The verified build differed from the committed Dockerfile in exactly two lines, both
environment-specific: the base image was pinned to an already-cached digest (Docker Hub answered
429 to manifest lookups), and this container's proxy CA was injected because it intercepts TLS.
CI has ordinary TLS and no rate limit and needs neither. **The committed Dockerfile itself has not
been built without those two lines** — the `image` job is what will prove that, on its first run.

## 3. Recommended platform

**Fly.io.** Two process groups from one image, managed Postgres and Redis, S3-compatible storage,
a stable HTTPS origin without buying a domain, machines that can be told not to stop, and no
egress filtering to work around. Reasoning and alternatives in [`platform.md`](platform.md).

If cost dominates, Hetzner with Compose is roughly a fifth of the price and makes you the DBA.

## 4. Expected monthly cost

**~US$25–45 / month**, indicative. Web ~$5–7, worker ~$10–15 (2GB; image work is memory-hungry),
Postgres ~$5–10, Redis ~$5–10, storage ~$1–3.

**This is the least reliable figure in the report.** This environment cannot reach pricing pages,
so the numbers come from general knowledge and must be confirmed at sign-up. Stopping staging
between test sessions, or co-hosting Postgres and Redis, roughly halves it.

## 5. Component topology

```
Shopify Admin ──HTTPS──> Web (PORT, public)  ─┐
                                              ├─> PostgreSQL 16
                          Worker (no inbound) ─┤
                            │                  ├─> Redis 7  (BullMQ)
                            └──────────────────┴─> Object storage (S3-compatible)

Web  ──enqueue──> Redis ──claim──> Worker      (sync, composite, render)
```

One image, two commands. Both processes must see the **same** object storage — the local-directory
fallback is not shared between hosts, and a composite will fail with a missing-environment error
if it is left at its default.

## 6. Environment matrix

[`environment-matrix.md`](environment-matrix.md), built by enumerating every `process.env`
reference rather than by reading `.env.example`. The two disagreed:

- **`SCOPES` was listed and read by nothing.** Scopes come from `mandatoryScopeList()`. Removed.
- **`ANTHROPIC_API_KEY`, `FAL_KEY`, `ELEVENLABS_API_KEY`, `S3_*`** were placeholders for
  unimplemented providers, reading as a checklist for a live deployment. Removed.
- Confirmed again: **there is no Admin access token variable and there will not be one.**

## 7. Minimum egress

| Host | Needed by |
| --- | --- |
| `<shop>.myshopify.com` | web, worker |
| PostgreSQL, Redis, object storage endpoints | web, worker |
| `cdn.shopify.com` | the asset-ingestion **script**, not the running app |
| Remotion CDN | worker, first render only, only if `REMOTION_BROWSER_EXECUTABLE` is unset |

**Not required:** `graph.facebook.com`, `graph.instagram.com`, `open-api.tiktok.com`. No code
path calls them, every publisher is a non-publishing mock, and no account connection is
authorised. Opening them now widens the surface for nothing.

## 8. Shopify Partner Dashboard

App URL `<SHOPIFY_APP_URL>`; allowed redirection URL
`<SHOPIFY_APP_URL>/auth/shopify/callback` byte for byte; embedded enabled. Seven mandatory
scopes, five optional, **no write access to merchant data**. Ten webhook topics across four
endpoints. Full detail in [`development-store.md`](development-store.md).

## 9. Development store runbook

[`development-store.md`](development-store.md): store creation, app configuration, scope table
with the feature each one buys, install, the session-persistence check (**expect two rows** —
online and offline), embedded dashboard verification, uninstall and reinstall, seven common
failures, and what evidence to capture with the redaction rules.

## 10. Session and token security

Full findings in [`session-security.md`](session-security.md). The material ones:

- **Access tokens are stored in plaintext.** `PrismaSessionStorage` does no encryption — no
  cipher, no key handling anywhere in the library. A database compromise is a token compromise.
  This is normal for Shopify apps and is stated because "the framework handles it" is not a
  control.
- **Log redaction is declared at the logger** and covers `accessToken`, `token`,
  `authorization`, `apiKey`, `password`, `email` and request headers. No screen, loader or
  action references `accessToken`; no Phase 4 diagnostic echoes a secret or its length.
- **No credential is in the repository.** Searched for `shpat_`/`shpss_`/`shpca_` shapes and
  private-key headers: none. Fixtures are synthetic.
- **Tokens are deleted on uninstall**, providers disabled, shop marked, inside an audited handler.
  Audit history stays.
- For a development store with no real customer data, plaintext is acceptable **provided** the
  database is private, TLS enforced, backups encrypted at rest and `PRISMA_LOG` never set to
  `query`.
- Application-level encryption is designed but **not implemented**: it needs a key-management
  decision first, and losing the key means every shop reinstalls.

## 11. External actions needing your approval

1. **Choose the platform** and confirm the cost.
2. **Create the account and add a payment method** — a paid resource, outside current
   authorisation.
3. **Provision** web, worker, Postgres, Redis, object storage.
4. **Create the Shopify development store** and configure the Partner app.
5. **Run the first OAuth install**, which is the first time a real token will exist.

Steps 1–3 are yours. I can do 4's configuration steps as instructions and 5's verification once
you authorise deployment and provide access.

## 12. Risks and unverified assumptions

| Risk | Status |
| --- | --- |
| **The Admin API has never been called** | Failure paths well measured against this container's real refusal; the success path measured not at all |
| **OAuth has never completed** | No session has ever existed. Everything downstream is unexercised |
| **Nobody has seen the embedded dashboard** | App Bridge needs `cdn.shopify.com`; every `/app/*` route is loader-and-test-verified only |
| **No platform figure is verified** | `PLATFORM_PROFILE_VERSION = '2026-09-26.unverified'`; safe-zone insets are modelled, not observed |
| **Committed Dockerfile unbuilt as committed** | Two environment-specific lines differed; the CI `image` job closes this on first run |
| **Cost figures unconfirmed** | Cannot reach pricing pages from here |
| **Image is 1.6GB** | Dev dependencies are kept because the worker runs TypeScript through `tsx`. Large but working; slimming it is a later optimisation |
| **No dedicated health endpoint** | The callback probe is a real signal but indirect. A `/healthz` checking database and Redis is small work if you want it |
| **Local media store is a two-host trap** | Leave `MEDIA_STORE_DIR` at its default across two hosts and composites fail with a missing environment |
| **Plaintext access tokens** | Acceptable for a development store under the conditions above; not for production |

## One question that genuinely blocks the decision

Everything else can proceed on assumptions. This cannot:

**Which platform, and is ~US$25–45/month acceptable?** Provisioning cannot start without it, and
the answer changes the runbook, the secret-management steps and the egress configuration.

Everything below that line is ready to execute on your word.
