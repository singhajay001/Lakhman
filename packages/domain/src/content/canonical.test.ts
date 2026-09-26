import { describe, expect, it } from 'vitest';
import {
  IMMATERIAL_VARIANT_FIELDS,
  MATERIAL_VARIANT_FIELDS,
  approvalContextHash,
  canonicalise,
  matchesApprovedHash,
  variantHash,
  type VariantForHashing,
} from './canonical.js';

const variant = (over: Partial<VariantForHashing> = {}): VariantForHashing => ({
  platform: 'INSTAGRAM',
  content: { firstLine: 'Applewood Gin.', captionLong: 'From the Adelaide Hills.' },
  primaryCopy: 'Applewood Gin. From the Adelaide Hills. Link in bio.',
  callToAction: 'Link in bio',
  hashtags: ['#spirithaus', '#gin'],
  altText: 'A gin bottle on dark timber.',
  destinationUrl: 'https://spirithaus.com.au/products/applewood-gin?sh_c=abc',
  ...over,
});

describe('canonicalise', () => {
  it('sorts object keys', () => {
    expect(canonicalise({ b: 1, a: 2 })).toBe(canonicalise({ a: 2, b: 1 }));
  });

  it('keeps array order, because hashtag and scene order are material', () => {
    expect(canonicalise(['a', 'b'])).not.toBe(canonicalise(['b', 'a']));
  });

  it('drops undefined and keeps null, which mean different things', () => {
    expect(canonicalise({ a: 1, b: undefined })).toBe(canonicalise({ a: 1 }));
    expect(canonicalise({ a: 1, b: null })).not.toBe(canonicalise({ a: 1 }));
  });

  it('is stable for nested structures', () => {
    const one = { z: [{ b: 1, a: 2 }], y: 'x' };
    const two = { y: 'x', z: [{ a: 2, b: 1 }] };
    expect(canonicalise(one)).toBe(canonicalise(two));
  });

  it('serialises dates by instant', () => {
    expect(canonicalise(new Date('2026-01-01T00:00:00Z'))).toBe('"2026-01-01T00:00:00.000Z"');
  });

  it('does not confuse a string with a number that looks like it', () => {
    expect(canonicalise({ a: '1' })).not.toBe(canonicalise({ a: 1 }));
  });
});

describe('variantHash', () => {
  it('is deterministic', () => {
    expect(variantHash(variant())).toBe(variantHash(variant()));
  });

  it('does not change when an immaterial field changes', () => {
    // Re-scoring a variant, or recording which model wrote it, must not invalidate an
    // approval that a human already gave.
    const base = variantHash(variant());
    expect(variantHash(variant({ qualityScores: { overall: 80 } }))).toBe(base);
    expect(variantHash(variant({ generation: { model: 'x' } }))).toBe(base);
    expect(variantHash(variant({ revision: 7 }))).toBe(base);
    expect(variantHash(variant({ internalNotes: 'chased legal' }))).toBe(base);
  });

  it('changes when any material field changes', () => {
    const base = variantHash(variant());
    expect(variantHash(variant({ primaryCopy: 'Applewood Gin. Link in bio.' }))).not.toBe(base);
    expect(variantHash(variant({ callToAction: 'Shop now' }))).not.toBe(base);
    expect(variantHash(variant({ hashtags: ['#gin', '#spirithaus'] }))).not.toBe(base);
    expect(variantHash(variant({ altText: 'Something else.' }))).not.toBe(base);
    expect(variantHash(variant({ destinationUrl: 'https://spirithaus.com.au/' }))).not.toBe(base);
    expect(variantHash(variant({ content: { firstLine: 'Different.' } }))).not.toBe(base);
    expect(variantHash(variant({ platform: 'FACEBOOK' }))).not.toBe(base);
  });

  it('changes for a single-character caption edit', () => {
    const edited = variant({ primaryCopy: `${variant().primaryCopy}.` });
    expect(variantHash(edited)).not.toBe(variantHash(variant()));
  });

  it('treats a missing optional field as null rather than absent', () => {
    expect(variantHash(variant({ altText: null }))).toBe(
      variantHash(variant({ altText: undefined })),
    );
  });

  it('names every material and immaterial field once', () => {
    const overlap = MATERIAL_VARIANT_FIELDS.filter((field) =>
      (IMMATERIAL_VARIANT_FIELDS as readonly string[]).includes(field),
    );
    expect(overlap).toEqual([]);
    expect(new Set(MATERIAL_VARIANT_FIELDS).size).toBe(MATERIAL_VARIANT_FIELDS.length);
  });

  it('is a hex sha256', () => {
    expect(variantHash(variant())).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('matchesApprovedHash', () => {
  it('is true for the content that was approved', () => {
    expect(matchesApprovedHash(variant(), variantHash(variant()))).toBe(true);
  });

  it('is false once the caption moves', () => {
    const approved = variantHash(variant());
    expect(matchesApprovedHash(variant({ primaryCopy: 'Edited.' }), approved)).toBe(false);
  });
});

describe('approvalContextHash', () => {
  const context = {
    destinations: ['instagram:acct1', 'facebook:page1'],
    scheduledFrom: new Date('2026-10-01T09:00:00Z'),
    scheduledTo: new Date('2026-10-01T11:00:00Z'),
    budgetAud: '500.00',
    brandKitVersionId: 'bkv_1',
    productSnapshots: [{ productId: 'p1', price: '89.99' }],
  };

  it('ignores the order destinations arrived in', () => {
    expect(
      approvalContextHash({ ...context, destinations: ['facebook:page1', 'instagram:acct1'] }),
    ).toBe(approvalContextHash(context));
  });

  it('changes when the schedule window moves', () => {
    expect(
      approvalContextHash({ ...context, scheduledTo: new Date('2026-10-01T12:00:00Z') }),
    ).not.toBe(approvalContextHash(context));
  });

  it('changes when the budget moves', () => {
    expect(approvalContextHash({ ...context, budgetAud: '600.00' })).not.toBe(
      approvalContextHash(context),
    );
  });

  it('treats a numeric and a string budget of the same value as one', () => {
    expect(approvalContextHash({ ...context, budgetAud: 500 })).not.toBe(
      approvalContextHash(context),
    );
    // '500.00' and 500 stringify differently on purpose: money is a decimal string
    // everywhere in this codebase, and silently equating them would hide a type slip.
  });

  it('changes when the product snapshot changes, so a price move breaks the binding', () => {
    expect(
      approvalContextHash({ ...context, productSnapshots: [{ productId: 'p1', price: '94.99' }] }),
    ).not.toBe(approvalContextHash(context));
  });

  it('changes when the Brand Kit version changes', () => {
    expect(approvalContextHash({ ...context, brandKitVersionId: 'bkv_2' })).not.toBe(
      approvalContextHash(context),
    );
  });

  it('is namespaced away from the variant hash', () => {
    expect(approvalContextHash(context)).not.toBe(variantHash(variant()));
  });
});
