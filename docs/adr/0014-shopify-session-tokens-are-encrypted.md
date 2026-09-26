# 0014 — Shopify session credentials are encrypted at the application layer

**Status:** accepted, 2026-09-26

## Context

`PrismaSessionStorage` stores Shopify access tokens in plaintext. There is no cipher and no key
handling anywhere in the library; the column is a plain `text`. This is how most Shopify apps
run, and it means the only thing protecting a credential with full API access to a merchant's
shop is whatever the database and host provide.

### Threat model

What this defends against:

- **A database dump that escapes.** A snapshot on a laptop, an unencrypted backup, a restore into
  a less careful environment, a misconfigured replica. This is the realistic path — far more
  likely than an attacker with a shell on the application host.
- **Read access to the database without access to the application.** A compromised reporting
  credential, a SQL injection in unrelated code, a support engineer with production read access.
- **Retention after deletion.** Backups outlive the row. A token deleted at uninstall is still in
  last week's snapshot; encrypted, that copy is inert without the key.

What it does **not** defend against, stated plainly because the opposite claim is the usual one:

- **An attacker who controls the running application.** The process holds the key by necessity.
  Anything that can execute code in it can decrypt every token, and this design does not pretend
  otherwise.
- **An attacker who has both the database and the secret store.** Encryption relocates the secret
  from the database to the platform's secret manager. That is a real gain precisely because the
  two are compromised separately; it is not a gain if they are compromised together.
- **A leaked token in transit or in a log.** Different control — redaction, which is declared at
  the logger.

Database-level encryption at rest does not cover the first or third case. A provider that
encrypts volumes protects against someone stealing a disk, and hands plaintext to anyone who can
authenticate to the database — which is what a leaked dump, a restored snapshot and a compromised
read credential all look like.

## Decision

Encrypt every Shopify credential the application persists, with AES-256-GCM, in a decorator over
`PrismaSessionStorage`.

### Envelope

```
shpenc.v1.<keyId>.<nonce>.<tag>.<ciphertext>
```

Six dot-separated fields, each base64url so none can contain a dot.

`shpenc` is the part that earns its place: a stored value can be **classified without decrypting
it**. Legacy plaintext is therefore detected rather than inferred — the alternative, treating a
decryption failure as "probably plaintext", would also swallow exactly the tampering the
authentication tag exists to catch.

`v1` allows a future format without touching stored values. `keyId` allows rotation without
decrypting everything first. The nonce is 12 random bytes, fresh for every encryption and never
derived: GCM's security collapses entirely if a nonce repeats under one key. The tag is verified
on every decryption.

Version and key id are not authenticated as associated data in v1, deliberately: they select a
key rather than assert anything, and a wrong key fails the tag check regardless.

### Every credential, not only the offline access token

Three reasons, and the second was found by running the code rather than reading it:

- The **online** session's token is a live credential for as long as it lives, and the library
  stores online and offline sessions through the same interface.
- `refreshToken` is also stored — and it is the more valuable of the two, because it mints access
  tokens. Encrypting one and leaving the other beside it in plaintext would protect nothing.
- A session with no token stores `''` (the column is `NOT NULL` while `Session.accessToken` is
  optional). An empty value is left alone: an envelope around nothing is just a longer nothing.

### Keys

```
SESSION_ENCRYPTION_KEYS            k1:<base64>,k0:<base64>
SESSION_ENCRYPTION_CURRENT_KEY_ID  k1
```

Every listed key can decrypt; only the current one encrypts. Adding a key and promoting it are
separate deploys, which is what makes rotation safe rather than a cutover with a window where the
app cannot read its own sessions.

A key must decode to **exactly 32 bytes**. Checking the encoded string's length instead would
accept a 32-character passphrase, which is not a 256-bit key. Base64, base64url and hex are all
accepted because operators paste all three and a silent misread is worse than a loud refusal.

Keys live in the platform's secret manager. Never in the repository, an image layer, a test
fixture or `.env.example`.

### Fail closed

Any process that can read or write a session validates at startup, and refuses to start when the
key is absent, undecodable, the wrong length, or the current id is not in the ring. Both the web
process and the worker do this — the worker reads the session row directly, so it decrypts too.

"Deployed" means any `NODE_ENV` other than `development` or `test`, so staging fails closed
exactly as production does.

### Legacy plaintext is not accepted indefinitely

A stored value with no envelope is **refused** by default: the session does not load. A developer
can set `SESSION_ENCRYPTION_ALLOW_PLAINTEXT_READS=true` to read one, which emits a redacted
warning per read and is **refused outright in a deployed environment** — not warned about,
refused, with the error naming the migration.

`pnpm db:encrypt-sessions` performs a one-time migration, reporting by default and writing with
`--apply`. **Removal point:** the switch and the plaintext branch go once the first environment
holding real sessions has run the migration. Until then they are covered by tests that assert the
production refusal.

No schema change was needed for size: the column is `text`, which is unbounded in PostgreSQL.
Verified against the live column definition rather than assumed.

## Consequences

- **Losing every valid key means every shop must reinstall.** There is no recovery. This is the
  single most important operational fact about this decision, and the rotation runbook says it
  twice.
- Retiring a key before everything encrypted with it has been re-encrypted has the same effect
  for those shops. Re-encryption happens lazily when a session is *read*, so a shop nobody has
  touched since a rotation is still on the old key. There is a test for exactly this.
- A session whose credential cannot be opened returns `undefined` rather than the ciphertext.
  Handing back an envelope would send an unreadable string to Shopify and produce an
  authentication error naming the wrong cause.
- Backups now contain ciphertext. They still need to be encrypted and access-controlled — this
  reduces the blast radius of a leaked dump, it does not make one safe.
- Fixing this surfaced a defect that had nothing to do with encryption: the `session` table was
  missing `refreshToken` and `refreshTokenExpires`, which `PrismaSessionStorage` 11 writes on
  every store. **Every `storeSession` would have failed**, so OAuth could never have persisted a
  session. Found by exercising the real library against a real database, and fixed in the same
  migration series.
