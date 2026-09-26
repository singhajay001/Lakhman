import type { Session } from '@shopify/shopify-api';
import type { SessionStorage } from '@shopify/shopify-app-session-storage';
import { logger } from '@spirithaus/observability';
import {
  decryptToken,
  encryptToken,
  ENVELOPE_VERSION,
  isEncryptedEnvelope,
  SessionDecryptError,
  type CredentialContext,
  type CredentialField,
} from './envelope.js';
import type { SessionCryptoPolicy } from './policy.js';

/** Distinguishes "this credential is absent" from "this credential cannot be trusted". */
const REFUSED = Symbol('refused');

/**
 * Encrypts Shopify access tokens on the way in and decrypts them on the way out.
 *
 * A decorator rather than a replacement: `PrismaSessionStorage` keeps owning the schema, the
 * migrations and the retry behaviour, and this owns exactly one thing — that the `accessToken`
 * column never holds a usable credential.
 *
 * **Every session credential is encrypted, not only the offline access token.** Three things
 * made that the rule rather than a preference:
 *
 * - The online session's token is a live credential for the length of its life, and the library
 *   stores online and offline sessions through the same interface.
 * - `refreshToken` is also stored, and it is the more valuable of the two: it mints access
 *   tokens. Encrypting the access token and leaving it beside a plaintext refresh token would
 *   protect nothing.
 * - `Session.accessToken` is optional and its column is `NOT NULL`, so the library writes `''`
 *   when there is no token. An empty value is left exactly as it is: an envelope around nothing
 *   is just a longer nothing.
 *
 * The session object handed in is never mutated. The library reuses instances, and a caller that
 * kept a reference would otherwise find its plaintext token silently replaced by ciphertext.
 */
export class EncryptedSessionStorage implements SessionStorage {
  constructor(
    private readonly inner: SessionStorage,
    private readonly policy: SessionCryptoPolicy,
  ) {}

  async storeSession(session: Session): Promise<boolean> {
    const keys = this.policy.keys;
    if (this.policy.encryptionDisabled || !keys) return this.inner.storeSession(session);

    // Already an envelope: a re-store of a session loaded and passed straight back. Encrypting
    // again would nest envelopes and make the credential unrecoverable.
    const seal = (value: string | undefined, field: CredentialField): string | undefined =>
      !value || isEncryptedEnvelope(value)
        ? value
        : encryptToken(value, keys.current, this.contextFor(session, field));

    return this.inner.storeSession(
      this.withCredentials(session, {
        accessToken: seal(session.accessToken, 'accessToken'),
        refreshToken: seal(session.refreshToken, 'refreshToken'),
      }),
    );
  }

  async loadSession(id: string): Promise<Session | undefined> {
    const session = await this.inner.loadSession(id);
    if (!session) return undefined;
    return this.open(session);
  }

  async findSessionsByShop(shop: string): Promise<Session[]> {
    const sessions = await this.inner.findSessionsByShop(shop);
    const opened: Session[] = [];
    for (const session of sessions) {
      const result = this.open(session);
      if (result) opened.push(result);
    }
    return opened;
  }

  deleteSession(id: string): Promise<boolean> {
    // Nothing to decrypt to delete something.
    return this.inner.deleteSession(id);
  }

  deleteSessions(ids: string[]): Promise<boolean> {
    return this.inner.deleteSessions(ids);
  }

  /**
   * Turns a stored session into a usable one.
   *
   * Returns undefined when the token cannot be opened. That is deliberate and it is the
   * conservative choice: a session whose token fails authentication is not a session, and
   * handing back the ciphertext as though it were a credential would send an unreadable string
   * to Shopify and produce an authentication error that names the wrong cause.
   */
  private open(session: Session): Session | undefined {
    // Collected rather than acted on inside openOne, so the decision to rewrite is made once
    // with both credentials in hand.
    const stale: { value: boolean } = { value: false };

    const accessToken = this.openOne(session, session.accessToken, 'accessToken', stale);
    if (accessToken === REFUSED) return undefined;

    const refreshToken = this.openOne(session, session.refreshToken, 'refreshToken', stale);
    if (refreshToken === REFUSED) return undefined;

    if (accessToken === session.accessToken && refreshToken === session.refreshToken) {
      return session;
    }

    const opened = this.withCredentials(session, { accessToken, refreshToken });

    // Rotation, lazily: anything opened with a retired key is rewritten with the current one, so
    // a key falls out of use through normal traffic rather than a migration window.
    //
    // The plaintext is already in hand, so this stores it directly. An earlier version re-loaded
    // and re-opened the row, which called this path again and did not terminate.
    if (stale.value) {
      void this.storeSession(opened).catch((error: unknown) => {
        logger.warn(
          {
            shop: session.shop,
            sessionId: session.id,
            err: error instanceof Error ? error.message : String(error),
          },
          're-encryption with the current key failed; the session is still usable under its old key',
        );
      });
    }

    return opened;
  }

