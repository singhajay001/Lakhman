import { describe, expect, it } from 'vitest';
import { CATALOGUE, COLLECTIONS, product } from '@spirithaus/testing';
import { assessPromotability, mapCollection, mapProduct, normaliseMoney } from './mapping.js';

describe('mapProduct', () => {
  const first = CATALOGUE[0];
  if (!first) throw new Error('fixture catalogue is empty');

  it('maps the fields a campaign depends on', () => {
    const mapped = mapProduct(first);
    expect(mapped.gid).toBe('gid://shopify/Product/1');
    expect(mapped.handle).toBe('applewood-gin');
    expect(mapped.status).toBe('ACTIVE');
    expect(mapped.publishedAt?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(mapped.featuredImageUrl).toBe('https://cdn.example.invalid/a.jpg');
  });

  it('keeps money as a decimal string', () => {
    const mapped = mapProduct(first);
    expect(mapped.variants[0]?.price).toBe('89.99');
    expect(mapped.variants[0]?.unitCost).toBe('48.5000');
    // Never a float: 19.99 parsed and reprinted is how a price becomes wrong.
    expect(typeof mapped.variants[0]?.price).toBe('string');
  });

  it('carries compare-at price and a null unit cost through unchanged', () => {
    const starward = CATALOGUE.find((p) => p.handle === 'starward-nova');
    if (!starward) throw new Error('fixture missing');
    const mapped = mapProduct(starward);
    expect(mapped.variants[0]?.compareAtPrice).toBe('110.00');
    expect(mapped.variants[0]?.unitCost).toBeNull();
  });

  it('treats an unknown status as DRAFT, because a draft is never promoted', () => {
    const mapped = mapProduct(product({ id: 'x', handle: 'x', status: 'SOMETHING_NEW' }));
    expect(mapped.status).toBe('DRAFT');
  });

  it('normalises blank strings to null rather than storing empty text', () => {
    const mapped = mapProduct(product({ id: 'x', handle: 'x', vendor: '   ', productType: '' }));
    expect(mapped.vendor).toBeNull();
    expect(mapped.productType).toBeNull();
  });

  it('tolerates an absent tag list and an absent image', () => {
    const mapped = mapProduct(
      product({ id: 'x', handle: 'x', tags: null, featuredMedia: null, updatedAt: null }),
    );
    expect(mapped.tags).toEqual([]);
    expect(mapped.featuredImageUrl).toBeNull();
    expect(mapped.shopifyUpdatedAt).toBeNull();
  });

  it('falls back to an ordinal position when Shopify omits one', () => {
    const node = product({ id: 'x', handle: 'x' });
    const variant = node.variants.nodes[0];
    if (!variant) throw new Error('fixture missing variant');
    variant.position = null;
    expect(mapProduct(node).variants[0]?.position).toBe(1);
  });

  it('ignores an unparseable date instead of storing Invalid Date', () => {
    const mapped = mapProduct(product({ id: 'x', handle: 'x', publishedAt: 'not-a-date' }));
    expect(mapped.publishedAt).toBeNull();
  });
});

describe('normaliseMoney', () => {
  it.each(['0', '19.99', '1234.5678', '-5.00'])('accepts %s', (value) => {
    expect(normaliseMoney(value)).toBe(value);
  });

  it('trims surrounding space', () => {
    expect(normaliseMoney(' 19.99 ')).toBe('19.99');
  });

  it.each(['', '19,99', '$19.99', 'NaN', '1e3', '19.99.5'])('refuses %s loudly', (value) => {
    expect(() => normaliseMoney(value)).toThrow(/money value/);
  });
});

describe('mapCollection', () => {
  it('maps membership and count', () => {
    const gin = COLLECTIONS.find((c) => c.handle === 'gin');
    if (!gin) throw new Error('fixture missing');
    const mapped = mapCollection(gin);
    expect(mapped.productCount).toBe(2);
    expect(mapped.productGids).toHaveLength(2);
  });

  it('falls back to the node count when Shopify omits productsCount', () => {
    const mapped = mapCollection({
      id: 'c',
      handle: 'c',
      title: 'C',
      productsCount: null,
      products: { nodes: [{ id: 'p1' }] },
    });
    expect(mapped.productCount).toBe(1);
  });
});

describe('assessPromotability', () => {
  it('passes an active, published, in-stock product', () => {
    expect(
      assessPromotability({
        status: 'ACTIVE',
        onlineStoreUrl: 'https://x/p',
        variants: [{ availableForSale: true, inventoryQuantity: 3 }],
      }),
    ).toEqual({ promotable: true });
  });

  it('refuses a draft, and says why', () => {
    const verdict = assessPromotability({
      status: 'DRAFT',
      onlineStoreUrl: null,
      variants: [{ availableForSale: true, inventoryQuantity: 3 }],
    });
    expect(verdict.promotable).toBe(false);
    if (verdict.promotable) return;
    expect(verdict.reasons).toContain('product status is DRAFT');
    expect(verdict.reasons).toContain('product is not published to the online store');
  });

  it('refuses a product whose only variant is out of stock', () => {
    const verdict = assessPromotability({
      status: 'ACTIVE',
      onlineStoreUrl: 'https://x/p',
      variants: [{ availableForSale: false, inventoryQuantity: 0 }],
    });
    expect(verdict.promotable).toBe(false);
    if (verdict.promotable) return;
    expect(verdict.reasons).toEqual(['no variant is available for sale with stock on hand']);
  });

  it('refuses a variant that is sellable but has no stock behind it', () => {
    const verdict = assessPromotability({
      status: 'ACTIVE',
      onlineStoreUrl: 'https://x/p',
      variants: [{ availableForSale: true, inventoryQuantity: 0 }],
    });
    expect(verdict.promotable).toBe(false);
  });

  it('refuses a product with no variants at all', () => {
    const verdict = assessPromotability({
      status: 'ACTIVE',
      onlineStoreUrl: 'https://x/p',
      variants: [],
    });
    expect(verdict.promotable).toBe(false);
    if (verdict.promotable) return;
    expect(verdict.reasons).toContain('product has no variants');
  });

  it('accepts a multi-variant product when any one variant is sellable', () => {
    expect(
      assessPromotability({
        status: 'ACTIVE',
        onlineStoreUrl: 'https://x/p',
        variants: [
          { availableForSale: false, inventoryQuantity: 0 },
          { availableForSale: true, inventoryQuantity: 1 },
        ],
      }).promotable,
    ).toBe(true);
  });
});
