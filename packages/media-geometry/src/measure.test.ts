import { describe, expect, it } from 'vitest';
import { formatFor } from './profiles.js';
import { DEFAULT_THRESHOLDS, measure, measureAcrossPlatform, platformSafeZone } from './measure.js';
import { area, safeZone } from './geometry.js';

const reel = formatFor('INSTAGRAM', 'reel');
const story = formatFor('INSTAGRAM', 'story');
const tiktok = formatFor('TIKTOK', 'reel');

/** A subject comfortably inside every Reel surface, from the probe: the band is y 0.25–0.50. */
const SAFE_FOCAL = { x: 0.5, y: 0.4, r: 0.05 };

/**
 * A luminance gradient across the subject, spanning the three regimes: below the
 * distinguishability floor, above it but killed by the veil, and bright enough to survive.
 * A constant sampler can only ever produce 0 or 1, which hides the interesting middle.
 */
const gradient = (_x: number, y: number) => 0.012 + (y - 0.672) * 0.7;

describe('measuring per viewport', () => {
  it('reports one reading per delivered surface, not one per asset', () => {
    const reading = measure({ format: reel, masterAspect: 9 / 16, focal: SAFE_FOCAL });
    expect(reading.viewports).toHaveLength(3);
    expect(reading.viewports.map((v) => v.viewport)).toEqual([
      'reel 9:16',
      'feed crop 4:5',
      'grid 1:1',
    ]);
  });

  it('passes a subject inside the band every surface keeps', () => {
    const reading = measure({ format: reel, masterAspect: 9 / 16, focal: SAFE_FOCAL });
    expect(reading.verdict).toBe('pass');
    expect(reading.viewports.every((v) => v.verdict === 'pass')).toBe(true);
  });

  it('takes the asset verdict from the worst viewport, and names the worst of them', () => {
    // High on a 9:16 master: fine in the player, partly cropped in the feed, gone from the
    // square grid. Two viewports fail, and the one named is the one that fails hardest.
    const reading = measure({
      format: reel,
      masterAspect: 9 / 16,
      focal: { x: 0.5, y: 0.15, r: 0.05 },
    });
    expect(reading.verdict).toBe('fail');
    expect(reading.worstViewport).toBe('grid 1:1');
    expect(reading.viewports.find((v) => v.viewport === 'grid 1:1')?.cropSurvival).toBe(0);
    expect(reading.viewports.find((v) => v.viewport === 'reel 9:16')?.verdict).toBe('pass');
  });

  it('reports how much of the subject actually reads, per viewport', () => {
    const reading = measure({
      format: reel,
      masterAspect: 9 / 16,
      focal: { x: 0.5, y: 0.15, r: 0.05 },
    });
    // Gone from the grid; partly cropped and partly behind furniture in the feed; whole in
    // the player. One figure per surface, and they differ.
    expect(reading.viewports.find((v) => v.viewport === 'grid 1:1')?.effectiveVisibility).toBe(0);
    expect(reading.viewports.find((v) => v.viewport === 'reel 9:16')?.effectiveVisibility).toBe(1);
    const feed =
      reading.viewports.find((v) => v.viewport === 'feed crop 4:5')?.effectiveVisibility ?? 0;
    expect(feed).toBeGreaterThan(0);
    expect(feed).toBeLessThan(1);
  });

  it('shows why asset-level comparison discards evidence', () => {
    // High on the master: whole in the player and the feed crop, gone from the square grid.
    // One number per asset cannot say that.
    const reading = measure({
      format: reel,
      masterAspect: 9 / 16,
      focal: { x: 0.5, y: 0.19, r: 0.05 },
    });
    expect(new Set(reading.viewports.map((v) => v.verdict)).size).toBeGreaterThan(1);
    expect(reading.viewports.find((v) => v.viewport === 'reel 9:16')?.verdict).toBe('pass');
    expect(reading.viewports.find((v) => v.viewport === 'feed crop 4:5')?.verdict).toBe('pass');
    expect(reading.viewports.find((v) => v.viewport === 'grid 1:1')?.verdict).toBe('fail');
  });
});

