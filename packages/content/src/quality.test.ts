import { describe, expect, it } from 'vitest';
import { buildFactSheet, type ClaimInput, type ProductTruth } from '@spirithaus/domain';
import { runCompliance, type ComplianceInput } from '@spirithaus/compliance';
import { QUALITY_DIMENSIONS, assessQuality } from './quality.js';

const product: ProductTruth = {
  productId: 'p1',
  title: 'Applewood Gin',
  vendor: 'Applewood Distillery',
  productType: 'Gin',
  handle: 'applewood-gin',
  onlineStoreUrl: 'https://spirithaus.com.au/products/applewood-gin',
  prices: ['89.99'],
  compareAtPrices: [],
  availableForSale: true,
  inventoryQuantity: 12,
};

const brand = {
  prohibitedPhrases: [],
  approvedBrandVariations: [],
  responsibleConsumptionLine: 'Enjoy SPIRITHAUS responsibly.',
};

const sheet = (claims: ClaimInput[] = []) =>
  buildFactSheet({ products: [product], claims, now: new Date('2026-09-26T00:00:00Z') });

const compliance = (copy: string, over: Partial<ComplianceInput> = {}) =>
  runCompliance({
    platform: 'INSTAGRAM',
    fields: [{ name: 'primaryCopy', value: copy }],
    hashtags: [],
    factSheet: sheet(),
    components: [],
    paid: false,
    brand,
    ...over,
  });

const assess = (copy: string, over: Partial<Parameters<typeof assessQuality>[0]> = {}) =>
  assessQuality({
    platform: 'INSTAGRAM',
    primaryCopy: copy,
    hashtags: ['#spirithaus'],
    altText: 'Applewood Gin on dark timber, lit from one side, with a glass alongside.',
    components: ['firstLine', 'captionShort', 'captionMedium', 'captionLong', 'altText'],
    keywordCluster: ['applewood gin', 'gin'],
    factSheet: sheet(),
    compliance: compliance(copy),
    ...over,
  });

const good =
  'Applewood Gin, distilled in the Adelaide Hills. Serve it long with tonic and grapefruit peel. Order at spirithaus.com.au. Enjoy SPIRITHAUS responsibly.';

const scoreOf = (copy: string, dimension: string, over = {}) =>
  assess(copy, over).dimensions.find((d) => d.dimension === dimension);

describe('the assessment', () => {
  it('reports every dimension', () => {
    expect(assess(good).dimensions.map((d) => d.dimension)).toEqual([...QUALITY_DIMENSIONS]);
  });

  it('gives every dimension a reason', () => {
    for (const dimension of assess(good).dimensions) {
      expect(dimension.reason.length, dimension.dimension).toBeGreaterThan(15);
    }
  });

  it('carries a caveat saying it predicts nothing', () => {
    expect(assess(good).caveat).toContain('not a prediction');
  });

  it('scores 0–100 and nothing outside it', () => {
    for (const dimension of assess(good).dimensions) {
      expect(dimension.score).toBeGreaterThanOrEqual(0);
      expect(dimension.score).toBeLessThanOrEqual(100);
    }
  });
});

describe('dimensions that must not be gameable', () => {
  it('zeroes compliance risk when a blocking finding exists', () => {
    const copy = 'Applewood Gin is healthy and full of antioxidants. Order at spirithaus.com.au.';
    const assessment = assess(copy, { compliance: compliance(copy) });
    const risk = assessment.dimensions.find((d) => d.dimension === 'complianceRisk');
    expect(risk?.score).toBe(0);
    expect(risk?.reason).toContain('ABAC-HEALTH-1');
  });

  it('does not let a good overall score hide a blocking finding', () => {
    // Section 13: a score is not a verdict. The overall number can still look fair,
    // which is why publication is gated on the compliance report and not on this.
    const copy = 'Applewood Gin is healthy. Order at spirithaus.com.au.';
    const assessment = assess(copy, { compliance: compliance(copy) });
    expect(assessment.dimensions.find((d) => d.dimension === 'complianceRisk')?.score).toBe(0);
    expect(compliance(copy).publishable).toBe(false);
  });
});

