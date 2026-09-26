import { describe, expect, it } from 'vitest';
import { buildFactSheet, type FactSheet, type ProductTruth } from '@spirithaus/domain';
import { ALL_RULES, isHighRisk, runCompliance, summarise } from './engine.js';
import type { ComplianceInput } from './types.js';

const product = (over: Partial<ProductTruth> = {}): ProductTruth => ({
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
  ...over,
});

const sheet = (over: Partial<Parameters<typeof buildFactSheet>[0]> = {}): FactSheet =>
  buildFactSheet({
    products: [product()],
    claims: [],
    now: new Date('2026-09-26T00:00:00Z'),
    ...over,
  });

const input = (copy: string, over: Partial<ComplianceInput> = {}): ComplianceInput => ({
  platform: 'INSTAGRAM',
  fields: [{ name: 'primaryCopy', value: copy }],
  hashtags: [],
  factSheet: sheet(),
  components: [],
  paid: false,
  brand: {
    prohibitedPhrases: [],
    approvedBrandVariations: [],
    responsibleConsumptionLine: 'Enjoy SPIRITHAUS responsibly.',
  },
  ...over,
});

const clean =
  'Applewood Gin, made in the Adelaide Hills. Serve with tonic and a strip of grapefruit. Enjoy SPIRITHAUS responsibly.';

const codes = (copy: string, over: Partial<ComplianceInput> = {}): string[] =>
  runCompliance(input(copy, over))
    .findings.filter((f) => f.outcome === 'FAIL')
    .map((f) => f.code);

describe('the ruleset', () => {
  it('gives every rule an id, a code, a standard and a suggestion', () => {
    for (const rule of ALL_RULES) {
      expect(rule.id, rule.code).toMatch(/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){1,2}$/);
      expect(rule.code, rule.id).toMatch(/^[A-Z]+[A-Z-]*[A-Z0-9]$/);
      expect(rule.standard.length, rule.id).toBeGreaterThan(60);
      expect(rule.suggestion.length, rule.id).toBeGreaterThan(30);
    }
  });

  it('holds the 26 rules the README claims', () => {
    // Asserted so the documented number cannot drift away from the code.
    expect(ALL_RULES).toHaveLength(26);
  });

  it('uses no duplicate ids or codes', () => {
    expect(new Set(ALL_RULES.map((r) => r.id)).size).toBe(ALL_RULES.length);
    expect(new Set(ALL_RULES.map((r) => r.code)).size).toBe(ALL_RULES.length);
  });

  it('reports every rule on every run, passing ones included', () => {
    const report = runCompliance(input(clean));
    expect(report.findings).toHaveLength(ALL_RULES.length);
    expect(
      report.findings.every((f) => ['PASS', 'FAIL', 'NOT_APPLICABLE'].includes(f.outcome)),
    ).toBe(true);
  });

  it('passes clean copy, and still says a human must review it', () => {
    const report = runCompliance(input(clean));
    expect(report.blocking).toEqual([]);
    expect(report.publishable).toBe(true);
    expect(summarise(report)).toContain('requires human review');
    expect(report.disclaimer).toContain('not legal advice');
  });
});

describe('isHighRisk', () => {
  it('is true when anything blocking fired', () => {
    expect(isHighRisk(runCompliance(input('Full of antioxidants.')))).toBe(true);
  });

  it('is true for an advisory finding in a category that needs a compliance reviewer', () => {
    // A hangover reference is advisory, and still the kind of thing a second pair of
    // eyes should see before it goes out.
    const report = runCompliance(input(`${clean} No hangover, we promise.`));
    expect(report.blocking).toEqual([]);
    expect(isHighRisk(report)).toBe(true);
  });

  it('is false for a clean report', () => {
    expect(isHighRisk(runCompliance(input(clean)))).toBe(false);
  });

  it('is false for an advisory finding that is only about craft', () => {
    const stuffed = `${'gin gin gin gin '.repeat(8)}and tonic. Enjoy SPIRITHAUS responsibly.`;
    const report = runCompliance(input(stuffed));
    expect(report.advisory.map((f) => f.code)).toContain('SEO-1');
    expect(isHighRisk(report)).toBe(false);
  });
});

