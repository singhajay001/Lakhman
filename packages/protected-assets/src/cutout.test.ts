import { describe, expect, it } from 'vitest';
import {
  bottleAndBoxPng,
  bottlePng,
  paddedPackshotPng,
  packshotOnBackdropPng,
} from '@spirithaus/testing';
import { cutout, haloBrightness, hasUsableAlpha, trimToSubject } from './cutout.js';
import { subjectProfile } from './subject.js';
import { decode, encode } from './raster.js';

/**
 * These fixtures reproduce conditions measured on the real SPIRITHAUS catalogue rather than
 * standing in for it. Supplier packshots are not committed here: redistributing a third party's
 * artwork to test our own code would be exactly the unlicensed-asset problem section 16 forbids.
 * The numbers each test pins were taken from the real images first.
 */
describe('cutting a packshot out of its backdrop', () => {
  it('leaves an image that already has alpha completely alone', async () => {
    const already = await bottlePng();
    const result = await cutout(already);
    expect(result.applied).toBe(false);
    expect(result.reason).toContain('already carries an alpha channel');
    expect(result.png).toBe(already);
  });

  it('cuts a bottle off a plain white backdrop', async () => {
    const opaque = await packshotOnBackdropPng();
    expect(hasUsableAlpha(await decode(opaque))).toBe(false);

    const result = await cutout(opaque);
    expect(result.applied).toBe(true);
    expect(result.background?.r).toBeCloseTo(255, 0);
    expect(hasUsableAlpha(await decode(result.png))).toBe(true);
    // The bottle, not the frame.
    expect(result.measurements.coverage).toBeGreaterThan(0.05);
    expect(result.measurements.coverage).toBeLessThan(0.8);
  });

  it('subtracts the backdrop it measured, not the backdrop it assumed', async () => {
    // A grey sweep is as common as white, and a cutout hard-coded to white would leave the
    // grey behind as a fringe.
    const result = await cutout(await packshotOnBackdropPng({ backdropHex: '#9a9a9a' }));
    expect(result.applied).toBe(true);
    expect(result.background?.r).toBeCloseTo(154, 0);
  });

  it('removes the halo a binary alpha would leave', async () => {
    const opaque = await packshotOnBackdropPng();
    const result = await cutout(opaque);

    // The same cutout with a hard edge and no decontamination, for comparison.
    const raster = await decode(opaque);
    const background = result.background as { r: number; g: number; b: number };
    const naive = new Uint8Array(raster.data);
    for (let pixel = 0; pixel < raster.width * raster.height; pixel += 1) {
      const index = pixel * 4;
      const distance = Math.sqrt(
        ((raster.data[index] ?? 0) - background.r) ** 2 +
          ((raster.data[index + 1] ?? 0) - background.g) ** 2 +
          ((raster.data[index + 2] ?? 0) - background.b) ** 2,
      );
      naive[index + 3] = distance <= 32 ? 0 : 255;
    }
    const naivePng = await encode({ width: raster.width, height: raster.height, data: naive });

    const decontaminated = await haloBrightness(result.png);
    const binary = await haloBrightness(naivePng);

    // The claim under test is that the backdrop's contribution is removed from the edge, so the
    // edge composites darker once decontaminated. That is what is asserted here.
    //
    // The *absolute* figure depends on what the subject is made of, which is why it is not
    // asserted on this fixture: measured on the real Husk Bam Bam packshot — a saturated amber
    // bottle — the edge reads 1.31 with a binary alpha and 0.79 decontaminated, so the white
    // fringe is plainly visible in the first and gone in the second. This synthetic bottle
    // carries a large pale label that lifts its core brightness, so both numbers sit below 1
    // while the difference between them stays the same size.
    expect(decontaminated).toBeLessThan(binary);
    expect(binary - decontaminated).toBeGreaterThan(0.05);
  });

  it('refuses a backdrop that is not plain, rather than inventing a silhouette', async () => {
    const result = await cutout(await packshotOnBackdropPng({ noise: 90 }));
    expect(result.applied).toBe(false);
    expect(result.reason).toContain('plain backdrop');
    // The measurement is given so a person can judge the refusal.
    expect(result.measurements.borderStdDev).toBeGreaterThan(12);
  });
});

describe('trimming a master to its subject', () => {
  it('removes exported padding without touching the subject', async () => {
    const padded = await paddedPackshotPng({ canvas: { width: 1600, height: 1600 } });
    const before = await decode(padded);
    const beforeSubject = subjectProfile(before);

    const trimmed = await trimToSubject(padded);
    expect(trimmed.trimmed).toBe(true);
    expect(trimmed.to.width).toBeLessThan(trimmed.from.width);

    const after = subjectProfile(await decode(trimmed.png));
    // The subject itself is unchanged; only the empty canvas around it is gone.
    expect(after?.bounds.w).toBe(beforeSubject?.bounds.w);
    expect(after?.bounds.h).toBe(beforeSubject?.bounds.h);
    expect(after?.aspect).toBeCloseTo(beforeSubject?.aspect ?? 0, 6);
  });

  it('does nothing to an image that is already its subject', async () => {
    const tight = await trimToSubject((await trimToSubject(await bottlePng())).png);
    expect(tight.trimmed).toBe(false);
  });
});

describe('telling one product from two', () => {
  it('accepts a single bottle', async () => {
    const profile = subjectProfile(await decode(await bottlePng()));
    expect(profile?.singleSubject).toBe(true);
    expect(profile?.separation).toBeLessThan(0.1);
  });

  it('flags a bottle standing beside its gift box', async () => {
    // Real examples: Talisker 10 (separation 0.444) and Lark Devil's Storm (0.225), against
    // 0.039 for the widest genuine single subject in the same catalogue.
    const profile = subjectProfile(await decode(await bottleAndBoxPng()));
    expect(profile?.singleSubject).toBe(false);
    expect(profile?.separation).toBeGreaterThan(0.1);
    expect(profile?.reason).toContain('more than one object');
    expect(profile?.separationAt).not.toBeNull();
  });

  it('does not judge a wide subject by its aspect', async () => {
    // A single can reads 0.589 wide while a bottle-beside-box reads 0.564, so aspect cannot
    // separate them. This one is deliberately squat and must still pass.
    const squat = await bottlePng({ width: 900, height: 1000 });
    const profile = subjectProfile(await decode(squat));
    expect(profile?.aspect).toBeGreaterThan(0.5);
    expect(profile?.singleSubject).toBe(true);
  });
});
