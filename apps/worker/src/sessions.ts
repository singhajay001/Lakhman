import { prisma } from '@spirithaus/db';
import { logger } from '@spirithaus/observability';
import {
  assertSessionCryptoConfigured,
  decryptToken,
  isEncryptedEnvelope,
} from '@spirithaus/session-crypto';

/**
 * The worker reads the session row directly rather than through the session storage, so it has
 * to do the decryption the decorator would have done. Validated at module load for the same
 * reason the web process validates: a worker that discovers a bad key ring on its first job has
 * already told the queue it was healthy.
 */
const sessionCrypto = assertSessionCryptoConfigured({ component: 'worker' });

/**
 * The offline access token for a shop.
 *
 * The app uses online tokens so that every action has a verified person behind it
 * (section 20). Online tokens expire within a day, so background work cannot use them —
 * OAuth stores an offline session alongside, and that is what a worker runs as. A job
 * therefore acts as the app, not as a person, which is why anything needing human
 * authority stays in the request path.
 */
export async function offlineAccessToken(shopDomain: string): Promise<string | null> {
  const session = await prisma.session.findFirst({
    where: { shop: shopDomain, isOnline: false },
    orderBy: { id: 'asc' },
    select: { id: true, shop: true, accessToken: true },
  });
  const stored = session?.accessToken;
  if (!stored) return null;

  if (!isEncryptedEnvelope(stored)) {
    if (sessionCrypto.allowPlaintextReads) {
      logger.warn(
        { shop: shopDomain },
        'offline session token is stored in plaintext; run pnpm db:encrypt-sessions',
      );
      return stored;
    }
    logger.error(
      { shop: shopDomain },
      'refusing an offline session token that is not encrypted; run pnpm db:encrypt-sessions',
    );
    return null;
  }

  if (!sessionCrypto.keys) {
    logger.error({ shop: shopDomain }, 'offline token is encrypted but no key is configured');
    return null;
  }

  try {
    // The context binds the envelope to this row: an access token copied from another session,
    // another shop, or the refresh token column fails authentication rather than opening.
    return decryptToken(stored, sessionCrypto.keys, {
      sessionId: session.id,
      shop: session.shop,
      field: 'accessToken',
    }).plaintext;
  } catch (error) {
    // Returning null rather than the ciphertext: a job that sends an unreadable string to
    // Shopify gets an authentication error naming the wrong cause, and the gateway would report
    // it as a rejected token rather than as the configuration fault it is.
    logger.error(
      { shop: shopDomain, reason: error instanceof Error ? error.name : 'unknown' },
      'could not decrypt the offline session token',
    );
    return null;
  }
}