describe('each surface carries its own furniture', () => {
  it('does not charge a feed crop for the player’s action rail', () => {
    // The bug this shape was built to fix: one set of insets applied to every crop reported
    // a subject near the top of a feed crop as behind the interface.
    const reading = measure({
      format: reel,
      masterAspect: 9 / 16,
      focal: { x: 0.5, y: 0.19, r: 0.05 },
    });
    // Not exactly zero: one sample of several hundred clips the feed's 2% top inset. The
    // point is that it is a rounding error rather than the player's 10% header.
    expect(
      reading.viewports.find((v) => v.viewport === 'feed crop 4:5')?.furnitureOcclusion,
    ).toBeLessThan(0.01);
  });

  it('charges the player, where the furniture actually is', () => {
    const reading = measure({
      format: reel,
      masterAspect: 9 / 16,
      focal: { x: 0.5, y: 0.85, r: 0.05 },
    });
    expect(reading.viewports.find((v) => v.viewport === 'reel 9:16')?.furnitureOcclusion).toBe(1);
    // And not the feed crop, which has no action rail — only a crop.
    expect(reading.viewports.find((v) => v.viewport === 'grid 1:1')?.furnitureOcclusion).toBe(0);
  });

  it('puts no furniture over a grid thumbnail, where the crop is the whole constraint', () => {
    const reading = measure({ format: reel, masterAspect: 9 / 16, focal: SAFE_FOCAL });
    expect(reading.viewports.find((v) => v.viewport === 'grid 1:1')?.furnitureOcclusion).toBe(0);
  });
});

describe('type occlusion', () => {
  it('is zero for a subject above the headline', () => {
    expect(
      measure({ format: story, masterAspect: 9 / 16, focal: SAFE_FOCAL }).viewports[0]
        ?.typeOcclusion,
    ).toBe(0);
  });

  it('fails a subject sitting in the headline', () => {
    const reading = measure({
      format: story,
      masterAspect: 9 / 16,
      focal: { x: 0.3, y: 0.7, r: 0.05 },
    });
    expect(reading.viewports[0]?.typeOcclusion).toBe(1);
    expect(reading.viewports[0]?.verdict).toBe('fail');
    expect(reading.viewports[0]?.reasons.join(' ')).toContain('under the headline');
  });

  it('is measured in master coordinates, because our type is composited into the master', () => {
    // The same subject is under the type on every surface, including the re-crops, because
    // the headline is part of the image rather than something the platform lays out.
    const reading = measure({
      format: reel,
      masterAspect: 9 / 16,
      focal: { x: 0.4, y: 0.66, r: 0.04 },
    });
    const withSubject = reading.viewports.filter((v) => v.retainedSamples > 0);
    expect(withSubject.length).toBeGreaterThan(0);
    for (const viewport of withSubject) {
      expect(viewport.typeOcclusion, viewport.viewport).toBeGreaterThan(0.5);
    }
  });

  it('measures over the retained subject, so crop loss is not counted twice', () => {
    const reading = measure({
      format: reel,
      masterAspect: 9 / 16,
      focal: { x: 0.5, y: 0.95, r: 0.12 },
    });
    for (const viewport of reading.viewports) {
      expect(viewport.typeOcclusion).toBeLessThanOrEqual(1);
      expect(viewport.typeOcclusion).toBeGreaterThanOrEqual(0);
    }
    expect(reading.verdict).toBe('fail');
  });

  it('says so when nothing is retained, rather than reporting a clean zero', () => {
    const reading = measure({
      format: reel,
      masterAspect: 9 / 16,
      focal: { x: 0.5, y: 0.05, r: 0.03 },
    });
    const grid = reading.viewports.find((v) => v.viewport === 'grid 1:1');
    expect(grid?.retainedSamples).toBe(0);
    expect(grid?.typeOcclusion).toBe(0);
    expect(grid?.reasons.join(' ')).toContain('nothing of the subject is on screen');
  });
});

describe('scrim loss', () => {
  it('is not measured without a sampler, and says so rather than reporting zero', () => {
    const reading = measure({ format: story, masterAspect: 9 / 16, focal: SAFE_FOCAL });
    expect(reading.scrimUnmeasured).toBe(true);
    expect(reading.viewports[0]?.scrimLoss).toBeNull();
    expect(reading.viewports[0]?.rawDistinguishable).toBeNull();
  });

  it('costs nothing when the subject is clear of the scrimmed region', () => {
    const reading = measure({
      format: story,
      masterAspect: 9 / 16,
      focal: SAFE_FOCAL,
      sampler: () => 0.02,
    });
    expect(reading.viewports[0]?.scrimLoss).toBe(0);
  });

  it('reports a partial loss across a subject that straddles the threshold', () => {
    const reading = measure({
      format: story,
      masterAspect: 9 / 16,
      focal: { x: 0.3, y: 0.7, r: 0.05 },
      sampler: gradient,
    });
    const viewport = reading.viewports[0];
    expect(viewport?.scrimLoss).toBeGreaterThan(0);
    expect(viewport?.scrimLoss).toBeLessThan(1);
    expect(viewport?.reasons.join(' ')).toContain('veil costs');
  });

  it('reports no loss for a subject already at the ink’s own luminance', () => {
    // The inversion that mattered: an absolute darkness test called the house style a
    // blocking defect on 25 of 25 rows. A difference does not, because a near-black subject
    // had no distinguishability for the veil to take.
    const reading = measure({
      format: story,
      masterAspect: 9 / 16,
      focal: { x: 0.3, y: 0.7, r: 0.05 },
      sampler: () => 0.005,
    });
    expect(reading.viewports[0]?.rawDistinguishable).toBe(0);
    expect(reading.viewports[0]?.scrimLoss).toBe(0);
    expect(reading.viewports[0]?.reasons.join(' ')).not.toContain('veil costs');
  });

  it('reports no loss for a subject bright enough to survive the veil', () => {
    const reading = measure({
      format: story,
      masterAspect: 9 / 16,
      focal: { x: 0.3, y: 0.7, r: 0.05 },
      sampler: () => 0.7,
    });
    expect(reading.viewports[0]?.rawDistinguishable).toBe(1);
    expect(reading.viewports[0]?.postScrimDistinguishable).toBe(1);
    expect(reading.viewports[0]?.scrimLoss).toBe(0);
  });

  it('keeps raw and post-scrim readings apart, so they cannot be conflated', () => {
    const reading = measure({
      format: story,
      masterAspect: 9 / 16,
      focal: { x: 0.3, y: 0.7, r: 0.05 },
      sampler: gradient,
    });
    const viewport = reading.viewports[0];
    expect(viewport?.scrimLoss).toBeCloseTo(
      (viewport?.rawDistinguishable ?? 0) - (viewport?.postScrimDistinguishable ?? 0),
      6,
    );
  });

  it('ignores samples the sampler cannot read', () => {
    const reading = measure({
      format: story,
      masterAspect: 9 / 16,
      focal: SAFE_FOCAL,
      sampler: () => null,
    });
    expect(reading.viewports[0]?.scrimLoss).toBe(0);
  });
});

