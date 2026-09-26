import { describe, expect, it } from 'vitest';
import {
  PLATFORMS,
  buildFactSheet,
  specFor,
  validateAgainstSpec,
  type ClaimInput,
  type Platform,
  type ProductTruth,
} from '@spirithaus/domain';
import { MockTextGenerationProvider } from '@spirithaus/providers';
import { runCompliance } from '@spirithaus/compliance';
import { buildStrategy } from './strategy.js';
import { fit, generateVariant, type VariantDraft } from './variants.js';

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

const claims: ClaimInput[] = [
  {
    field: 'region',
    value: 'Adelaide Hills',
    kind: 'VERIFIED',
    status: 'APPROVED',
    confidence: 0.9,
    sourceUrl: 'https://applewooddistillery.com.au',
  },
  {
    field: 'abv',
    value: '43',
    kind: 'VERIFIED',
    status: 'APPROVED',
    confidence: 0.95,
    sourceUrl: 'https://applewooddistillery.com.au',
  },
];

const factSheet = buildFactSheet({
  products: [product],
  claims,
  now: new Date('2026-09-26T00:00:00Z'),
});

const strategy = buildStrategy({
  campaignName: 'Applewood Gin — spring serve',
  objective: 'PRODUCT_AWARENESS',
  landingUrl: 'https://spirithaus.com.au/products/applewood-gin',
  platforms: [...PLATFORMS],
  factSheet,
});

const brand = {
  prohibitedPhrases: [],
  approvedBrandVariations: [],
  responsibleConsumptionLine: 'Enjoy SPIRITHAUS responsibly.',
};

async function generateAll(): Promise<Map<Platform, VariantDraft>> {
  const provider = new MockTextGenerationProvider();
  const drafts = new Map<Platform, VariantDraft>();
  for (const platform of PLATFORMS) {
    const result = await generateVariant({
      platform,
      strategy,
      factSheet,
      brand,
      campaignId: 'camp_1',
      provider,
    });
    if (!result.ok) throw new Error(`${platform}: ${result.error.reason}`);
    drafts.set(platform, result.value);
  }
  return drafts;
}

