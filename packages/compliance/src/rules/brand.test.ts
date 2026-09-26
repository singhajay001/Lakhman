import { describe, expect, it } from 'vitest';
import { buildFactSheet } from '@spirithaus/domain';
import { runCompliance } from '../engine.js';
import type { ComplianceInput } from '../types.js';

const base = (over: Partial<ComplianceInput> = {}): ComplianceInput => ({
  platform: 'INSTAGRAM',
  fields: [{ name: 'primaryCopy', value: 'Applewood Gin from SPIRITHAUS.' }],
  hashtags: [],
  factSheet: buildFactSheet({ products: [], claims: [] }),
  components: [],
  paid: false,
  brand: {
    prohibitedPhrases: [],
    approvedBrandVariations: [],
    responsibleConsumptionLine: null,
  },
  ...over,
});

const failed = (input: ComplianceInput): string[] =>
  runCompliance(input)
    .findings.filter((f) => f.outcome === 'FAIL')
    .map((f) => f.code);

describe('prohibited phrases', () => {
  it('blocks a phrase the Brand Kit forbids', () => {
    const codes = failed(
      base({
        fields: [{ name: 'primaryCopy', value: 'The best gin in Australia, full stop.' }],
        brand: {
          prohibitedPhrases: ['the best gin in australia'],
          approvedBrandVariations: [],
          responsibleConsumptionLine: null,
        },
      }),
    );
    expect(codes).toContain('BRAND-1');
  });

  it('passes when the list is empty', () => {
    expect(failed(base())).not.toContain('BRAND-1');
  });
});

describe('the brand name', () => {
  it('accepts SPIRITHAUS in any case', () => {
    for (const spelling of ['SPIRITHAUS', 'Spirithaus', 'spirithaus']) {
      expect(
        failed(base({ fields: [{ name: 'primaryCopy', value: `From ${spelling}.` }] })),
        spelling,
      ).not.toContain('BRAND-2');
    }
  });

  it('blocks a separated spelling, which belongs to somebody else', () => {
    // "Spirit Haus" is a Massachusetts beverage retailer trading since 1972; the
    // separated spelling weakens the entity signal as well as breaking section 2.
    for (const spelling of ['Spirit Haus', 'spirit-haus', 'Spirit haus']) {
      expect(
        failed(base({ fields: [{ name: 'primaryCopy', value: `From ${spelling}.` }] })),
        spelling,
      ).toContain('BRAND-2');
    }
  });

  it('accepts a variation an administrator recorded as approved', () => {
    const codes = failed(
      base({
        fields: [{ name: 'primaryCopy', value: 'From Spirit Haus.' }],
        brand: {
          prohibitedPhrases: [],
          approvedBrandVariations: ['Spirit Haus'],
          responsibleConsumptionLine: null,
        },
      }),
    );
    expect(codes).not.toContain('BRAND-2');
  });
});

describe('keyword stuffing', () => {
  it('flags a term repeated past reading', () => {
    const stuffed = `${'Australian gin is the gin for gin lovers who love gin and gin cocktails with gin. '.repeat(2)}Serve cold.`;
    const codes = failed(base({ fields: [{ name: 'primaryCopy', value: stuffed }] }));
    expect(codes).toContain('SEO-1');
  });

  it('leaves ordinary copy alone', () => {
    const ordinary =
      'Applewood Gin is distilled in the Adelaide Hills with native botanicals. Serve it long with tonic, or short with vermouth and a twist of grapefruit peel over ice.';
    expect(failed(base({ fields: [{ name: 'primaryCopy', value: ordinary }] }))).not.toContain(
      'SEO-1',
    );
  });

  it('is advisory, not blocking — bad copy is not a compliance breach', () => {
    const stuffed = `${'gin gin gin gin '.repeat(8)}and tonic`;
    const report = runCompliance(base({ fields: [{ name: 'primaryCopy', value: stuffed }] }));
    expect(report.advisory.map((f) => f.code)).toContain('SEO-1');
    expect(report.publishable).toBe(true);
  });
});

describe('platform refusals', () => {
  it('blocks an Instagram product tag, which alcohol cannot use', () => {
    const codes = failed(base({ platform: 'INSTAGRAM', components: ['productTag'] }));
    expect(codes).toContain('PLATFORM-1');
  });

  it('explains why, in the evidence', () => {
    const report = runCompliance(base({ platform: 'INSTAGRAM', components: ['productTag'] }));
    const finding = report.blocking.find((f) => f.code === 'PLATFORM-1');
    expect(finding?.evidence[0]?.excerpt).toContain('Commerce Policy');
  });

  it('blocks TikTok paid creative', () => {
    expect(failed(base({ platform: 'TIKTOK', components: ['paidCreative'] }))).toContain(
      'PLATFORM-1',
    );
  });

  it('leaves a component the platform does permit alone', () => {
    expect(
      failed(base({ platform: 'INSTAGRAM', components: ['carousel', 'altText'] })),
    ).not.toContain('PLATFORM-1');
  });
});

describe('paid creative in this phase', () => {
  it('cannot be approved, and says why rather than passing', () => {
    const report = runCompliance(base({ paid: true }));
    const finding = report.findings.find((f) => f.code === 'PLATFORM-AGE-1');
    expect(finding?.outcome).toBe('FAIL');
    expect(finding?.evidence[0]?.excerpt).toContain('Phase 7');
    expect(report.publishable).toBe(false);
  });

  it('is not applicable to organic, rather than silently passing', () => {
    const report = runCompliance(base({ paid: false }));
    expect(report.findings.find((f) => f.code === 'PLATFORM-AGE-1')?.outcome).toBe(
      'NOT_APPLICABLE',
    );
  });
});