describe('a frame with no subject', () => {
  it('warns rather than passing, because it was not judged', () => {
    const reading = measure({ format: story, masterAspect: 9 / 16, focal: null });
    expect(reading.verdict).toBe('warn');
    expect(reading.viewports[0]?.reasons.join(' ')).toContain('no focal point recorded');
  });
});

describe('thresholds', () => {
  it('are reported with the reading, and are overridable', () => {
    const reading = measure({
      format: story,
      masterAspect: 9 / 16,
      focal: SAFE_FOCAL,
      thresholds: { minCropSurvival: 0.99 },
    });
    expect(reading.thresholds.minCropSurvival).toBe(0.99);
    expect(reading.thresholds.maxTypeOcclusion).toBe(DEFAULT_THRESHOLDS.maxTypeOcclusion);
  });

  it('change a verdict when tightened, which is what makes them uncalibrated', () => {
    // A subject grazing the top of the headline: 3.2% occluded, which the defaults warn on.
    const focal = { x: 0.3, y: 0.6, r: 0.05 };
    const lenient = measure({ format: story, masterAspect: 9 / 16, focal });
    expect(lenient.verdict).toBe('warn');

    const measured = lenient.viewports[0]?.typeOcclusion ?? 0;
    expect(measured).toBeGreaterThan(0);

    const strict = measure({
      format: story,
      masterAspect: 9 / 16,
      focal,
      thresholds: { maxTypeOcclusion: measured / 2, warnTypeOcclusion: measured / 4 },
    });
    expect(strict.verdict).toBe('fail');
  });
});

describe('across a platform', () => {
  it('measures every format the platform uses', () => {
    const readings = measureAcrossPlatform({
      platform: 'INSTAGRAM',
      masterAspect: 9 / 16,
      focal: SAFE_FOCAL,
    });
    expect(readings.map((reading) => reading.format).sort()).toEqual(['feed', 'reel', 'story']);
  });

  it('gives a platform safe zone no larger than any one format’s', () => {
    const platform = area(platformSafeZone('INSTAGRAM'));
    for (const reading of measureAcrossPlatform({
      platform: 'INSTAGRAM',
      masterAspect: 9 / 16,
      focal: null,
    })) {
      expect(platform).toBeLessThanOrEqual(area(reading.safeZone) + 1e-9);
    }
  });

  it('records the profile version, since none of it is verified', () => {
    expect(measure({ format: story, masterAspect: 9 / 16, focal: null }).profileVersion).toContain(
      'unverified',
    );
  });
});

describe('the safe zone is uncomfortably small, and says so in numbers', () => {
  it('leaves 28% of a Reel master usable', () => {
    // Re-cropped to 4:5 and 1:1, with a right rail and a caption row, and a headline that in
    // practice runs to three lines. The first version of this number was 41%, because the
    // profile's type metrics were smaller than what the renderer actually draws.
    expect(area(safeZone(reel))).toBeCloseTo(0.278, 2);
  });

  it('leaves more of a Story, which is never re-cropped', () => {
    expect(area(safeZone(story))).toBeGreaterThan(area(safeZone(reel)));
  });

  it('is tightest on TikTok, which has the heaviest furniture', () => {
    expect(area(safeZone(tiktok))).toBeLessThan(area(safeZone(story)));
  });
});