describe('generating for all six platforms', () => {
  it('produces a variant for each', async () => {
    const drafts = await generateAll();
    expect([...drafts.keys()].sort()).toEqual([...PLATFORMS].sort());
  });

  it('produces six genuinely different variants, not one caption copied', async () => {
    // Section 12 forbids publishing identical copy everywhere by default. The check is
    // pairwise, because "mostly different" would pass a weaker assertion.
    const drafts = await generateAll();
    const copies = [...drafts.values()].map((draft) => draft.primaryCopy);
    expect(new Set(copies).size).toBe(6);

    for (const [a, first] of copies.entries()) {
      for (const [b, second] of copies.entries()) {
        if (a >= b) continue;
        expect(first, `${a} vs ${b}`).not.toBe(second);
      }
    }
  });

  it('gives each platform its own structure, not a shared shape', async () => {
    const drafts = await generateAll();
    const keys = [...drafts.entries()].map(([platform, draft]) => [
      platform,
      Object.keys(draft.content).sort().join(','),
    ]);
    expect(new Set(keys.map(([, shape]) => shape)).size).toBe(6);
  });

  it('carries every component its platform requires', async () => {
    const drafts = await generateAll();
    for (const [platform, draft] of drafts) {
      for (const required of specFor(platform).requires) {
        expect(draft.components, `${platform} missing ${required}`).toContain(required);
      }
    }
  });

  it('stays inside every platform spec', async () => {
    const drafts = await generateAll();
    for (const [platform, draft] of drafts) {
      const issues = validateAgainstSpec({
        platform,
        primaryCopy: draft.primaryCopy,
        hashtags: draft.hashtags,
        altText: draft.altText,
        title: null,
        destinationUrl: draft.destinationUrl,
        components: draft.components,
      }).filter((issue) => issue.blocking);
      expect(issues, `${platform}: ${issues.map((i) => i.problem).join('; ')}`).toEqual([]);
    }
  });

  it('keeps X inside 280 characters, trimming the prose rather than the link', async () => {
    const drafts = await generateAll();
    const draft = drafts.get('X');
    expect(draft?.primaryCopy.length).toBeLessThanOrEqual(280);
    expect(draft?.primaryCopy).toContain('sh_c=');
  });

  it('keeps the link out of the Instagram caption, where it would not be clickable', async () => {
    const drafts = await generateAll();
    const draft = drafts.get('INSTAGRAM');
    expect(draft?.primaryCopy).not.toMatch(/https?:\/\//);
    expect(draft?.primaryCopy).toContain('Link in bio');
    // The tracked link still exists on the variant, for the bio and the Story sticker.
    expect(draft?.destinationUrl).toContain('utm_source=instagram');
  });

  it('respects each platform’s hashtag count', async () => {
    const drafts = await generateAll();
    for (const [platform, draft] of drafts) {
      expect(draft.hashtags.length, platform).toBeLessThanOrEqual(
        specFor(platform).hashtagRecommended,
      );
    }
  });

  it('builds a per-platform tracked link with a stable campaign code', async () => {
    const drafts = await generateAll();
    const codes = new Set<string>();
    for (const [platform, draft] of drafts) {
      const url = new URL(draft.destinationUrl);
      expect(url.searchParams.get('utm_source'), platform).toBe(platform.toLowerCase());
      expect(url.searchParams.get('utm_medium'), platform).toBe('social_organic');
      codes.add(url.searchParams.get('sh_c') ?? '');
    }
    // One code per platform, so a click can be attributed to the destination it came from.
    expect(codes.size).toBe(6);
  });

  it('records what generated it, and that it was a mock', async () => {
    const drafts = await generateAll();
    for (const [platform, draft] of drafts) {
      expect(draft.generation.adapterId, platform).toBe('mock');
      expect(draft.generation.mock, platform).toBe(true);
      expect(draft.generation.promptVersion, platform).toBe('variant/v1');
    }
  });

  it('refuses the components its platform refuses', async () => {
    const drafts = await generateAll();
    expect(drafts.get('INSTAGRAM')?.components).not.toContain('productTag');
    expect(drafts.get('INSTAGRAM')?.content.productTag).toBeNull();
    expect(drafts.get('TIKTOK')?.content.paidCreative).toBeNull();
  });

  it('passes compliance on every platform, with a mocked provider and approved facts', async () => {
    const drafts = await generateAll();
    for (const [platform, draft] of drafts) {
      const report = runCompliance({
        platform,
        fields: [{ name: 'primaryCopy', value: draft.primaryCopy }],
        hashtags: draft.hashtags,
        factSheet,
        components: draft.components,
        paid: false,
        brand,
      });
      // The responsible-consumption line is advisory for organic, so the only thing
      // that could block here is a rule firing on our own assembled structure.
      expect(
        report.blocking.map((f) => f.code),
        `${platform}: ${report.blocking.map((f) => f.code).join(', ')}`,
      ).toEqual([]);
    }
  });
});

describe('a failing provider', () => {
  it('reports the failure rather than inventing copy', async () => {
    const broken = {
      ...new MockTextGenerationProvider(),
      id: 'broken',
      generate: async () => ({
        ok: false as const,
        error: { class: 'auth' as const, message: 'no key', retryable: false },
      }),
    } as unknown as MockTextGenerationProvider;

    const result = await generateVariant({
      platform: 'FACEBOOK',
      strategy,
      factSheet,
      brand,
      campaignId: 'camp_1',
      provider: broken,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.reason).toContain('no copy was written');
    expect(result.error.providerError).toContain('auth');
  });
});

describe('fit', () => {
  it('leaves a short join alone', () => {
    expect(fit(['one', 'two'], 100)).toBe('one\n\ntwo');
  });

  it('drops empty parts', () => {
    expect(fit(['one', '', null, undefined, 'two'], 100)).toBe('one\n\ntwo');
  });

  it('trims the prose and keeps the structural parts', () => {
    const prose = 'word '.repeat(50).trim();
    const out = fit([prose, 'https://example.com/x', '#tag'], 60);
    expect(out.length).toBeLessThanOrEqual(60);
    expect(out).toContain('https://example.com/x');
    expect(out).toContain('#tag');
    expect(out).toContain('…');
  });

  it('never exceeds the limit even when the structure alone is too long', () => {
    const out = fit(['prose', 'x'.repeat(200)], 50);
    expect(out.length).toBeLessThanOrEqual(50);
  });
});
