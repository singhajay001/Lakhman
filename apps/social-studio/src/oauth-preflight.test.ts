import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { preflightBody, preflightCallback } from '../app/lib/oauth-preflight.server.js';

const SECRET = 'shpss_test_secret_value';

const CONFIGURED = {
  SHOPIFY_API_KEY: 'key',
  SHOPIFY_API_SECRET: SECRET,
  SHOPIFY_APP_URL: 'https://studio.example',
} as NodeJS.ProcessEnv;

/** A callback URL signed the way Shopify signs one. */
function signedCallback(overrides: Record<string, string> = {}, secret = SECRET): URL {
  const params = new URLSearchParams({
    code: 'abc123',
    shop: 'spirithaus-dev.myshopify.com',
    state: 'nonce',
    timestamp: '1790400000',
    ...overrides,
  });
  const pairs = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`);
  params.set('hmac', createHmac('sha256', secret).update(pairs.join('&'), 'utf8').digest('hex'));
  return new URL(`https://studio.example/auth/shopify/callback?${params.toString()}`);
}

describe('the callback preflight', () => {
  it('passes a correctly signed callback', () => {
    expect(preflightCallback(signedCallback(), CONFIGURED)).toEqual({ ok: true });
  });

  it('reports missing configuration before anything else', () => {
    // Checked first, so a signature mismatch is never reported for an app that has no secret
    // to check against.
    const result = preflightCallback(signedCallback(), {
      SHOPIFY_API_KEY: 'key',
    } as NodeJS.ProcessEnv);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('missing_configuration');
    expect(result.failure.summary).toContain('SHOPIFY_API_SECRET');
    expect(result.failure.remedy.join(' ')).toContain('/auth/shopify/callback');
  });

  it('treats a browser hitting the URL directly as a malformed request, not a bad signature', () => {
    const result = preflightCallback(
      new URL('https://studio.example/auth/shopify/callback'),
      CONFIGURED,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('missing_parameters');
  });

  it('rejects a shop parameter that is not a myshopify domain', () => {
    const url = signedCallback({ shop: 'evil.example.com' });
    const result = preflightCallback(url, CONFIGURED);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('invalid_shop_domain');
  });

  it('reports a signature mismatch when the secret belongs to another app', () => {
    const result = preflightCallback(signedCallback({}, 'a-different-apps-secret'), CONFIGURED);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('signature_mismatch');
    expect(result.failure.remedy.join(' ')).toContain('different app');
  });

  it('rejects a callback whose parameters were edited after signing', () => {
    const url = signedCallback();
    url.searchParams.set('shop', 'someone-elses-shop.myshopify.com');
    const result = preflightCallback(url, CONFIGURED);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('signature_mismatch');
  });
});

describe('what the response is allowed to say', () => {
  const failure = (() => {
    const result = preflightCallback(signedCallback(), {
      SHOPIFY_API_KEY: 'key',
    } as NodeJS.ProcessEnv);
    if (result.ok) throw new Error('expected a failure to inspect');
    return result.failure;
  })();

  it('never echoes the secret, in any environment', () => {
    for (const nodeEnv of ['development', 'production']) {
      const body = JSON.stringify(preflightBody(failure, nodeEnv));
      expect(body).not.toContain(SECRET);
    }
  });

  it('gives developers the remedy outside production', () => {
    const body = preflightBody(failure, 'development');
    expect(body.remedy).toBeDefined();
    expect(String(body.message)).toContain('SHOPIFY_API_SECRET');
  });

  it('withholds the remedy in production', () => {
    // A public endpoint that lists which environment variables are unset is reconnaissance.
    const body = preflightBody(failure, 'production');
    expect(body.remedy).toBeUndefined();
    expect(String(body.detail)).toContain('withheld in production');
  });
});