describe('alcohol-marketing rules', () => {
  it('blocks content with appeal to minors, with the evidence', () => {
    const report = runCompliance(input('Tastes like a lolly. Great with cartoon night.'));
    const finding = report.blocking.find((f) => f.code === 'ABAC-MINORS-1');
    expect(finding).toBeDefined();
    expect(finding?.evidence.map((e) => e.match.toLowerCase())).toEqual(
      expect.arrayContaining(['lolly', 'cartoon']),
    );
    expect(finding?.evidence[0]?.index).toBeGreaterThanOrEqual(0);
    expect(finding?.evidence[0]?.excerpt).toContain('lolly');
    expect(report.publishable).toBe(false);
  });

  it('blocks people who may not read as 25 or older', () => {
    expect(codes('Perfect for schoolies and uni students.')).toContain('ABAC-MINORS-2');
  });

  it('blocks excessive consumption', () => {
    expect(codes('Bottomless pours all night, keep them coming.')).toContain('ABAC-CONSUME-1');
  });

  it('blocks intoxication, however fondly put', () => {
    expect(codes('Get pleasantly tipsy on the balcony.')).toContain('ABAC-CONSUME-2');
    expect(codes('Hair of the dog on Sunday.')).toContain('ABAC-CONSUME-2');
  });

  it('flags a hangover reference as advisory rather than blocking', () => {
    const report = runCompliance(input(`${clean} No hangover, we promise.`));
    expect(report.advisory.map((f) => f.code)).toContain('ABAC-CONSUME-3');
    expect(report.blocking.map((f) => f.code)).not.toContain('ABAC-CONSUME-3');
  });

  it('blocks alcohol associated with driving', () => {
    expect(codes('Grab a bottle for the road trip.')).toContain('ABAC-SAFETY-1');
  });

  it('does not fire the driving rule on responsible wording', () => {
    // A false positive here would block the very messaging the code wants.
    expect(codes(`${clean} Always have a designated driver.`)).not.toContain('ABAC-SAFETY-1');
  });

  it('blocks health and therapeutic claims', () => {
    expect(codes('Full of antioxidants and good for you.')).toContain('ABAC-HEALTH-1');
    expect(codes('Pour one to take the edge off after work.')).toContain('ABAC-HEALTH-2');
  });

  it('blocks social success and performance claims', () => {
    expect(codes('A little liquid courage and you will be the life of the party.')).toContain(
      'ABAC-SOCIAL-1',
    );
    expect(codes('An energy boost that keeps you going.')).toContain('ABAC-SOCIAL-2');
  });

  it('blocks irresponsible supply language', () => {
    expect(codes('Unlimited refills, no questions asked.')).toContain('ABAC-SERVICE-1');
  });
});

describe('the responsible-consumption line', () => {
  it('is advisory when missing from organic copy', () => {
    const report = runCompliance(input('Applewood Gin, from the Adelaide Hills.'));
    expect(report.advisory.map((f) => f.code)).toContain('ABAC-SERVICE-2');
    expect(report.publishable).toBe(true);
  });

  it('becomes blocking on paid creative', () => {
    const report = runCompliance(input('Applewood Gin, from the Adelaide Hills.', { paid: true }));
    expect(report.blocking.map((f) => f.code)).toContain('ABAC-SERVICE-2');
    expect(report.publishable).toBe(false);
  });

  it('cannot pass at all when the Brand Kit has no confirmed line', () => {
    // Section 14 forbids inventing brand details, so an unconfirmed line is no line.
    const report = runCompliance(
      input(clean, {
        brand: {
          prohibitedPhrases: [],
          approvedBrandVariations: [],
          responsibleConsumptionLine: null,
        },
      }),
    );
    const finding = report.findings.find((f) => f.code === 'ABAC-SERVICE-2');
    expect(finding?.outcome).toBe('FAIL');
    expect(finding?.evidence[0]?.excerpt).toContain('no confirmed responsible-consumption line');
  });

  it('passes when the exact Brand Kit line is present', () => {
    const report = runCompliance(input(clean));
    expect(report.findings.find((f) => f.code === 'ABAC-SERVICE-2')?.outcome).toBe('PASS');
  });
});
