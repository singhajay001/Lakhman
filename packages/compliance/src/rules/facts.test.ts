import { describe, expect, it } from 'vitest';
import { buildFactSheet, type ClaimInput, type ProductTruth } from '@spirithaus/domain';
import { runCompliance } from '../engine.js';
import type { ComplianceInput } from '../types.js';

const product = (over: Partial<ProductTruth> = {}): ProductTruth => ({
  productId: 'p1',
  title: 'Starward Nova',
  vendor: 'Starward',
  productType: 'Whisky',
  handle: 'starward-nova',
  onlineStoreUrl: 'https://spirithaus.com.au/products/starward-nova',
  prices: ['94.00'],
  compareAtPrices: ['110.00'],
  availableForSale: true,
  inventoryQuantity: 4,
  ...over,
});

const approved = (field: string, value: string): ClaimInput => ({
  field,
  value,
  kind: 'VERIFIED',
  status: 'APPROVED',
  confidence: 0.95,
  sourceUrl: 'https://starward.com.au/nova',
});

const pending = (field: string, value: string): ClaimInput => ({
  ...approved(field, value),
  status: 'PENDING',
});

const check = (
  copy: string,
  claims: ClaimInput[] = [],
  products: ProductTruth[] = [product()],
): { codes: string[]; report: ReturnType<typeof runCompliance> } => {
  const input: ComplianceInput = {
    platform: 'FACEBOOK',
    fields: [{ name: 'primaryCopy', value: copy }],
    hashtags: [],
    factSheet: buildFactSheet({ products, claims, now: new Date('2026-09-26T00:00:00Z') }),
    components: [],
    paid: false,
    brand: {
      prohibitedPhrases: [],
      approvedBrandVariations: [],
      responsibleConsumptionLine: 'Enjoy SPIRITHAUS responsibly.',
    },
  };
  const report = runCompliance(input);
  return { codes: report.findings.filter((f) => f.outcome === 'FAIL').map((f) => f.code), report };
};

describe('ABV', () => {
  it('blocks a figure with no approved claim', () => {
    expect(check('Bottled at 41% ABV.').codes).toContain('FACT-ABV');
  });

  it('passes the approved figure', () => {
    expect(check('Bottled at 41% ABV.', [approved('abv', '41')]).codes).not.toContain('FACT-ABV');
  });

  it('blocks a figure that is close but not the approved one', () => {
    expect(check('Bottled at 42% ABV.', [approved('abv', '41')]).codes).toContain('FACT-ABV');
  });

  it('treats 41, 41.0 and "41.0 %" as the same value', () => {
    expect(check('41.0 % alc.', [approved('abv', '41')]).codes).not.toContain('FACT-ABV');
    expect(check('ABV: 41%', [approved('abv', '41.0')]).codes).not.toContain('FACT-ABV');
  });

  it('is not satisfied by a pending claim — pending is not a weaker fact, it is not a fact', () => {
    expect(check('Bottled at 41% ABV.', [pending('abv', '41')]).codes).toContain('FACT-ABV');
  });

  it('names the figure it refused in the evidence', () => {
    const { report } = check('Bottled at 41% ABV.');
    const finding = report.blocking.find((f) => f.code === 'FACT-ABV');
    expect(finding?.evidence[0]?.match).toContain('41');
    expect(finding?.evidence[0]?.field).toBe('primaryCopy');
  });
});

describe('age statements', () => {
  it('blocks an unapproved age', () => {
    expect(check('A 12 year old single malt.').codes).toContain('FACT-AGE');
    expect(check('Aged for 12 years in oak.').codes).toContain('FACT-AGE');
  });

  it('passes the approved age', () => {
    expect(
      check('A 12 year old single malt.', [approved('age_statement', '12')]).codes,
    ).not.toContain('FACT-AGE');
  });
});

