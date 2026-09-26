# Session and token security

What `PrismaSessionStorage` stores, what protects it, and what to change before this holds a
credential for a real shop. Findings are from reading the schema, the library and every code path
that touches a token — not from a deployed system, because there has never been one.

## What is stored

`Session` (`packages/db/prisma/schema.prisma`), written by
`@shopify/shopify-app-session-storage-prisma`:

| Field | Sensitivity | Notes |
| --- | --- | --- |
| `accessToken` | **Credential** | Full API access to the shop at the granted scopes. This is the one that matters. |
| `id`, `shop`, `state` | Identifying | `state` is the OAuth nonce. |
| `scope` | Low | What the token can do — useful to an attacker, not itself a secret. |
| `expires` | Low | Online sessions expire within a day; offline sessions do not expire. |
| `userId`, `firstName`, `lastName`, `email` | **Personal data** | Present on online sessions. `email` is a staff member's, not a customer's. |
| `accountOwner`, `collaborator`, `locale`, `emailVerified` | Low | |

The app uses **online tokens** for the request path, so every action has a verified person behind
it, and OAuth stores an **offline** session alongside for the worker. The offline token is the
long-lived credential: it does not expire and is what a background job runs as.

## Findings

**1. Access tokens are stored in plaintext.** `PrismaSessionStorage` performs no encryption —
there is no cipher, no key handling and no hashing anywhere in the library, and the column is a
plain `String`. Anyone who can read the `session` table, a backup of it, or a replica has full
API access to every connected shop at the granted scopes.

This is the library's normal behaviour and how most Shopify apps run. It is stated here because
"the framework handles it" is not a control, and the protection is entirely whatever the database
and host provide.

**2. There is no application-level key, so there is no application-level blast radius limit.** A
database compromise is a token compromise. Encrypting at the application layer would mean a stolen
dump is inert without the key — which matters most in exactly the case where it is easiest to lose
control of a dump: backups and snapshots.

**3. Logs are protected by a declared redaction list, and it covers the right fields.**
`packages/observability/src/logger.ts` redacts `accessToken`, `token`, `authorization`, `apiKey`,
`password`, `email`, plus `*.`-prefixed variants and request headers, at the logger rather than at
call sites — deliberately, because a log line is written by whoever is in a hurry. Verified: no
screen, loader or action in `apps/social-studio/app` references `accessToken`, and no diagnostic
built in Phase 4 echoes a secret or its length.

**4. No credential is in the repository.** Searched for Shopify token shapes (`shpat_`, `shpss_`,
`shpca_`) and private-key headers across the tree: nothing. Test fixtures use obviously synthetic
values (`'t'`, `'shpat_test'`).

**5. Tokens are deleted on uninstall, and history is not.** `app/uninstalled` calls
`findSessionsByShop` then `deleteSessions`, marks the shop uninstalled and disables provider
configuration, all inside an audited handler. The audit trail and published history stay, per
section 31 — the record of what was published is not a credential.

**6. The Session table sits outside RBAC.** The six roles and 32 permissions govern application
resources; sessions are infrastructure with no permission gating them. That is correct given
nothing exposes them, and it means database access is the only access path — which puts the whole
weight on control 1 above.

**7. Reauthorisation is the library's, not ours.** An invalid or revoked token surfaces as
`class: 'auth'` from `AdminClient` — *distinct from `network_blocked`*, which is the Phase 4
change — and the embedded app's token exchange obtains a fresh session on the next request. The
worker has no such path: it runs on the offline token and reports `UNREACHABLE` when there is
none, rather than attempting a silent re-auth it has no user for.

## Staging: sufficient with conditions

For a **development store** carrying no real customer data, plaintext storage is an acceptable
risk provided:

- The database is not publicly reachable, and TLS is enforced (`sslmode=require`).
- Backups are encrypted at rest by the provider. Confirm this rather than assume it — an
  unencrypted snapshot is the most likely way a token leaves the system.
- `PRISMA_LOG=query` is never set: query logs carry parameter values.
- Nobody restores a staging dump onto a laptop. That is the realistic exfiltration path.

## Before a production store

Recommended, in order of value:

1. **Encrypt `accessToken` at the application layer.** AES-256-GCM, key from the platform's secret
   manager, per-record random IV, key id stored beside the ciphertext so rotation is possible.
   Implemented as a `SessionStorage` decorator wrapping `PrismaSessionStorage`, so the library
   keeps owning the schema.
2. **Separate the database role the app uses from the one migrations use.** The app needs no DDL.
3. **Alert on `class: 'auth'` failures.** A token rejected outside an install is either a
   revocation or a compromise, and both want a human.
4. **Shorten offline token exposure** by re-running the install on a schedule, so a leaked token
   has a bounded life.

## The encryption migration, if you want it

Not implemented — it needs a decision on key management first, and doing it without one would
just move the secret. The shape:

- `SessionStorage` decorator encrypting on write, decrypting on read; the library's interface is
  small and stable enough for this to be low-risk.
- Ciphertext stored in `accessToken` with a `v1:<keyId>:<iv>:<ct>` prefix, so a plaintext value is
  distinguishable and the migration can run lazily: decrypt-if-prefixed, re-encrypt on next write.
  No backfill window where the app cannot read its own sessions.
- Key from the platform's secret manager, never from the repository or an image layer.
- Rotation by adding a key id and re-encrypting on read; old ids stay readable until retired.
- **Losing the key means every shop must reinstall.** That is the failure mode to plan for, and
  the reason this needs a decision rather than a commit.

Say the word and I will write it up properly as an ADR before touching any code.
