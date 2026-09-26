import { describe, expect, it } from 'vitest';
import {
  PLATFORM_FORMATS,
  PRODUCT_GEOMETRY_BASELINE,
  requiredMasterHeightPx,
  safeZone,
} from './index.js';

/**
 * The gate that replaced "at least 600px on either edge", which was aspect-blind: a real
 * 528x1622 bottle has ample resolution for every format here and failed it, while a 600x600
 * square has too little for a Pinterest pin and passed.
 */
describe('how big a master has to be', () => {
  it('asks for the height of the largest place the product is put', () => {
    // At the current profiles that is the Pinterest pin, whose safe zone is 1067px tall.
    expect(requiredMasterHeightPx(0.3)).toBe(961);
  });

  it('never exceeds the tallest placement any format makes', () => {
    const tallest = Math.max(
      ...PLATFORM_FORMATS.map((format) => safeZone(format).h * format.render.h * 0.9),
    );
    for (const aspect of [0.2, 0.3, 0.5, 0.9, 1.4]) {
      expect(requiredMasterHeightPx(aspect)).toBeLessThanOrEqual(Math.ceil(tallest));
    }
  });

  it('asks less of a wide subject, because width becomes the binding constraint', () => {
    // A tall narrow bottle is limited by the zone's height; a wide one runs out of width first
    // and is therefore placed shorter, so it needs fewer pixels of height.
    expect(requiredMasterHeightPx(1.5)).toBeLessThan(requiredMasterHeightPx(0.3));
  });

  it('passes a real bottle that the old flat rule rejected', () => {
    // Jack Daniel's Old No. 7, trimmed to its subject.
    const width = 528;
    const height = 1622;
    expect(Math.min(width, height)).toBeLessThan(600); // the old rule refused this
    expect(height).toBeGreaterThanOrEqual(requiredMasterHeightPx(width / height));
  });

  it('refuses a square that the old flat rule accepted', () => {
    expect(600).toBeLessThan(requiredMasterHeightPx(1));
  });

  it('refuses an impossible aspect rather than returning a number', () => {
    expect(requiredMasterHeightPx(0)).toBe(Infinity);
    expect(requiredMasterHeightPx(Number.NaN)).toBe(Infinity);
  });
});

describe('the recorded product-geometry baseline', () => {
  it('says what it was measured on, and stays separate from the platform profile', () => {
    // Real packshots calibrate the subject half of the model. They say nothing about where a
    // platform draws its own furniture, and conflating the two would let a real measurement of
    // bottles vouch for an unmeasured guess at interface insets.
    expect(PRODUCT_GEOMETRY_BASELINE.source).toContain('Shopify catalogue');
    expect(PRODUCT_GEOMETRY_BASELINE.subjectAspect.median).toBeLessThan(
      PRODUCT_GEOMETRY_BASELINE.syntheticReferenceAspect,
    );
    expect(PRODUCT_GEOMETRY_BASELINE.findings.length).toBeGreaterThan(0);
  });
});
