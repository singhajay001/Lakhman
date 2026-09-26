import { describe, expect, it } from 'vitest';
import { redactForProvider } from './redact.js';

describe('redactForProvider', () => {
  it('strips personal fields and reports what it removed', () => {
    const result = redactForProvider({
      productTitle: 'Applewood Gin',
      customer: { email: 'a@b.com', firstName: 'Ada', postcode: '2000' },
      quantity: 2,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.payload).toEqual({
      productTitle: 'Applewood Gin',
      customer: {},
      quantity: 2,
    });
    expect(result.value.report.removed.sort()).toEqual([
      'customer.email',
      'customer.firstName',
      'customer.postcode',
    ]);
  });

  it('strips credentials wherever they appear', () => {
    const result = redactForProvider({ config: { apiKey: 'sk-live', accessToken: 'shpat_x' } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.payload).toEqual({ config: {} });
  });

  it('is case-insensitive about field names', () => {
    const result = redactForProvider({ Email: 'a@b.com', PHONE: '000' });
    if (!result.ok) throw new Error('expected ok');
    expect(result.value.payload).toEqual({});
  });

  it('walks arrays', () => {
    const result = redactForProvider([{ email: 'a@b.com', sku: 'X' }]);
    if (!result.ok) throw new Error('expected ok');
    expect(result.value.payload).toEqual([{ sku: 'X' }]);
    expect(result.value.report.removed).toEqual(['[0].email']);
  });

  it('passes image bytes through untouched', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const result = redactForProvider({ mask: bytes });
    if (!result.ok) throw new Error('expected ok');
    expect((result.value.payload as { mask: Uint8Array }).mask).toBe(bytes);
  });

  it('fails closed on a class instance', () => {
    class Order {
      constructor(public total = 1) {}
    }
    const result = redactForProvider({ order: new Order() });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('non-plain object');
    expect(result.error).toContain('order');
  });

  it('fails closed on a function', () => {
    const result = redactForProvider({ hook: () => 1 });
    expect(result.ok).toBe(false);
  });

  it('serialises dates rather than refusing them', () => {
    const result = redactForProvider({ at: new Date('2026-01-01T00:00:00Z') });
    if (!result.ok) throw new Error('expected ok');
    expect(result.value.payload).toEqual({ at: '2026-01-01T00:00:00.000Z' });
  });
});
