import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyQueryHmac, verifyWebhookHmac } from './hmac.js';

const SECRET = 'shpss_test_secret';
const sign = (body: string) => createHmac('sha256', SECRET).update(body, 'utf8').digest('base64');

describe('verifyWebhookHmac', () => {
  const body = JSON.stringify({ id: 1, title: 'Applewood Gin' });

  it('accepts a correct signature', () => {
    expect(verifyWebhookHmac(body, sign(body), SECRET)).toBe(true);
  });

  it('rejects a body that changed by one character', () => {
    expect(verifyWebhookHmac(body.replace('Gin', 'Rum'), sign(body), SECRET)).toBe(false);
  });

  it('rejects a signature made with a different secret', () => {
    const other = createHmac('sha256', 'wrong').update(body).digest('base64');
    expect(verifyWebhookHmac(body, other, SECRET)).toBe(false);
  });

  it('rejects a missing or empty header', () => {
    expect(verifyWebhookHmac(body, null, SECRET)).toBe(false);
    expect(verifyWebhookHmac(body, undefined, SECRET)).toBe(false);
    expect(verifyWebhookHmac(body, '', SECRET)).toBe(false);
  });

  it('rejects when no secret is configured, rather than accepting everything', () => {
    expect(verifyWebhookHmac(body, sign(body), '')).toBe(false);
  });

  it('rejects a signature of the wrong length without throwing', () => {
    expect(verifyWebhookHmac(body, 'AAAA', SECRET)).toBe(false);
  });

  it('verifies bytes, so a body that does not round-trip through JSON still passes', () => {
    // Shopify sends "19.99" and "1.0"; re-serialising changes the bytes. Verifying
    // the raw body is the only thing that works.
    const raw = '{"price":"19.99","weight":1.0,"emoji":"\\ud83e\\udd43"}';
    expect(verifyWebhookHmac(raw, sign(raw), SECRET)).toBe(true);
    expect(verifyWebhookHmac(JSON.stringify(JSON.parse(raw)), sign(raw), SECRET)).toBe(false);
  });

  it('accepts a Uint8Array body', () => {
    const bytes = new TextEncoder().encode(body);
    expect(verifyWebhookHmac(bytes, sign(body), SECRET)).toBe(true);
  });
});

describe('verifyQueryHmac', () => {
  const build = (params: Record<string, string>) => {
    const query = new URLSearchParams(params);
    const pairs = [...query.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    query.set('hmac', createHmac('sha256', SECRET).update(pairs, 'utf8').digest('hex'));
    return query;
  };

  it('accepts a correct OAuth callback', () => {
    expect(
      verifyQueryHmac(build({ shop: 's.myshopify.com', code: 'abc', state: 'xyz' }), SECRET),
    ).toBe(true);
  });

  it('rejects a tampered parameter', () => {
    const query = build({ shop: 's.myshopify.com', code: 'abc' });
    query.set('code', 'def');
    expect(verifyQueryHmac(query, SECRET)).toBe(false);
  });

  it('rejects a missing hmac', () => {
    expect(verifyQueryHmac(new URLSearchParams({ shop: 's.myshopify.com' }), SECRET)).toBe(false);
  });

  it('does not depend on the order parameters arrived in', () => {
    const signed = build({ shop: 's.myshopify.com', code: 'abc', state: 'xyz' });
    const reordered = new URLSearchParams();
    reordered.set('state', 'xyz');
    reordered.set('hmac', signed.get('hmac') as string);
    reordered.set('code', 'abc');
    reordered.set('shop', 's.myshopify.com');
    expect(verifyQueryHmac(reordered, SECRET)).toBe(true);
  });
});
