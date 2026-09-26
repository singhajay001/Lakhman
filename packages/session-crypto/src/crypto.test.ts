import { createCipheriv, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  decryptToken,
  encryptToken,
  ENVELOPE_PREFIX,
  isEncryptedEnvelope,
  SessionDecryptError,
  type CredentialContext,
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

/** Where a credential lives. v2 binds every envelope to exactly this. */
const CTX: CredentialContext = {
  sessionId: 'offline_shop-a.myshopify.com',
  shop: 'shop-a.myshopify.com',
  field: 'accessToken',
};

describe('the envelope', () => {
  const keys = ring('k1', { k1: KEY_A });

  it('round trips', () => {
    const envelope = encryptToken(TOKEN, keys.current, CTX);
    expect(decryptToken(envelope, keys, CTX).plaintext).toBe(TOKEN);
  });

  it('is recognisable without a key, so plaintext never needs guessing', () => {
    // Classifying by attempting decryption would treat real tampering as "probably plaintext".
    expect(isEncryptedEnvelope(encryptToken(TOKEN, keys.current, CTX))).toBe(true);
    expect(isEncryptedEnvelope(TOKEN)).toBe(false);
    expect(isEncryptedEnvelope('')).toBe(false);
  });

  it('carries the version and key id in the clear', () => {
    const parts = encryptToken(TOKEN, keys.current, CTX).split('.');
    expect(parts).toHaveLength(6);
    expect(parts[0]).toBe(ENVELOPE_PREFIX);
    expect(parts[1]).toBe('v2');
    expect(parts[2]).toBe('k1');
  });

  it('never repeats a nonce, so the same token encrypts differently every time', () => {
    // GCM's security collapses entirely if a nonce repeats under one key.
    const envelopes = new Set<string>();
    const nonces = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      const envelope = encryptToken(TOKEN, keys.current, CTX);
      envelopes.add(envelope);
      nonces.add(envelope.split('.')[3] as string);
    }
    expect(envelopes.size).toBe(200);
    expect(nonces.size).toBe(200);
  });

  it('does not leak the token in the envelope', () => {
    expect(encryptToken(TOKEN, keys.current, CTX)).not.toContain('shpat_a_token');
  });

  it('rejects a tampered ciphertext', () => {
    const parts = encryptToken(TOKEN, keys.current, CTX).split('.');
    const ciphertext = Buffer.from(parts[5] as string, 'base64url');
    ciphertext[0] = (ciphertext[0] as number) ^ 0xff;
    parts[5] = ciphertext.toString('base64url');

    expect(() => decryptToken(parts.join('.'), keys, CTX)).toThrow(SessionDecryptError);
    try {
      decryptToken(parts.join('.'), keys, CTX);
    } catch (error) {
      expect((error as SessionDecryptError).reason).toBe('authentication_failed');
    }
  });

  it('rejects a tampered authentication tag', () => {
    const parts = encryptToken(TOKEN, keys.current, CTX).split('.');
    const tag = Buffer.from(parts[4] as string, 'base64url');
    tag[0] = (tag[0] as number) ^ 0xff;
    parts[4] = tag.toString('base64url');
    expect(() => decryptToken(parts.join('.'), keys, CTX)).toThrow(/failed authentication/);
  });

  it('rejects a tampered nonce', () => {
    const parts = encryptToken(TOKEN, keys.current, CTX).split('.');
    const nonce = Buffer.from(parts[3] as string, 'base64url');
    nonce[0] = (nonce[0] as number) ^ 0xff;
    parts[3] = nonce.toString('base64url');
    expect(() => decryptToken(parts.join('.'), keys, CTX)).toThrow(SessionDecryptError);
  });

  it('rejects the wrong key', () => {
    const envelope = encryptToken(TOKEN, keys.current, CTX);
    // Same key id, different material: the id selects, the tag decides.
    const impostor = ring('k1', { k1: KEY_B });
    try {
      decryptToken(envelope, impostor, CTX);
      throw new Error('expected a rejection');
    } catch (error) {
      expect((error as SessionDecryptError).reason).toBe('authentication_failed');
    }
  });

  it('rejects a key id it does not hold', () => {
    const envelope = encryptToken(TOKEN, ring('k9', { k9: KEY_B }).current, CTX);
    try {
      decryptToken(envelope, keys, CTX);
      throw new Error('expected a rejection');
    } catch (error) {
      expect((error as SessionDecryptError).reason).toBe('unknown_key');
    }
  });

  it('rejects an unsupported envelope version', () => {
    const parts = encryptToken(TOKEN, keys.current, CTX).split('.');
    parts[1] = 'v99';
    try {
      decryptToken(parts.join('.'), keys, CTX);
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
    expect(() => decryptToken(value, keys, CTX)).toThrow(SessionDecryptError);
  });

  it('says nothing about the key or the ciphertext when it fails', () => {
    const parts = encryptToken(TOKEN, keys.current, CTX).split('.');
    parts[5] = Buffer.from('nonsense').toString('base64url');
    try {
      decryptToken(parts.join('.'), keys, CTX);
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
    const envelope = encryptToken(TOKEN, old.current, CTX);

    // k1 is now current; k0 stays in the ring so existing values keep opening.
    const rotated = ring('k1', { k0: KEY_A, k1: KEY_B });
    const opened = decryptToken(envelope, rotated, CTX);
    expect(opened.plaintext).toBe(TOKEN);
    expect(opened.keyId).toBe('k0');

    const rewritten = encryptToken(opened.plaintext, rotated.current, CTX);
    expect(rewritten.split('.')[2]).toBe('k1');
    expect(decryptToken(rewritten, rotated, CTX).plaintext).toBe(TOKEN);
  });

  it('stops reading a value once its key is retired', () => {
    // The recovery consequence, stated as a test: retire a key before everything encrypted with
    // it has been re-encrypted and those tokens are gone.
    const envelope = encryptToken(TOKEN, ring('k0', { k0: KEY_A }).current, CTX);
    expect(() => decryptToken(envelope, ring('k1', { k1: KEY_B }), CTX)).toThrow(
      /not in the current key ring/,
    );
  });
});

describe('binding a credential to where it is stored', () => {
  const keys = ring('k1', { k1: KEY_A });
  const envelope = encryptToken(TOKEN, keys.current, CTX);

  const expectRejected = (context: CredentialContext): void => {
    try {
      decryptToken(envelope, keys, context);
      throw new Error('expected the envelope to be rejected');
    } catch (error) {
      expect(error).toBeInstanceOf(SessionDecryptError);
      expect((error as SessionDecryptError).reason).toBe('authentication_failed');
    }
  };

  it('opens in the place it was written', () => {
    expect(decryptToken(envelope, keys, CTX).plaintext).toBe(TOKEN);
  });

  it('rejects ciphertext copied to another session', () => {
    // Without the binding this succeeded: anyone with write access could copy one row's token
    // over another's and the tag still verified, because it only covered the ciphertext.
    expectRejected({ ...CTX, sessionId: 'offline_shop-b.myshopify.com' });
  });

  it('rejects ciphertext copied to another shop', () => {
    // The attack this stops: promote yourself into a different merchant's shop without ever
    // learning a token.
    expectRejected({ ...CTX, shop: 'shop-b.myshopify.com' });
  });

  it('rejects an access token pasted into the refresh token field', () => {
    expectRejected({ ...CTX, field: 'refreshToken' });
  });

  it('rejects a refresh token pasted into the access token field', () => {
    const refresh = encryptToken(TOKEN, keys.current, { ...CTX, field: 'refreshToken' });
    try {
      decryptToken(refresh, keys, CTX);
      throw new Error('expected the envelope to be rejected');
    } catch (error) {
      expect((error as SessionDecryptError).reason).toBe('authentication_failed');
    }
  });

  it('rejects a v2 envelope relabelled as v1 to shed its binding', () => {
    // The version is inside the AAD, so downgrading the label breaks authentication rather than
    // opting out of the check.
    const parts = envelope.split('.');
    parts[1] = 'v1';
    try {
      decryptToken(parts.join('.'), keys, CTX);
      throw new Error('expected the envelope to be rejected');
    } catch (error) {
      expect((error as SessionDecryptError).reason).toBe('authentication_failed');
    }
  });

  it('treats the shop domain case-insensitively, because domains are', () => {
    // A mismatch here would look exactly like tampering, so it is normalised on both sides.
    expect(decryptToken(envelope, keys, { ...CTX, shop: 'SHOP-A.MyShopify.com' }).plaintext).toBe(
      TOKEN,
    );
  });

  it('cannot be fooled by a separator inside the shop domain', () => {
    // A naive "a|b|c" join would let (sessionId "x", shop "y|accessToken") collide with a
    // different pair. JSON escapes its own separators, so these stay distinct.
    const odd = encryptToken(TOKEN, keys.current, {
      sessionId: 'a',
      shop: 'b","c',
      field: 'accessToken',
    });
    try {
      decryptToken(odd, keys, { sessionId: 'a","b', shop: 'c', field: 'accessToken' });
      throw new Error('expected the envelope to be rejected');
    } catch (error) {
      expect((error as SessionDecryptError).reason).toBe('authentication_failed');
    }
  });
});

describe('v1 envelopes, which predate the binding', () => {
  const keys = ring('k1', { k1: KEY_A });

  /** A v1 value: same construction, no AAD. Written by hand because nothing produces them now. */
  function legacyV1(plaintext: string): string {
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', keys.current.material, nonce);
    const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return [
      'shpenc',
      'v1',
      keys.current.id,
      nonce.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      body.toString('base64url'),
    ].join('.');
  }

  it('still opens, and reports its version so it can be upgraded', () => {
    const opened = decryptToken(legacyV1(TOKEN), keys, CTX);
    expect(opened.plaintext).toBe(TOKEN);
    expect(opened.version).toBe('v1');
  });

  it('opens regardless of context, which is exactly why it is replaced', () => {
    // Stated as a test rather than a footnote: a v1 value carries no binding and can be moved
    // freely. Being able to read it is what makes rewriting it as v2 possible.
    expect(
      decryptToken(legacyV1(TOKEN), keys, { ...CTX, shop: 'somewhere-else.myshopify.com' })
        .plaintext,
    ).toBe(TOKEN);
  });

  it('is written as v2 once re-encrypted', () => {
    const opened = decryptToken(legacyV1(TOKEN), keys, CTX);
    const rewritten = encryptToken(opened.plaintext, keys.current, CTX);
    expect(rewritten.split('.')[1]).toBe('v2');
    expect(decryptToken(rewritten, keys, CTX).version).toBe('v2');
  });
});