  /** Opens one stored credential. Returns REFUSED when it cannot be trusted. */
  private openOne(
    session: Session,
    stored: string | undefined,
    what: CredentialField,
    stale: { value: boolean },
  ): string | undefined | typeof REFUSED {
    if (!stored) return stored;

    if (!isEncryptedEnvelope(stored)) {
      if (this.policy.allowPlaintextReads) {
        logger.warn(
          {
            shop: session.shop,
            sessionId: session.id,
            isOnline: session.isOnline,
            credential: what,
          },
          'read a session credential stored in plaintext; run pnpm db:encrypt-sessions and disable SESSION_ENCRYPTION_ALLOW_PLAINTEXT_READS',
        );
        return stored;
      }
      logger.error(
        { shop: session.shop, sessionId: session.id, credential: what },
        'refusing a session credential that is not encrypted; run pnpm db:encrypt-sessions',
      );
      return REFUSED;
    }

    if (!this.policy.keys) {
      logger.error(
        { shop: session.shop, sessionId: session.id, credential: what },
        'session credential is encrypted but no key is configured',
      );
      return REFUSED;
    }

    try {
      const { plaintext, keyId, version } = decryptToken(
        stored,
        this.policy.keys,
        this.contextFor(session, what),
      );

      // Rewritten when it is on a retired key *or* an older envelope. A v1 value carries no
      // binding to its row, so upgrading it is the point of being able to read it at all.
      if (keyId !== this.policy.keys.current.id || version !== ENVELOPE_VERSION) {
        stale.value = true;
      }
      return plaintext;
    } catch (error) {
      const reason = error instanceof SessionDecryptError ? error.reason : 'unknown';
      logger.error(
        { shop: session.shop, sessionId: session.id, credential: what, reason },
        'could not decrypt a stored session credential',
      );
      return REFUSED;
    }
  }

  /**
   * What a credential is bound to. Taken from the session rather than from the stored value: a
   * binding an attacker can rewrite alongside the ciphertext binds nothing.
   */
  private contextFor(session: Session, field: CredentialField): CredentialContext {
    return { sessionId: session.id, shop: session.shop, field };
  }

  /** A copy carrying different credentials. Never mutates the original. */
  private withCredentials(
    session: Session,
    credentials: { accessToken: string | undefined; refreshToken: string | undefined },
  ): Session {
    const copy = Object.create(Object.getPrototypeOf(session) as object) as Session;
    Object.assign(copy, session, credentials);
    return copy;
  }
}

/**
 * Opens a credential read straight from the database rather than through the session storage.
 *
 * Two places legitimately do that — the worker, which runs on the offline token, and the asset
 * sync script — and both were a bypass waiting to happen: a direct read returns the envelope, and
 * handing that to the Admin client produces an authentication error naming the wrong cause. One
 * shared function so there is one place to get this right.
 *
 * Returns null rather than the stored value when it cannot be opened, for the same reason.
 */
export function openStoredAccessToken(input: {
  stored: string;
  sessionId: string;
  shop: string;
  policy: SessionCryptoPolicy;
  field?: CredentialField;
}): string | null {
  const field = input.field ?? 'accessToken';

  if (!isEncryptedEnvelope(input.stored)) {
    if (input.policy.allowPlaintextReads) {
      logger.warn(
        { shop: input.shop, sessionId: input.sessionId, credential: field },
        'read a session credential stored in plaintext; run pnpm db:encrypt-sessions',
      );
      return input.stored;
    }
    logger.error(
      { shop: input.shop, sessionId: input.sessionId, credential: field },
      'refusing a session credential that is not encrypted; run pnpm db:encrypt-sessions',
    );
    return null;
  }

  if (!input.policy.keys) {
    logger.error(
      { shop: input.shop, sessionId: input.sessionId, credential: field },
      'session credential is encrypted but no key is configured',
    );
    return null;
  }

  try {
    return decryptToken(input.stored, input.policy.keys, {
      sessionId: input.sessionId,
      shop: input.shop,
      field,
    }).plaintext;
  } catch (error) {
    logger.error(
      {
        shop: input.shop,
        sessionId: input.sessionId,
        credential: field,
        reason: error instanceof SessionDecryptError ? error.reason : 'unknown',
      },
      'could not decrypt a stored session credential',
    );
    return null;
  }
}
