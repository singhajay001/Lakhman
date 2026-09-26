import { describe, expect, it } from 'vitest';
import { hammingDistance, isNearDuplicate, simhash } from './simhash.js';

const gin =
  'Applewood Gin is distilled in the Adelaide Hills with native botanicals. Serve it long with tonic and a strip of grapefruit peel.';

describe('simhash', () => {
  it('is 64 bits', () => {
    expect(simhash(gin).hash.length).toBe(8);
  });

  it('is deterministic', () => {
    expect(simhash(gin).hash.equals(simhash(gin).hash)).toBe(true);
  });

  it('is identical for the same copy', () => {
    expect(hammingDistance(simhash(gin).hash, simhash(gin).hash)).toBe(0);
  });

  it('ignores links, hashtags and punctuation, which a repost changes first', () => {
    const decorated = `${gin} https://spirithaus.com.au/x?utm_source=instagram #spirithaus #gin!!!`;
    expect(hammingDistance(simhash(gin).hash, simhash(decorated).hash)).toBeLessThanOrEqual(12);
  });

  it('stays close for a light rewrite, which is what a recycled post is', () => {
    const rewritten =
      'Applewood Gin is distilled in the Adelaide Hills with native botanicals. Serve it long with tonic and a twist of grapefruit peel.';
    expect(isNearDuplicate(simhash(gin).hash, simhash(rewritten).hash)).toBe(true);
  });

  it('separates genuinely different copy', () => {
    const other =
      'Starward Nova is matured in Australian red wine barrels in Melbourne. Drink it neat, or over one large cube.';
    expect(isNearDuplicate(simhash(gin).hash, simhash(other).hash)).toBe(false);
  });

  it('exposes four buckets so a candidate search can use an index', () => {
    const { buckets } = simhash(gin);
    expect(buckets).toHaveLength(4);
    for (const bucket of buckets) {
      expect(bucket).toBeGreaterThanOrEqual(0);
      expect(bucket).toBeLessThanOrEqual(0xffff);
    }
  });

  it('handles copy too short to trigram without throwing', () => {
    expect(() => simhash('gin')).not.toThrow();
    expect(() => simhash('')).not.toThrow();
  });

  it('refuses to compare hashes of different lengths', () => {
    expect(() => hammingDistance(Buffer.alloc(8), Buffer.alloc(4))).toThrow(/different lengths/);
  });
});
