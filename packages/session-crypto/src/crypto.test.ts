import { describe, expect, it } from 'vitest';
import {
  decryptToken,
  encryptToken,
  ENVELOPE_PREFIX,
  isEncryptedEnvelope,
  SessionDecryptError,
} from './envelope.js';
import { loadKeyRing, SessionKeyConfigError, type KeyRing } from './keys.js';

/**
 * Deterministic test keys. Fixed so a failure is reproducible, and obviously not a real key:
 * 32 bytes of a repeating pattern. Nothing here is usable anywhere.
 */
const KEY_A = Buffer.alloc(32, 0xa1).toString('base64');
const KEY_B = Buffer.alloc(32, 0xb2).toString('base64');

const ring = (current: string, keys: Record<string, string>): KeyRing =>
  loadKeyRing(
    {
      SESSION_ENCRYPTION_KEYS: Object.entries(keys)
        .map(([id, value]) => `${id}:${value}`)
        .join(','),
      SESSION_ENCRYPTION_CURRENT_KEY_ID: current,
    } as NodeJS.ProcessEnv,
    { required: true },
  ) as KeyRing;

const TOKEN = 'shpat_a_token_that_is_not_real_0123456789';

describe('the envelope', () => {
  const keys = ring('k1', { k1: KEY_A });

  it('round trips', () => {
    const envelope = encryptToken(TOKEN, keys.current);
    expect(decryptToken(envelope, keys).plaintext).toBe(TOKEN);
  });

  it('is recognisable without a key, so plaintext never needs guessing', () => {
    // Classifying by attempting decryption would treat real tampering as "probably plaintext".
    expect(isEncryptedEnvelope(encryptToken(TOKEN, keys.current))).toBe(true);
    expect(isEncryptedEnvelope(TOKEN)).toBe(false);
    expect(isEncryptedEnvelope('')).toBe(false);
  });

  it('carries the version and key id in the clear', () => {
    const parts = encryptToken(TOKEN, keys.current).split('.');
    expect(parts).toHaveLength(6);
    expect(parts[0]).toBe(ENVELOPE_PREFIX);
    expect(parts[1]).toBe('v1');
    expect(parts[2]).toBe('k1');
  });

  it('never repeats a nonce, so the same token encrypts differently every time', () => {
    // GCM's security collapses entirely if a nonce repeats under one key.
    const envelopes = new Set<string>();
    const nonces = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      const envelope = encryptToken(TOKEN, keys.current);
      envelopes.add(envelope);
      nonces.add(envelope.split('.')[3] as string);
    }
    expect(envelopes.size).toBe(200);
    expect(nonces.size).toBe(200);
  });

  it('does not leak the token in the envelope', () => {
    expect(encryptToken(TOKEN, keys.current)).not.toContain('shpat_a_token');
  });

  it('rejects a tampered ciphertext', () => {
    const parts = encryptToken(TOKEN, keys.current).split('.');
    const ciphertext = Buffer.from(parts[5] as string, 'base64url');
    ciphertext[0] = (ciphertext[0] as number) ^ 0xff;
    parts[5] = ciphertext.toString('base64url');

    expect(() => decryptToken(parts.join('.'), keys)).toThrow(SessionDecryptError);
    try {
      decryptToken(parts.join('.'), keys);
    } catch (error) {
      expect((error as SessionDecryptError).reason).toBe('authentication_failed');
    }
  });

  it('rejects a tampered authentication tag', () => {
    const parts = encryptToken(TOKEN, keys.current).split('.');
    const tag = Buffer.from(parts[4] as string, 'base64url');
    tag[0] = (tag[0] as number) ^ 0xff;
    parts[4] = tag.toString('base64url');
    expect(() => decryptToken(parts.join('.'), keys)).toThrow(/failed authentication/);
  });

  it('rejects a tampered nonce', () => {
    const parts = encryptToken(TOKEN, keys.current).split('.');
    const nonce = Buffer.from(parts[3] as string, 'base64url');
    nonce[0] = (nonce[0] as number) ^ 0xff;
    parts[3] = nonce.toString('base64url');
    expect(() => decryptToken(parts.join('.'), keys)).toThrow(SessionDecryptError);
  });

  it('rejects the wrong key', () => {
    const envelope = encryptToken(TOKEN, keys.current);
    // Same key id, different material: the id selects, the tag decides.
    const impostor = ring('k1', { k1: KEY_B });
    try {
      decryptToken(envelope, impostor);
      throw new Error('expected a rejection');
    } catch (error) {
      expect((error as SessionDecryptError).reason).toBe('authentication_failed');
    }
  });

  it('rejects a key id it does not hold', () => {
    const envelope = encryptToken(TOKEN, ring('k9', { k9: KEY_B }).current);
    try {
      decryptToken(envelope, keys);
      throw new Error('expected a rejection');
    } catch (error) {
      expect((error as SessionDecryptError).reason).toBe('unknown_key');
    }
  });

  it('rejects an unsupported envelope version', () => {
    const parts = encryptToken(TOKEN, keys.current).split('.');
    parts[1] = 'v99';
    try {
      decryptToken(parts.join('.'), keys);
      throw new Error('expected a rejection');
    } catch (error) {
      expect((error as SessionDecryptError).reason).toBe('unsupported_version');
    }
  });

  it.each([
    ['plaintext', TOKEN],
    ['too few fields', 'shpenc.v1.k1.abc'],
    ['empty', ''],
    ['marker only', 'shpenc.'],
    [
      'short nonce',
      `shpenc.v1.k1.${Buffer.alloc(4).toString('base64url')}.${Buffer.alloc(16).toString('base64url')}.AAAA`,
    ],
    [
      'short tag',
      `shpenc.v1.k1.${Buffer.alloc(12).toString('base64url')}.${Buffer.alloc(4).toString('base64url')}.AAAA`,
    ],
  ])('rejects a malformed envelope: %s', (_name, value) => {
    expect(() => decryptToken(value, keys)).toThrow(SessionDecryptError);
  });

  it('says nothing about the key or the ciphertext when it fails', () => {
    const parts = encryptToken(TOKEN, keys.current).split('.');
    parts[5] = Buffer.from('nonsense').toString('base64url');
    try {
      decryptToken(parts.join('.'), keys);
    } catch (error) {
      const message = (error as Error).message;
      expect(message).not.toContain(KEY_A);
      expect(message).not.toContain(parts[5]);
      expect(message).not.toContain(TOKEN);
    }
  });
});

