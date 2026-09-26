/**
 * One-time migration: encrypt any Shopify access token still stored as plaintext.
 *
 *   pnpm db:encrypt-sessions            # report only
 *   pnpm db:encrypt-sessions --apply    # write
 *
 * Explicit rather than automatic. A decorator that quietly re-encrypted whatever it found would
 * also quietly re-encrypt a corrupted value, and would leave nobody able to say when the last
 * plaintext token stopped existing. This prints that answer.
 *
 * Values are classified by the envelope marker, never by attempting decryption — treating a
 * decryption failure as "probably plaintext" would swallow exactly the tampering the
 * authentication tag exists to catch.
 */
import {
  encryptToken,
  isEncryptedEnvelope,
  resolveSessionCryptoPolicy,
} from '@spirithaus/session-crypto';
import { prisma } from './client.js';

interface Counts {
  total: number;
  alreadyEncrypted: number;
  empty: number;
  encrypted: number;
}

export async function encryptStoredSessions(apply: boolean): Promise<Counts> {
  const policy = resolveSessionCryptoPolicy({ component: 'encrypt-sessions' });
  if (!policy.keys) {
    throw new Error(
      'No session encryption key is configured, so there is nothing to encrypt tokens with. Set SESSION_ENCRYPTION_KEYS and SESSION_ENCRYPTION_CURRENT_KEY_ID.',
    );
  }

  const rows = await prisma.session.findMany({
    select: { id: true, shop: true, accessToken: true, refreshToken: true },
  });
  const counts: Counts = { total: rows.length, alreadyEncrypted: 0, empty: 0, encrypted: 0 };

  for (const row of rows) {
    // Both credentials, not just the access token: a refresh token mints access tokens, so
    // leaving it in plaintext beside an encrypted one protects nothing.
    const plaintext = (
      [
        ['accessToken', row.accessToken],
        ['refreshToken', row.refreshToken],
      ] as const
    ).filter(([, value]) => value && !isEncryptedEnvelope(value));

    if (!row.accessToken && !row.refreshToken) {
      counts.empty += 1;
      continue;
    }
    if (plaintext.length === 0) {
      counts.alreadyEncrypted += 1;
      continue;
    }

    counts.encrypted += 1;
    if (apply) {
      await prisma.session.update({
        where: { id: row.id },
        data: Object.fromEntries(
          plaintext.map(([field, value]) => [
            field,
            encryptToken(value as string, policy.keys!.current),
          ]),
        ),
      });
    }
    // The shop and which credentials are named; their values are not, in either direction.
    console.log(
      `${apply ? 'encrypted' : 'would encrypt'} ${plaintext.map(([field]) => field).join(' and ')} for ${row.shop}`,
    );
  }

  return counts;
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const counts = await encryptStoredSessions(apply);

  console.log(
    `\n${counts.total} session(s): ${counts.alreadyEncrypted} already encrypted, ${counts.empty} with no token, ${counts.encrypted} ${apply ? 'encrypted' : 'needing encryption'}.`,
  );
  if (!apply && counts.encrypted > 0) {
    console.log('Nothing was written. Re-run with --apply.');
  }
  if (apply && counts.encrypted > 0) {
    console.log(
      'Done. Unset SESSION_ENCRYPTION_ALLOW_PLAINTEXT_READS now — it is refused in a deployed environment anyway.',
    );
  }
}

// Only when run directly, so the function stays importable by a test.
if (process.argv[1]?.endsWith('encrypt-sessions.ts')) {
  main()
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
