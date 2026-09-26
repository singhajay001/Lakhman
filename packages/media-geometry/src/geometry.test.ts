import { describe, expect, it } from 'vitest';
import {
  area,
  coverCrop,
  discCoverage,
  intersection,
  placeInSafeZone,
  safeZone,
  toDelivered,
  typeRegion,
} from './geometry.js';
import { measure } from './measure.js';
import { PLATFORM_FORMATS, formatFor } from './profiles.js';

describe('coverCrop', () => {
  it('keeps everything when the aspects match', () => {
    expect(coverCrop(1, 1)).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it('crops the height when the delivered frame is wider', () => {
    // A 4:5 master shown at 1:1 loses top and bottom.
    const crop = coverCrop(4 / 5, 1);
    expect(crop.w).toBe(1);
    expect(crop.h).toBeCloseTo(0.8, 6);
    expect(crop.y).toBeCloseTo(0.1, 6);
  });

  it('crops the width when the delivered frame is taller', () => {
    // A 3:2 master shown at 9:16 keeps only the middle of the width. This is the
    // correction the storefront work already made: a phone keeps the middle half.
    const crop = coverCrop(3 / 2, 9 / 16);
    expect(crop.h).toBe(1);
    expect(crop.w).toBeCloseTo(0.375, 6);
    expect(crop.x).toBeCloseTo(0.3125, 6);
  });

  it('is centred', () => {
    const crop = coverCrop(16 / 9, 1);
    expect(crop.x + crop.w / 2).toBeCloseTo(0.5, 6);
    expect(crop.y + crop.h / 2).toBeCloseTo(0.5, 6);
  });

  it('refuses a non-positive aspect rather than returning nonsense', () => {
    expect(() => coverCrop(0, 1)).toThrow(/positive/);
    expect(() => coverCrop(1, -1)).toThrow(/positive/);
  });
});

describe('typeRegion', () => {
  const spec = {
    anchor: 'bottom-left' as const,
    lineWidths: [0.7, 0.5],
    lineHeight: 0.06,
    inset: { x: 0.06, y: 0.07 },
    dilateEm: 0.25,
  };

  it('sits at the bottom, not across the bottom half', () => {
    // The whole point of the glyph model: a band would claim h = 0.5.
    const region = typeRegion(spec, 1);
    expect(region.h).toBeCloseTo(0.12 + 0.03, 6);
    expect(region.y).toBeGreaterThan(0.75);
    expect(region.y + region.h).toBeLessThanOrEqual(1);
  });

  it('is only as wide as the longest line, dilated', () => {
    const region = typeRegion(spec, 1);
    expect(region.w).toBeLessThan(0.8);
    expect(region.w).toBeGreaterThan(0.7);
  });

  it('dilates horizontally in the same physical distance as vertically', () => {
    const square = typeRegion(spec, 1);
    const wide = typeRegion(spec, 16 / 9);
    expect(wide.w).toBeGreaterThan(square.w);
    expect(wide.h).toBeCloseTo(square.h, 6);
  });

  it('grows with the number of lines', () => {
    const three = typeRegion({ ...spec, lineWidths: [0.7, 0.5, 0.4] }, 1);
    expect(three.h).toBeGreaterThan(typeRegion(spec, 1).h);
  });

  it('is empty when there is no type', () => {
    expect(area(typeRegion({ ...spec, lineWidths: [] }, 1))).toBe(0);
  });

  it('centres a centred anchor', () => {
    const region = typeRegion({ ...spec, anchor: 'bottom-centre' }, 1);
    expect(region.x + region.w / 2).toBeCloseTo(0.5, 6);
  });
});

describe('discCoverage', () => {
  const full = { x: 0, y: 0, w: 1, h: 1 };

  it('is fully inside the frame for a centred disc', () => {
    expect(discCoverage({ x: 0.5, y: 0.5, r: 0.1 }, full, 1).fraction).toBe(1);
  });

  it('is zero for a disc entirely outside the rect', () => {
    expect(
      discCoverage({ x: 0.5, y: 0.5, r: 0.1 }, { x: 0, y: 0, w: 0.1, h: 0.1 }, 1).fraction,
    ).toBe(0);
  });

  it('is partial for a disc straddling an edge', () => {
    const coverage = discCoverage({ x: 0.5, y: 0.5, r: 0.2 }, { x: 0, y: 0, w: 1, h: 0.5 }, 1);
    expect(coverage.fraction).toBeGreaterThan(0.4);
    expect(coverage.fraction).toBeLessThan(0.6);
  });

  it('samples a disc, not a point — a point cannot be 72% visible', () => {
    const coverage = discCoverage({ x: 0.5, y: 0.5, r: 0.2 }, full, 1);
    expect(coverage.total).toBeGreaterThan(100);
    expect(coverage.samples).toHaveLength(coverage.total);
  });

  it('accounts for a non-square master, so a radius is a physical distance', () => {
    // On a 2:1 master the same radius spans half the normalised width it spans in height.
    const wide = discCoverage({ x: 0.5, y: 0.5, r: 0.4 }, { x: 0.3, y: 0, w: 0.4, h: 1 }, 2);
    const square = discCoverage({ x: 0.5, y: 0.5, r: 0.4 }, { x: 0.3, y: 0, w: 0.4, h: 1 }, 1);
    expect(wide.fraction).toBeGreaterThan(square.fraction);
  });
});

describe('toDelivered', () => {
  it('maps the crop centre to the frame centre', () => {
    const crop = coverCrop(3 / 2, 9 / 16);
    expect(toDelivered({ x: 0.5, y: 0.5 }, crop)).toEqual({ x: 0.5, y: 0.5 });
  });

  it('puts a cropped-away point outside 0–1', () => {
    const crop = coverCrop(3 / 2, 9 / 16);
    const mapped = toDelivered({ x: 0.9, y: 0.5 }, crop);
    expect(mapped.x).toBeGreaterThan(1);
  });
});

describe('intersection', () => {
  it('is empty for disjoint rects', () => {
    expect(
      area(intersection({ x: 0, y: 0, w: 0.2, h: 0.2 }, { x: 0.5, y: 0.5, w: 0.2, h: 0.2 })),
    ).toBe(0);
  });

  it('is the smaller rect when nested', () => {
    const inner = { x: 0.2, y: 0.2, w: 0.2, h: 0.2 };
    expect(intersection({ x: 0, y: 0, w: 1, h: 1 }, inner)).toEqual(inner);
  });
});

describe('safeZone', () => {
  it('is smaller than the frame for every platform format', () => {
    for (const format of PLATFORM_FORMATS) {
      const zone = safeZone(format);
      expect(area(zone), `${format.platform}/${format.format}`).toBeGreaterThan(0);
      expect(area(zone), `${format.platform}/${format.format}`).toBeLessThan(1);
    }
  });

  it('is tightest where the platform re-crops the same master', () => {
    // An Instagram Reel is shown at 9:16, re-cropped to 4:5 in the feed, and to 1:1 in the
    // grid. A Story is only ever 9:16.
    const reel = area(safeZone(formatFor('INSTAGRAM', 'reel')));
    const story = area(safeZone(formatFor('INSTAGRAM', 'story')));
    expect(reel).toBeLessThan(story);
  });

  it('leaves under a third of a TikTok frame usable, which is the uncomfortable answer', () => {
    const zone = safeZone(formatFor('TIKTOK', 'reel'));
    expect(area(zone)).toBeLessThan(0.6);
    expect(zone.w).toBeLessThan(0.8);
  });
});

describe('placeInSafeZone', () => {
  const reel = formatFor('INSTAGRAM', 'reel');
  const output = { width: 1080, height: 1920 };

  it('puts the product inside the zone, and reports the focal it produced', () => {
    const placement = placeInSafeZone({
      format: reel,
      output,
      product: { width: 600, height: 1200 },
    });
    const zone = safeZone(reel);

    expect(placement.focal.x).toBeGreaterThanOrEqual(zone.x);
    expect(placement.focal.x).toBeLessThanOrEqual(zone.x + zone.w);
    expect(placement.focal.y).toBeGreaterThanOrEqual(zone.y);
    expect(placement.focal.y).toBeLessThanOrEqual(zone.y + zone.h);
  });

  it('scales a tall product down to fit, and says it did', () => {
    const placement = placeInSafeZone({
      format: reel,
      output,
      product: { width: 600, height: 1200 },
    });
    expect(placement.scaledToFit).toBe(true);
    expect(placement.scale).toBeLessThan(1);
  });

  it('leaves a product that already fits at scale 1', () => {
    const placement = placeInSafeZone({
      format: reel,
      output,
      product: { width: 200, height: 300 },
    });
    expect(placement.scale).toBe(1);
    expect(placement.scaledToFit).toBe(false);
  });

  it('produces a placement the measurement engine then passes', () => {
    // The loop closed: place, then measure, and the answer is a pass rather than type over
    // the label.
    const placement = placeInSafeZone({
      format: reel,
      output,
      product: { width: 600, height: 1200 },
    });
    const reading = measure({
      format: reel,
      masterAspect: 9 / 16,
      focal: { x: placement.focal.x, y: placement.focal.y, r: 0.08 },
    });
    expect(reading.verdict).toBe('pass');
  });
});
