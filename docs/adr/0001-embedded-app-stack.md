# 0001 — The embedded app stack

**Status:** accepted, 2026-09-26

## Context

Section 5 of the build prompt names a preferred stack and says to use the current
Shopify-recommended one unless the repository already contains a compatible
architecture. The repository contained no application at all, so there was nothing to
preserve and nothing to argue with.

What it did contain was a reason to be careful about versions: the prompt also forbids
relying on remembered endpoints. This environment cannot reach Shopify's documentation,
but it can reach the npm registry, so every version below was read from the registry and
from the installed packages' own type definitions rather than from memory.

## Decision

|                                     |         | Why this version                                                                                                                                        |
| ----------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@shopify/shopify-app-react-router` | ^3.0.0  | The current Shopify app framework package. Its peer range is `react-router ^7.6.2`, which is what pins React Router                                     |
| `react-router`                      | ^7.18.4 | Not 8.x. React Router 8 is released, and the Shopify package does not accept it                                                                         |
| `react` / `react-dom`               | 18.3.1  | `@shopify/polaris@13` peers on `react ^18.0.0`                                                                                                          |
| `prisma` / `@prisma/client`         | 6.19.3  | Not 7.x. `@shopify/shopify-app-session-storage-prisma@11` peers on `^6.19.0`, and using the official session storage is worth more than a major version |
| `typescript`                        | ^5.9    | Not 7.x. `typescript-eslint@8` supports `>=4.8.4 <6.1.0`                                                                                                |
| `bullmq` / `ioredis`                | ^6      | Durable delayed jobs, per ADR 0002                                                                                                                      |
| `vitest`                            | ^5      | With `vite ^7`                                                                                                                                          |

Two departures from the plan in `docs/social-studio`:

**No Turborepo.** `pnpm -r` scripts do the job at this size, and a build orchestrator
that caches nothing useful yet is a dependency without a payment. Revisit when a build
step exists to cache.

**Polaris React rather than Polaris web components.** v3's `AppProvider` loads App
Bridge and the Polaris web components script from `cdn.shopify.com`. Polaris React 13 is
typed, so the compiler checks the UI, and this container cannot reach that CDN to
confirm current guidance on the web components. This is the decision in this ADR most
likely to be revisited once the network policy allows reading Shopify's current
documentation.

## Consequences

- The version matrix is tight in both directions: upgrading React Router, Prisma or
  TypeScript individually breaks a peer. CI installs with `--frozen-lockfile` so a drift
  fails there rather than on someone's machine.
- Remotion (Phase 3) ships its own FFmpeg, so the absent system `ffmpeg` is not a
  blocker.
