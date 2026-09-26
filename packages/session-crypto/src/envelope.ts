import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';
import type { KeyRing, SessionKey } from './keys.js';

/**
 * The stored form of a Shopify access token.
 *
 * ```
 * shpenc.v1.<keyId>.<nonce>.<tag>.<ciphertext>
 * ```
 *
 * Six dot-separated fields, each base64url so none of them can contain a dot:
 *
 * - `shpenc` — a marker, so a stored value can be classified *without decrypting it*. That is the
 *   whole reason legacy plaintext is detectable rather than guessed at by attempting decryption
 *   and treating failure as "probably plaintext", which would also swallow real tampering.
 * - `v1` — envelope version. A future format changes this and old values keep reading.
 * - `keyId` — which key encrypted it, so rotation does not require decrypting everything first.
 * - `nonce` — 12 bytes, fresh per encryption. Never reused: GCM's security collapses entirely if
 *   a nonce repeats under the same key, which is why it is generated here and never derived.
 * - `tag` — 16-byte GCM authentication tag, verified on every decryption.
 * - `ciphertext` — the token.
 *
 * The key id and version are *not* authenticated as associated data in v1, deliberately: they
 * select the key rather than assert anything, and a wrong key fails the tag check anyway. A v2
 * that adds AAD can be introduced without touching stored v1 values.
 */

export const ENVELOPE_PREFIX = 'shpenc';
export const ENVELOPE_VERSION = 'v1';
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

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

/** True when a stored value is one of ours. Cheap, and does not need a key. */
export function isEncryptedEnvelope(value: string): boolean {
  return value.startsWith(`${ENVELOPE_PREFIX}.`);
}

export function encryptToken(plaintext: string, key: SessionKey): string {
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key.material, nonce);
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
}

export function decryptToken(envelope: string, keys: KeyRing): DecryptedToken {
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

  if (version !== ENVELOPE_VERSION) {
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
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return { plaintext: plaintext.toString('utf8'), keyId };
  } catch {
    // `final()` throws when the tag does not verify. That is the case that matters: the value
    // was altered, or the wrong key was used. The original error says nothing useful and is not
    // propagated, so nothing about the ciphertext escapes into a log.
    throw new SessionDecryptError(
      'The stored token failed authentication: it was modified, or encrypted with a different key.',
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
