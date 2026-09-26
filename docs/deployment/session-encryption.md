# Operating session encryption

Shopify access and refresh tokens are encrypted before they are stored (ADR 0014). This is the
operational half: generating a key, rotating it, and what happens when it is lost.

## Generating a key

```sh
openssl rand -base64 32
```

It must decode to **exactly 32 bytes**. A 32-character passphrase is not a 256-bit key, and the
app checks the decoded length rather than the string length for that reason. Base64, base64url
and hex are all accepted.

```sh
SESSION_ENCRYPTION_KEYS="k1:<the generated key>"
SESSION_ENCRYPTION_CURRENT_KEY_ID=k1
```

## Losing every valid key means every shop must reinstall

There is no recovery. Not a support ticket, not a database repair — every stored token becomes
permanently unreadable and each merchant has to install the app again.

**Store the key somewhere durable before deploying.** Fly stores secrets encrypted and will not
show them to you again, so `fly secrets set` is not a backup.

## What is protected, and what is not

Protected: a database dump that escapes, read access to the database without access to the
application, and the copies that outlive deletion — backups, snapshots, replicas.

**Not** protected: an attacker who controls the running application, because the process holds
the key by necessity. And not an attacker who has both the database and the secret store — the
gain comes precisely from those being compromised separately.

Database-level encryption at rest does not cover the first case. It protects against someone
stealing a disk and hands plaintext to anyone who can authenticate.

## Rotation

Two deploys, never one, so there is no window where the app cannot read its own sessions.

1. **Add** the new key alongside the old, keeping the current id pointed at the old one. Nothing
   changes behaviourally; every existing session still opens.
2. **Promote** it by changing `SESSION_ENCRYPTION_CURRENT_KEY_ID`. New writes use the new key,
   and sessions encrypted under the old one are re-encrypted as they are read.
3. **Remove** the old key — later, and only once nothing is still encrypted under it.

Step 3 is the dangerous one. Re-encryption happens when a session is **read**, so a shop nobody
has touched since the rotation is still on the old key. Removing it costs those shops a
reinstall. Check before removing:

```sql
-- Sessions still on an old key. The key id is the third field of the envelope.
SELECT split_part("accessToken", '.', 3) AS key_id, count(*)
FROM session
WHERE "accessToken" LIKE 'shpenc.%'
GROUP BY 1;
```

This query reads key **ids**, not keys, and no token. It is safe to run and safe to paste.

## Tokens written before encryption existed

A stored value with no envelope is **refused** by default: the session does not load, and the log
says to migrate.

```sh
pnpm db:encrypt-sessions            # report what would change
pnpm db:encrypt-sessions --apply    # write
```

It covers both the access token and the refresh token, and classifies by the envelope marker
rather than by attempting decryption — treating a decryption failure as "probably plaintext"
would swallow exactly the tampering the authentication tag exists to catch.

`SESSION_ENCRYPTION_ALLOW_PLAINTEXT_READS=true` reads legacy values without migrating them. It is
**refused outright in any deployed environment** — the process will not start — and exists for a
developer machine. It is removed once the first environment holding real sessions has migrated.

## When a session will not load

| Log line | Cause |
| --- | --- |
| `refusing a session credential that is not encrypted` | A plaintext token. Run the migration. |
| `encrypted with key "<id>", which is not in the current key ring` | A key was retired too early. Restore it to `SESSION_ENCRYPTION_KEYS` if you still have it; otherwise that shop must reinstall. |
| `failed authentication` | The value was modified, or encrypted under a different key with the same id. |
| `refusing to start: ...` | The key ring is missing or invalid. The process will not start, deliberately. |

A session that cannot be opened returns nothing rather than the ciphertext. Handing back an
envelope would send an unreadable string to Shopify and produce an authentication error naming
the wrong cause.
