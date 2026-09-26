import { describe, expect, it } from 'vitest';
import {
  idempotencyKey,
  publicationIdempotencyKey,
  syncIdempotencyKey,
  webhookIdempotencyKey,
} from './idempotency.js';

describe('idempotencyKey', () => {
  it('is deterministic', () => {
    expect(idempotencyKey({ a: '1', b: 2 })).toBe(idempotencyKey({ a: '1', b: 2 }));
  });

  it('does not depend on property order', () => {
    // A key that changes when someone reorders an object literal is a key that
    // stops working after a refactor and duplicates a published post.
    expect(idempotencyKey({ a: '1', b: '2' })).toBe(idempotencyKey({ b: '2', a: '1' }));
  });

  it('changes when any value changes', () => {
    expect(idempotencyKey({ a: '1' })).not.toBe(idempotencyKey({ a: '2' }));
  });

  it('treats null, undefined and empty string as absent', () => {
    const base = idempotencyKey({ a: '1' });
    expect(idempotencyKey({ a: '1', b: null })).toBe(base);
    expect(idempotencyKey({ a: '1', b: undefined })).toBe(base);
    expect(idempotencyKey({ a: '1', b: '' })).toBe(base);
  });

  it('does not collide across field boundaries', () => {
    // "ab" + "c" must not hash the same as "a" + "bc".
    expect(idempotencyKey({ x: 'ab', y: 'c' })).not.toBe(idempotencyKey({ x: 'a', y: 'bc' }));
  });

  it('returns a hex sha256', () => {
    expect(idempotencyKey({ a: '1' })).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('publicationIdempotencyKey', () => {
  const base = {
    campaignId: 'c1',
    contentVariantId: 'v1',
    destinationId: 'instagram:acct1',
    approvalVersionId: 'a1',
  };

  it('is the same for a retry of the same approved version', () => {
    expect(publicationIdempotencyKey(base)).toBe(publicationIdempotencyKey({ ...base }));
  });

  it('differs per destination, so one campaign action fans out to distinct jobs', () => {
    const keys = ['facebook:a', 'instagram:a', 'x:a', 'tiktok:a', 'youtube:a', 'pinterest:a'].map(
      (destinationId) => publicationIdempotencyKey({ ...base, destinationId }),
    );
    expect(new Set(keys).size).toBe(6);
  });

  it('changes when approval is re-granted, so an edited campaign is a new job', () => {
    expect(publicationIdempotencyKey({ ...base, approvalVersionId: 'a2' })).not.toBe(
      publicationIdempotencyKey(base),
    );
  });

  it('is namespaced away from the other key kinds', () => {
    expect(publicationIdempotencyKey(base)).not.toBe(
      idempotencyKey({ ...base, kind: 'something-else' }),
    );
  });
});

describe('webhookIdempotencyKey', () => {
  it('is stable across a redelivery of the same event', () => {
    const input = { shopDomain: 's.myshopify.com', topic: 'products/update', shopifyEventId: 'e1' };
    expect(webhookIdempotencyKey(input)).toBe(webhookIdempotencyKey({ ...input }));
  });

  it('separates the same event id on different topics', () => {
    expect(
      webhookIdempotencyKey({ shopDomain: 's', topic: 'products/update', shopifyEventId: 'e1' }),
    ).not.toBe(
      webhookIdempotencyKey({ shopDomain: 's', topic: 'products/delete', shopifyEventId: 'e1' }),
    );
  });

  it('separates shops', () => {
    expect(webhookIdempotencyKey({ shopDomain: 'a', topic: 't', shopifyEventId: 'e' })).not.toBe(
      webhookIdempotencyKey({ shopDomain: 'b', topic: 't', shopifyEventId: 'e' }),
    );
  });
});

describe('syncIdempotencyKey', () => {
  it('collapses two triggers inside the same window', () => {
    const a = syncIdempotencyKey({
      shopId: 's',
      kind: 'PRODUCTS',
      windowStart: '2026-09-26T03:00',
    });
    const b = syncIdempotencyKey({
      shopId: 's',
      kind: 'PRODUCTS',
      windowStart: '2026-09-26T03:00',
    });
    expect(a).toBe(b);
  });

  it('separates windows', () => {
    expect(
      syncIdempotencyKey({ shopId: 's', kind: 'PRODUCTS', windowStart: '2026-09-26T03:00' }),
    ).not.toBe(
      syncIdempotencyKey({ shopId: 's', kind: 'PRODUCTS', windowStart: '2026-09-26T04:00' }),
    );
  });
});