describe('awards and ratings', () => {
  it('blocks award language with no approved award', () => {
    expect(check('Our award-winning whisky took double gold.').codes).toContain('FACT-AWARD');
  });

  it('permits award language once any award claim is approved', () => {
    expect(
      check('Our award-winning whisky.', [approved('award', 'Gold, Melbourne Spirits 2025')]).codes,
    ).not.toContain('FACT-AWARD');
  });

  it('blocks a critic score with no approved rating', () => {
    expect(check('Scored 94 points.').codes).toContain('FACT-RATING');
    expect(check('A solid 4.5/5.').codes).toContain('FACT-RATING');
  });

  it('passes the approved score', () => {
    expect(check('Scored 94 points.', [approved('rating', '94')]).codes).not.toContain(
      'FACT-RATING',
    );
  });
});

describe('vintages', () => {
  it('blocks an unapproved vintage', () => {
    expect(check('The vintage 2019 release.').codes).toContain('FACT-VINTAGE');
  });

  it('does not fire on a year that is not a vintage claim', () => {
    // "Distilling since 1863" is history, not a vintage statement.
    expect(check('Distilling since 1863 in the Adelaide Hills.').codes).not.toContain(
      'FACT-VINTAGE',
    );
  });
});

describe('price', () => {
  it('blocks a price the store does not charge', () => {
    expect(check('Yours for $79.').codes).toContain('FACT-PRICE');
  });

  it('passes the actual price', () => {
    expect(check('Yours for $94.00.').codes).not.toContain('FACT-PRICE');
  });

  it('accepts the compare-at price, which is also a price the store shows', () => {
    expect(check('Was $110.00, now $94.00.').codes).not.toContain('FACT-PRICE');
  });

  it('treats $94 and $94.00 as the same price', () => {
    expect(check('Yours for $94.').codes).not.toContain('FACT-PRICE');
  });
});

describe('availability', () => {
  it('blocks "in stock" when nothing is available', () => {
    const out = check(
      'In stock now — order now.',
      [],
      [product({ availableForSale: false, inventoryQuantity: 0 })],
    );
    expect(out.codes).toContain('FACT-STOCK');
  });

  it('blocks it when a variant is sellable but has no stock behind it', () => {
    const out = check(
      'Available now.',
      [],
      [product({ availableForSale: true, inventoryQuantity: 0 })],
    );
    expect(out.codes).toContain('FACT-STOCK');
  });

  it('passes when stock exists', () => {
    expect(check('In stock now.').codes).not.toContain('FACT-STOCK');
  });
});

describe('offers and competitions', () => {
  it('blocks a saving claim with no recorded terms', () => {
    expect(check('Save 20% off this week.').codes).toContain('ACL-TERMS-1');
  });

  it('passes once terms are recorded', () => {
    const input: ComplianceInput = {
      platform: 'FACEBOOK',
      fields: [{ name: 'primaryCopy', value: 'Save 20% this week.' }],
      hashtags: [],
      factSheet: buildFactSheet({ products: [product()], claims: [] }),
      components: [],
      paid: false,
      offerTerms: '20% off Australian whisky, 1–7 October 2026, excludes gift sets.',
      brand: {
        prohibitedPhrases: [],
        approvedBrandVariations: [],
        responsibleConsumptionLine: null,
      },
    };
    const report = runCompliance(input);
    expect(report.findings.find((f) => f.code === 'ACL-TERMS-1')?.outcome).toBe('PASS');
  });

  it('blocks a giveaway without a competition approval', () => {
    expect(check('Tag a friend to win a bottle.').codes).toContain('ACL-TERMS-2');
  });
});

describe('the fact guard is a guard, not a proof', () => {
  it('does not catch an invented tasting note, and the docs say so', () => {
    // A fabricated flavour claim passes every pattern here. Only the approved-facts
    // prompt and a human reader stand between it and publication, which is why the
    // rule documentation says this is a guard over high-risk claim types.
    const out = check('Notes of Tasmanian truffle and sea urchin.');
    expect(out.codes.filter((code) => code.startsWith('FACT-'))).toEqual([]);
  });
});