describe('key configuration', () => {
  it('accepts base64, base64url and hex, as long as it decodes to 32 bytes', () => {
    const raw = Buffer.alloc(32, 7);
    for (const encoded of [
      raw.toString('base64'),
      raw.toString('base64url'),
      raw.toString('hex'),
    ]) {
      expect(ring('k1', { k1: encoded }).current.material.length).toBe(32);
    }
  });

  it.each([
    ['31 bytes', Buffer.alloc(31, 1).toString('base64')],
    ['33 bytes', Buffer.alloc(33, 1).toString('base64')],
    ['a 32-character passphrase', 'correct-horse-battery-staple-123'],
    ['empty', ''],
  ])('refuses a key that is not 32 decoded bytes: %s', (_name, value) => {
    // The length of the *decoded* key is what matters. A 32-character string is not a 256-bit key.
    expect(() => ring('k1', { k1: value })).toThrow(SessionKeyConfigError);
  });

  it('refuses half a configuration', () => {
    expect(() =>
      loadKeyRing({ SESSION_ENCRYPTION_KEYS: `k1:${KEY_A}` } as NodeJS.ProcessEnv, {
        required: true,
      }),
    ).toThrow(/CURRENT_KEY_ID/);
    expect(() =>
      loadKeyRing({ SESSION_ENCRYPTION_CURRENT_KEY_ID: 'k1' } as NodeJS.ProcessEnv, {
        required: true,
      }),
    ).toThrow(/SESSION_ENCRYPTION_KEYS/);
  });

  it('refuses a current key id that is not in the ring', () => {
    expect(() => ring('k2', { k1: KEY_A })).toThrow(/not one of the ids/);
  });

  it('refuses a duplicate key id', () => {
    expect(() =>
      loadKeyRing(
        {
          SESSION_ENCRYPTION_KEYS: `k1:${KEY_A},k1:${KEY_B}`,
          SESSION_ENCRYPTION_CURRENT_KEY_ID: 'k1',
        } as NodeJS.ProcessEnv,
        { required: true },
      ),
    ).toThrow(/listed twice/);
  });

  it('refuses an unusable key id', () => {
    expect(() => ring('K 1', { 'K 1': KEY_A })).toThrow(/not usable/);
  });

  it('refuses an entry with no id', () => {
    expect(() =>
      loadKeyRing(
        {
          SESSION_ENCRYPTION_KEYS: KEY_A,
          SESSION_ENCRYPTION_CURRENT_KEY_ID: 'k1',
        } as NodeJS.ProcessEnv,
        { required: true },
      ),
    ).toThrow(/no id/);
  });

  it('throws when required and nothing is set, and returns null when not', () => {
    expect(() => loadKeyRing({} as NodeJS.ProcessEnv, { required: true })).toThrow(
      SessionKeyConfigError,
    );
    expect(loadKeyRing({} as NodeJS.ProcessEnv, { required: false })).toBeNull();
  });

  it('never puts key material in an error message', () => {
    try {
      ring('k1', { k1: Buffer.alloc(31, 1).toString('base64') });
    } catch (error) {
      expect((error as Error).message).not.toContain(Buffer.alloc(31, 1).toString('base64'));
    }
  });
});

describe('rotation', () => {
  it('reads with a previous key and writes with the current one', () => {
    const old = ring('k0', { k0: KEY_A });
    const envelope = encryptToken(TOKEN, old.current);

    // k1 is now current; k0 stays in the ring so existing values keep opening.
    const rotated = ring('k1', { k0: KEY_A, k1: KEY_B });
    const opened = decryptToken(envelope, rotated);
    expect(opened.plaintext).toBe(TOKEN);
    expect(opened.keyId).toBe('k0');

    const rewritten = encryptToken(opened.plaintext, rotated.current);
    expect(rewritten.split('.')[2]).toBe('k1');
    expect(decryptToken(rewritten, rotated).plaintext).toBe(TOKEN);
  });

  it('stops reading a value once its key is retired', () => {
    // The recovery consequence, stated as a test: retire a key before everything encrypted with
    // it has been re-encrypted and those tokens are gone.
    const envelope = encryptToken(TOKEN, ring('k0', { k0: KEY_A }).current);
    expect(() => decryptToken(envelope, ring('k1', { k1: KEY_B }))).toThrow(
      /not in the current key ring/,
    );
  });
});