describe('relevance', () => {
  it('rewards naming the product', () => {
    expect(scoreOf(good, 'relevance')?.score).toBeGreaterThan(80);
  });

  it('marks copy that never names what it sells', () => {
    const vague = 'Something new landed this week. Order at spirithaus.com.au.';
    expect(scoreOf(vague, 'relevance')?.score).toBeLessThan(40);
  });
});

describe('brand consistency', () => {
  it('penalises a separated brand spelling heavily', () => {
    const wrong = 'Applewood Gin from Spirit Haus. Order now.';
    const score = scoreOf(wrong, 'brandConsistency');
    expect(score?.score).toBeLessThan(30);
    expect(score?.reason).toContain('another business');
  });
});

describe('withheld scores', () => {
  it('withholds originality when nothing comparable exists, rather than guessing', () => {
    const originality = assess(good).dimensions.find((d) => d.dimension === 'originality');
    expect(originality?.measurable).toBe(false);
    expect(originality?.reason).toContain('nothing to measure against');
  });

  it('scores originality once a distance is known', () => {
    const close = assess(good, { nearestDuplicateBits: 3 }).dimensions.find(
      (d) => d.dimension === 'originality',
    );
    expect(close?.measurable).toBe(true);
    expect(close?.score).toBeLessThan(20);
    expect(close?.reason).toContain('read as a repeat');
  });

  it('withholds accessibility where the platform takes no alt text', () => {
    const tiktok = assessQuality({
      platform: 'TIKTOK',
      primaryCopy: good,
      hashtags: ['#spirithaus'],
      altText: null,
      components: ['hook', 'storyboard', 'onScreenText', 'caption', 'searchTerms', 'disclosure'],
      keywordCluster: ['gin'],
      factSheet: sheet(),
      compliance: compliance(good, { platform: 'TIKTOK' }),
    });
    const accessibility = tiktok.dimensions.find((d) => d.dimension === 'accessibility');
    expect(accessibility?.measurable).toBe(false);
  });

  it('excludes withheld dimensions from the overall figure', () => {
    const assessment = assess(good);
    const measurable = assessment.dimensions.filter((d) => d.measurable);
    const mean = Math.round(
      measurable.reduce((total, d) => total + d.score, 0) / measurable.length,
    );
    expect(assessment.overall).toBe(mean);
  });
});

describe('factual confidence', () => {
  it('is low when nothing is approved', () => {
    expect(scoreOf(good, 'factualConfidence')?.score).toBeLessThan(50);
  });

  it('rises with approved claims', () => {
    const withClaims = assess(good, {
      factSheet: sheet([
        {
          field: 'region',
          value: 'Adelaide Hills',
          kind: 'VERIFIED',
          status: 'APPROVED',
          confidence: 0.9,
        },
        { field: 'abv', value: '43', kind: 'VERIFIED', status: 'APPROVED', confidence: 0.9 },
      ]),
    });
    expect(
      withClaims.dimensions.find((d) => d.dimension === 'factualConfidence')?.score,
    ).toBeGreaterThan(60);
  });

  it('says how many claims were excluded', () => {
    const withPending = assess(good, {
      factSheet: sheet([
        {
          field: 'award',
          value: 'Gold 2025',
          kind: 'VERIFIED',
          status: 'PENDING',
          confidence: 0.5,
        },
      ]),
    });
    expect(
      withPending.dimensions.find((d) => d.dimension === 'factualConfidence')?.reason,
    ).toContain('awaiting review');
  });
});

describe('accessibility', () => {
  it('scores zero with no alt text on a platform that takes it', () => {
    expect(scoreOf(good, 'accessibility', { altText: null })?.score).toBe(0);
  });

  it('marks alt text that is too short to describe anything', () => {
    expect(scoreOf(good, 'accessibility', { altText: 'a gin bottle' })?.score).toBeLessThan(70);
  });
});
