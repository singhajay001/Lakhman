import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';
import type { KeyRing, SessionKey } from './keys.js';

/**
 * The stored form of a Shopify credential.
 *
 * ```
 * shpenc.v2.<keyId>.<nonce>.<tag>.<ciphertext>
 * ```
 *
 * Six dot-separated fields, each base64url so none of them can contain a dot:
 *
 * - `shpenc` — a marker, so a stored value can be classified *without decrypting it*. That is the
 *   whole reason legacy plaintext is detectable rather than guessed at by attempting decryption
 *   and treating failure as "probably plaintext", which would also swallow real tampering.
 * - `v2` — envelope version. `v1` is still readable; see below.
 * - `keyId` — which key encrypted it, so rotation does not require decrypting everything first.
 * - `nonce` — 12 bytes, fresh per encryption. Never reused: GCM's security collapses entirely if
 *   a nonce repeats under the same key, which is why it is generated here and never derived.
 * - `tag` — 16-byte GCM authentication tag, verified on every decryption.
 * - `ciphertext` — the credential.
 *
 * ## Why v2 exists: the envelope is bound to where it is stored
 *
 * v1 encrypted the credential and nothing else. That is enough to stop someone *reading* a
 * stolen row, and not enough to stop someone *moving* one. A valid envelope was valid anywhere:
 * copy the `accessToken` of shop A over shop B's and the tag still verified, because the tag only
 * ever covered the ciphertext. Anyone with write access to the database could promote themselves
 * into another merchant's shop without ever learning a token.
 *
 * v2 passes the row's identity to GCM as Additional Authenticated Data. The AAD is not stored —
 * it is reconstructed from the row at decryption time — so an envelope only opens where it was
 * written:
 *
 * - the **session id**, so it cannot move between sessions;
 * - the **shop domain**, so it cannot move between shops;
 * - the **field name**, so an access token cannot be pasted into the refresh token column;
 * - the **envelope version**, so a v2 value cannot be relabelled as v1 to shed its binding.
 *
 * Encoded with `JSON.stringify` over a fixed-order array, which escapes its own separators — a
 * naive `a|b|c` join would let a shop domain containing the separator impersonate a different
 * (sessionId, shop) pair.
 *
 * ## v1 values
 *
 * Still decryptable, and reported as v1 so the caller can rewrite them as v2. They carry no
 * binding and never will; the point of reading them is to replace them.
 */

export const ENVELOPE_PREFIX = 'shpenc';
/** What new values are written as. */
export const ENVELOPE_VERSION = 'v2';
/** What can still be read. v1 predates the AAD binding. */
export const READABLE_VERSIONS = ['v1', 'v2'] as const;

const NONCE_BYTES = 12;
const TAG_BYTES = 16;

/** Which credential a value is. Part of the binding, so the two cannot be swapped. */
export type CredentialField = 'accessToken' | 'refreshToken';

/**
 * Where a credential lives. Reconstructed from the row at decryption time and never stored — a
 * binding an attacker can rewrite alongside the ciphertext binds nothing.
 */
export interface CredentialContext {
  sessionId: string;
  shop: string;
  field: CredentialField;
}

export class SessionDecryptError extends Error {
  constructor(
    message: string,
    /** Distinguishes "not ours" from "ours and broken", which need different responses. */
    readonly reason: 'malformed' | 'unknown_key' | 'authentication_failed' | 'unsupported_version',
  ) {
    // Carries no ciphertext, no key material and no fragment of either.
    super(message);
    this.name = 'SessionDecryptError';
  }
}

const b64url = (buffer: Buffer): string => buffer.toString('base64url');

/**
 * The bytes GCM authenticates alongside the ciphertext.
 *
 * Shop domains are case-insensitive, so it is lowercased: a session stored as `Shop.myshopify.com`
 * and read back as `shop.myshopify.com` must still open, and a mismatch there would look exactly
 * like tampering.
 */
export function associatedData(version: string, context: CredentialContext): Buffer {
  return Buffer.from(
    JSON.stringify([version, context.sessionId, context.shop.toLowerCase(), context.field]),
    'utf8',
  );
}

/** True when a stored value is one of ours. Cheap, and does not need a key. */
export function isEncryptedEnvelope(value: string): boolean {
  return value.startsWith(`${ENVELOPE_PREFIX}.`);
}

export function encryptToken(
  plaintext: string,
  key: SessionKey,
  context: CredentialContext,
): string {
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key.material, nonce);
  cipher.setAAD(associatedData(ENVELOPE_VERSION, context));
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    ENVELOPE_PREFIX,
    ENVELOPE_VERSION,
    key.id,
    b64url(nonce),
    b64url(tag),
    b64url(ciphertext),
  ].join('.');
}

export interface DecryptedToken {
  plaintext: string;
  /** The key that opened it. Compare with the current key id to decide on re-encryption. */
  keyId: string;
  /** The envelope version it was written as. Anything but the current one wants rewriting. */
  version: string;
}

export function decryptToken(
  envelope: string,
  keys: KeyRing,
  context: CredentialContext,
): DecryptedToken {
  const parts = envelope.split('.');
  if (parts.length !== 6 || parts[0] !== ENVELOPE_PREFIX) {
    throw new SessionDecryptError(
      'The stored value is not an encrypted token envelope.',
      'malformed',
    );
  }

  const [, version, keyId, nonceRaw, tagRaw, ciphertextRaw] = parts as [
    string,
    string,
    string,
    string,
    string,
    string,
  ];

  if (!(READABLE_VERSIONS as readonly string[]).includes(version)) {
    throw new SessionDecryptError(
      `Stored token uses envelope version "${version}", which this build does not understand.`,
      'unsupported_version',
    );
  }

  const key = keys.byId.get(keyId);
  if (!key) {
    // The usual cause is a key retired before everything encrypted with it was re-encrypted.
    throw new SessionDecryptError(
      `Stored token was encrypted with key "${keyId}", which is not in the current key ring.`,
      'unknown_key',
    );
  }

  const nonce = Buffer.from(nonceRaw, 'base64url');
  const tag = Buffer.from(tagRaw, 'base64url');
  const ciphertext = Buffer.from(ciphertextRaw, 'base64url');

  if (nonce.length !== NONCE_BYTES || tag.length !== TAG_BYTES) {
    throw new SessionDecryptError(
      'The stored envelope has a nonce or authentication tag of the wrong size.',
      'malformed',
    );
  }

  try {
    const decipher = createDecipheriv('aes-256-gcm', key.material, nonce);
    // v1 predates the binding and has none. v2 is bound to its row, and the version is itself
    // inside the AAD, so a v2 value relabelled as v1 fails rather than shedding its binding.
    if (version !== 'v1') decipher.setAAD(associatedData(version, context));
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return { plaintext: plaintext.toString('utf8'), keyId, version };
  } catch {
    // `final()` throws when the tag does not verify: the value was altered, moved to a different
    // row or field, or encrypted with a different key. The original error says nothing useful and
    // is not propagated, so nothing about the ciphertext escapes into a log.
    throw new SessionDecryptError(
      'The stored token failed authentication: it was modified, encrypted with a different key, or copied from another session, shop or field.',
      'authentication_failed',
    );
  }
}

/** Constant-time comparison, for tests that assert two envelopes differ. */
export function envelopesEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
