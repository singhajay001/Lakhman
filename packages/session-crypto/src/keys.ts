/**
 * Encryption key configuration, and refusing to start without it.
 *
 * Two variables, so that rotation is a two-step change rather than a swap:
 *
 *   SESSION_ENCRYPTION_KEYS           k1:<base64>,k0:<base64>
 *   SESSION_ENCRYPTION_CURRENT_KEY_ID k1
 *
 * Every key listed can *decrypt*; only the current one is used to *encrypt*. Adding a key and
 * promoting it are therefore separate deploys, and the old key stays readable until it is
 * removed — which is what makes rotation safe rather than a cutover with a window where the app
 * cannot read its own sessions.
 *
 * A key is 32 bytes **after decoding**. Checking the length of the encoded string instead would
 * accept a 32-character password, which is not a 256-bit key.
 */
import { logger } from '@spirithaus/observability';

export interface SessionKey {
  id: string;
  /** 32 bytes. Never logged, never included in an error. */
  material: Buffer;
}

export interface KeyRing {
  current: SessionKey;
  /** Every key, current included, by id. Used for decryption. */
  byId: Map<string, SessionKey>;
}

export const KEY_BYTES = 32;

/** Ids are short and boring so they can appear in a ciphertext envelope without ambiguity. */
const KEY_ID = /^[a-z0-9][a-z0-9_-]{0,31}$/;

export class SessionKeyConfigError extends Error {
  constructor(message: string) {
    // Deliberately never carries a key, a prefix of one, or its length: an error string ends up
    // in a log, a crash report and sometimes a screenshot.
    super(message);
    this.name = 'SessionKeyConfigError';
  }
}

/**
 * Decodes a key.
 *
 * Accepts standard and URL-safe base64, and hex, because operators paste all three and a silent
 * misread is worse than a loud refusal. Whatever the encoding, the decoded result must be
 * exactly 32 bytes.
 */
function decodeKey(id: string, encoded: string): Buffer {
  const trimmed = encoded.trim();
  if (trimmed.length === 0) {
    throw new SessionKeyConfigError(`Session encryption key "${id}" is empty.`);
  }

  const candidates: Buffer[] = [];
  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0) {
    candidates.push(Buffer.from(trimmed, 'hex'));
  }
  candidates.push(Buffer.from(trimmed, 'base64'));
  candidates.push(Buffer.from(trimmed.replace(/-/g, '+').replace(/_/g, '/'), 'base64'));

  const usable = candidates.find((buffer) => buffer.length === KEY_BYTES);
  if (!usable) {
    throw new SessionKeyConfigError(
      `Session encryption key "${id}" does not decode to ${KEY_BYTES} bytes. Generate one with: openssl rand -base64 32`,
    );
  }
  return usable;
}

/** Parses `id:key,id:key`. Order does not matter; the current key is chosen by id. */
function parseKeys(raw: string): Map<string, SessionKey> {
  const keys = new Map<string, SessionKey>();

  for (const entry of raw.split(',')) {
    const trimmed = entry.trim();
    if (trimmed.length === 0) continue;

    const separator = trimmed.indexOf(':');
    if (separator <= 0) {
      throw new SessionKeyConfigError(
        'SESSION_ENCRYPTION_KEYS entries must be "id:key", comma separated. One entry has no id.',
      );
    }

    const id = trimmed.slice(0, separator).trim();
    if (!KEY_ID.test(id)) {
      throw new SessionKeyConfigError(
        `Session encryption key id "${id}" is not usable: ids are 1-32 characters of a-z, 0-9, underscore or hyphen.`,
      );
    }
    if (keys.has(id)) {
      throw new SessionKeyConfigError(`Session encryption key id "${id}" is listed twice.`);
    }

    keys.set(id, { id, material: decodeKey(id, trimmed.slice(separator + 1)) });
  }

  if (keys.size === 0) {
    throw new SessionKeyConfigError('SESSION_ENCRYPTION_KEYS is set but lists no keys.');
  }
  return keys;
}

export interface KeyRingOptions {
  /**
   * When true, a missing configuration throws instead of returning null. True for any deployed
   * environment; the caller decides, because only it knows what it is.
   */
  required: boolean;
}

/**
 * Builds the key ring, or throws.
 *
 * Returns null only when nothing is configured *and* configuration is not required — the
 * development case, which the caller is expected to warn about.
 */
export function loadKeyRing(env: NodeJS.ProcessEnv, options: KeyRingOptions): KeyRing | null {
  const raw = env.SESSION_ENCRYPTION_KEYS?.trim();
  const currentId = env.SESSION_ENCRYPTION_CURRENT_KEY_ID?.trim();

  if (!raw && !currentId) {
    if (options.required) {
      throw new SessionKeyConfigError(
        'SESSION_ENCRYPTION_KEYS and SESSION_ENCRYPTION_CURRENT_KEY_ID are not set. Shopify access tokens cannot be stored without them. Generate a key with: openssl rand -base64 32',
      );
    }
    return null;
  }

  // Half a configuration is worse than none: it reads as configured and encrypts nothing.
  if (!raw) {
    throw new SessionKeyConfigError(
      'SESSION_ENCRYPTION_CURRENT_KEY_ID is set but SESSION_ENCRYPTION_KEYS is not.',
    );
  }
  if (!currentId) {
    throw new SessionKeyConfigError(
      'SESSION_ENCRYPTION_KEYS is set but SESSION_ENCRYPTION_CURRENT_KEY_ID is not, so there is no key to encrypt with.',
    );
  }

  const byId = parseKeys(raw);
  const current = byId.get(currentId);
  if (!current) {
    throw new SessionKeyConfigError(
      `SESSION_ENCRYPTION_CURRENT_KEY_ID is "${currentId}", which is not one of the ids in SESSION_ENCRYPTION_KEYS.`,
    );
  }

  logger.info({ currentKeyId: current.id, keyCount: byId.size }, 'session encryption configured');
  return { current, byId };
}
