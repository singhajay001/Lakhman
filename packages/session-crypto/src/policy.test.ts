import { describe, expect, it } from 'vitest';
import { resolveSessionCryptoPolicy } from './policy.js';
import { SessionKeyConfigError } from './keys.js';

const KEY = Buffer.alloc(32, 0xa1).toString('base64');
const configured = {
  SESSION_ENCRYPTION_KEYS: `k1:${KEY}`,
  SESSION_ENCRYPTION_CURRENT_KEY_ID: 'k1',
};

const policy = (env: Record<string, string>) =>
  resolveSessionCryptoPolicy({ env: env as NodeJS.ProcessEnv, component: 'test' });

describe('failing closed in a deployed environment', () => {
  it.each(['production', 'staging', 'preview', 'anything-else'])(
    'refuses to start with no key when NODE_ENV=%s',
    (nodeEnv) => {
      // Anything that is not plainly a developer machine must have a key. A misconfiguration
      // found on the first OAuth callback is a token already written in plaintext.
      expect(() => policy({ NODE_ENV: nodeEnv })).toThrow(SessionKeyConfigError);
    },
  );

  it.each([
    [
      'an undecodable key',
      { SESSION_ENCRYPTION_KEYS: 'k1:!!!not-base64!!!', SESSION_ENCRYPTION_CURRENT_KEY_ID: 'k1' },
    ],
    [
      'a short key',
      {
        SESSION_ENCRYPTION_KEYS: `k1:${Buffer.alloc(16).toString('base64')}`,
        SESSION_ENCRYPTION_CURRENT_KEY_ID: 'k1',
      },
    ],
    [
      'an unknown current id',
      { SESSION_ENCRYPTION_KEYS: `k1:${KEY}`, SESSION_ENCRYPTION_CURRENT_KEY_ID: 'k2' },
    ],
    ['keys without a current id', { SESSION_ENCRYPTION_KEYS: `k1:${KEY}` }],
    ['a current id without keys', { SESSION_ENCRYPTION_CURRENT_KEY_ID: 'k1' }],
  ])('refuses to start in production with %s', (_name, env) => {
    expect(() => policy({ NODE_ENV: 'production', ...env })).toThrow(SessionKeyConfigError);
  });

  it('starts when the configuration is valid', () => {
    const resolved = policy({ NODE_ENV: 'production', ...configured });
    expect(resolved.encryptionDisabled).toBe(false);
    expect(resolved.keys?.current.id).toBe('k1');
    expect(resolved.allowPlaintextReads).toBe(false);
  });
});

describe('the plaintext compatibility switch', () => {
  it('is refused outright in a deployed environment, even with valid keys', () => {
    // The removal point for this switch is the moment the migration has run. It exists for a
    // developer machine and nothing else, so a deployed process refuses rather than warning.
    expect(() =>
      policy({
        NODE_ENV: 'production',
        ...configured,
        SESSION_ENCRYPTION_ALLOW_PLAINTEXT_READS: 'true',
      }),
    ).toThrow(/refused in a deployed environment/);
  });

  it('is off unless explicitly enabled', () => {
    expect(policy({ NODE_ENV: 'development', ...configured }).allowPlaintextReads).toBe(false);
  });

  it('is available in development when asked for', () => {
    const resolved = policy({
      NODE_ENV: 'development',
      ...configured,
      SESSION_ENCRYPTION_ALLOW_PLAINTEXT_READS: 'true',
    });
    expect(resolved.allowPlaintextReads).toBe(true);
    expect(resolved.encryptionDisabled).toBe(false);
  });

  it('is not turned on by a value that merely looks truthy', () => {
    for (const value of ['1', 'yes', 'TRUE ', 'on']) {
      const resolved = policy({
        NODE_ENV: 'development',
        ...configured,
        SESSION_ENCRYPTION_ALLOW_PLAINTEXT_READS: value,
      });
      expect(resolved.allowPlaintextReads).toBe(value.trim().toLowerCase() === 'true');
    }
  });
});

describe('an unconfigured developer machine', () => {
  it('runs without encryption and says so', () => {
    const resolved = policy({ NODE_ENV: 'development' });
    expect(resolved.encryptionDisabled).toBe(true);
    expect(resolved.keys).toBeNull();
    // Plaintext is readable here because nothing has been encrypted.
    expect(resolved.allowPlaintextReads).toBe(true);
  });

  it('treats a test run the same way', () => {
    expect(policy({ NODE_ENV: 'test' }).encryptionDisabled).toBe(true);
  });

  it('still refuses a broken key when one is given', () => {
    // Being undeployed excuses having no key. It does not excuse having a wrong one.
    expect(() =>
      policy({
        NODE_ENV: 'development',
        SESSION_ENCRYPTION_KEYS: 'k1:short',
        SESSION_ENCRYPTION_CURRENT_KEY_ID: 'k1',
      }),
    ).toThrow(SessionKeyConfigError);
  });
});
