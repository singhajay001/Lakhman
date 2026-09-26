import type { Platform } from '@spirithaus/domain';
import {
  coverCrop,
  discCoverage,
  intersection,
  safeRect,
  safeZone,
  toDelivered,
  typeRegion,
  type Focal,
} from './geometry.js';
import {
  PLATFORM_PROFILE_VERSION,
  formatsFor,
  type PlatformFormat,
  type Rect,
} from './profiles.js';

/**
 * A luminance sampler over the master image, 0–1 by normalised coordinate. Optional: crop
 * survival and type occlusion are pure geometry and need no pixels. Scrim loss does.
 */
export type LuminanceSampler = (x: number, y: number) => number | null;

export interface ViewportReading {
  viewport: string;
  deliveredAspect: number;
  /** Fraction of the subject disc still on screen. */
  cropSurvival: number;
  /** Fraction of the *retained* subject sitting under the glyph region. */
  typeOcclusion: number;
  /** Fraction of the retained subject inside the platform's own furniture. */
  furnitureOcclusion: number;
  /**
   * Distinguishability lost *because of* the veil: the difference between what could be
   * told apart from the ink before the scrim and after it. Not an absolute darkness test.
   */
  scrimLoss: number | null;
  /** Reported so the two are never conflated. */
  rawDistinguishable: number | null;
  postScrimDistinguishable: number | null;
  /** How many subject samples were still on screen. Zero makes every other figure moot. */
  retainedSamples: number;
  /**
   * How much of the subject actually reads: on screen, clear of the type, clear of the
   * platform's furniture, and still distinguishable from the veil. The four measures are
   * independent losses over the same subject, so they multiply.
   */
  effectiveVisibility: number;
  verdict: 'pass' | 'warn' | 'fail';
  reasons: string[];
}

export interface Thresholds {
  /** Below this fraction of the subject surviving the crop, it fails. */
  minCropSurvival: number;
  warnCropSurvival: number;
  /** Above this fraction under the type, it fails. */
  maxTypeOcclusion: number;
  warnTypeOcclusion: number;
  maxFurnitureOcclusion: number;
  warnFurnitureOcclusion: number;
  /** Above this scrim loss, it fails. */
  maxScrimLoss: number;
  warnScrimLoss: number;
}

/**
 * Starting values, **uncalibrated**. The storefront harness's own 90/5/40 were never
 * derived either, and the one attempt to derive them returned null on all six distributions
 * because every label was a viewport judgement and no frame had been judged as a frame.
 * These are configurable and labelled, not claimed.
 */
export const DEFAULT_THRESHOLDS: Thresholds = {
  minCropSurvival: 0.85,
  warnCropSurvival: 0.95,
  maxTypeOcclusion: 0.1,
  warnTypeOcclusion: 0.02,
  maxFurnitureOcclusion: 0.25,
  warnFurnitureOcclusion: 0.1,
  maxScrimLoss: 0.3,
  warnScrimLoss: 0.15,
};

export interface AssetReading {
  platform: Platform;
  format: string;
  profileVersion: string;
  /** Per delivered aspect. This is the level the model discriminates at. */
  viewports: ViewportReading[];
  /**
   * The asset's verdict is its worst viewport — stated, because a per-asset chip that
   * hides which viewport failed is decorative.
   */
  verdict: 'pass' | 'warn' | 'fail';
  worstViewport: string;
  safeZone: Rect;
  thresholds: Thresholds;
  /** True when no sampler was supplied, so scrim loss was not measured. */
  scrimUnmeasured: boolean;
}

export interface MeasureInput {
  format: PlatformFormat;
  /** The master's aspect as delivered to the platform, width / height. */
  masterAspect: number;
  focal: Focal | null;
  sampler?: LuminanceSampler;
  thresholds?: Partial<Thresholds>;
}

/** Relative luminance of the scrim colour, for the distinguishability test. */
function hexLuminance(hex: string): number {
  const value = hex.replace('#', '');
  const r = Number.parseInt(value.slice(0, 2), 16) / 255;
  const g = Number.parseInt(value.slice(2, 4), 16) / 255;
  const b = Number.parseInt(value.slice(4, 6), 16) / 255;
  const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Two luminances are distinguishable at a contrast ratio above this. */
const DISTINGUISHABLE_RATIO = 1.2;

const contrastRatio = (a: number, b: number): number =>
  (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

export function measure(input: MeasureInput): AssetReading {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...input.thresholds };
  const scrimLuminance = hexLuminance(input.format.scrim.hex);
  const viewports: ViewportReading[] = [];

  // Our own type is composited into the master, so its region is fixed in master
  // coordinates and is cropped along with everything else. Computing it per delivered
  // aspect would model type that re-lays itself out per surface, which ours does not.
  const typeOnMaster = typeRegion(input.format.type, input.format.aspect);

  for (const delivered of input.format.deliveredAspects) {
    const crop = coverCrop(input.masterAspect, delivered.aspect);
    const furniture = safeRect(delivered.safe);

    if (!input.focal) {
      viewports.push({
        viewport: delivered.name,
        deliveredAspect: delivered.aspect,
        cropSurvival: 1,
        typeOcclusion: 0,
        furnitureOcclusion: 0,
        scrimLoss: null,
        rawDistinguishable: null,
        postScrimDistinguishable: null,
        retainedSamples: 0,
        effectiveVisibility: 0,
        verdict: 'warn',
        // A frame with no subject is not a passing frame, it is an unjudged one. The
        // storefront corpus had one and excluding it from the aggregates mattered.
        reasons: ['no focal point recorded, so nothing about the subject was measured'],
      });
      continue;
    }

    const visible = discCoverage(input.focal, crop, input.masterAspect);
    const cropSurvival = visible.fraction;

    // Occlusion is measured over the *retained* samples. Charging a frame for type over a
    // part of the subject that was cropped away counts the same loss twice.
    const retained = visible.samples.filter(
      (sample) =>
        sample.x >= crop.x &&
        sample.x <= crop.x + crop.w &&
        sample.y >= crop.y &&
        sample.y <= crop.y + crop.h,
    );

    let underType = 0;
    let underFurniture = 0;
    let raw = 0;
    let postScrim = 0;

    for (const sample of retained) {
      const inType =
        sample.x >= typeOnMaster.x &&
        sample.x <= typeOnMaster.x + typeOnMaster.w &&
        sample.y >= typeOnMaster.y &&
        sample.y <= typeOnMaster.y + typeOnMaster.h;
      if (inType) underType += 1;

      const point = toDelivered(sample, crop);
      const inFurniture = !(
        point.x >= furniture.x &&
        point.x <= furniture.x + furniture.w &&
        point.y >= furniture.y &&
        point.y <= furniture.y + furniture.h
      );
      if (inFurniture) underFurniture += 1;

      if (input.sampler) {
        const luminance = input.sampler(sample.x, sample.y);
        if (luminance === null) continue;
        // Read twice from the same value: before the veil, and after compositing it.
        const veiled =
          input.format.scrim.coverage === 'full' || inType
            ? luminance * (1 - input.format.scrim.opacity) +
              scrimLuminance * input.format.scrim.opacity
            : luminance;
        if (contrastRatio(luminance, scrimLuminance) > DISTINGUISHABLE_RATIO) raw += 1;
        if (contrastRatio(veiled, scrimLuminance) > DISTINGUISHABLE_RATIO) postScrim += 1;
      }
    }

    const count = retained.length;
    const typeOcclusion = count === 0 ? 0 : underType / count;
    const furnitureOcclusion = count === 0 ? 0 : underFurniture / count;
    // Reported so a reader can see that an occlusion of 0 over nothing retained is not a
    // clean frame.
    const retainedSamples = count;
    const rawFraction = input.sampler && count > 0 ? raw / count : null;
    const postFraction = input.sampler && count > 0 ? postScrim / count : null;
    const scrimLoss =
      rawFraction !== null && postFraction !== null
        ? Math.max(0, rawFraction - postFraction)
        : null;

    const reasons: string[] = [];
    let verdict: ViewportReading['verdict'] = 'pass';
    const fail = (reason: string) => {
      verdict = 'fail';
      reasons.push(reason);
    };
    const warn = (reason: string) => {
      if (verdict !== 'fail') verdict = 'warn';
      reasons.push(reason);
    };

    if (count === 0) {
      reasons.push('nothing of the subject is on screen, so the other figures measure nothing');
    }

    if (cropSurvival < thresholds.minCropSurvival) {
      fail(
        `${pct(cropSurvival)} of the subject survives the crop, against a floor of ${pct(thresholds.minCropSurvival)}`,
      );
    } else if (cropSurvival < thresholds.warnCropSurvival) {
      warn(`${pct(cropSurvival)} of the subject survives the crop`);
    }

    if (typeOcclusion > thresholds.maxTypeOcclusion) {
      fail(
        `${pct(typeOcclusion)} of the subject sits under the headline, against a ceiling of ${pct(thresholds.maxTypeOcclusion)}`,
      );
    } else if (typeOcclusion > thresholds.warnTypeOcclusion) {
      warn(`${pct(typeOcclusion)} of the subject sits under the headline`);
    }

    if (furnitureOcclusion > thresholds.maxFurnitureOcclusion) {
      fail(`${pct(furnitureOcclusion)} of the subject is behind the platform's own interface`);
    } else if (furnitureOcclusion > thresholds.warnFurnitureOcclusion) {
      warn(`${pct(furnitureOcclusion)} of the subject is behind the platform's own interface`);
    }

    if (scrimLoss !== null) {
      if (scrimLoss > thresholds.maxScrimLoss) {
        fail(`the veil costs ${pct(scrimLoss)} of the subject's distinguishability`);
      } else if (scrimLoss > thresholds.warnScrimLoss) {
        warn(`the veil costs ${pct(scrimLoss)} of the subject's distinguishability`);
      }
    }

    viewports.push({
      viewport: delivered.name,
      deliveredAspect: delivered.aspect,
      cropSurvival,
      typeOcclusion,
      furnitureOcclusion,
      scrimLoss,
      rawDistinguishable: rawFraction,
      postScrimDistinguishable: postFraction,
      retainedSamples,
      effectiveVisibility:
        cropSurvival * (1 - typeOcclusion) * (1 - furnitureOcclusion) * (1 - (scrimLoss ?? 0)),
      verdict,
      reasons,
    });
  }

  // "Worst" has to mean worst, not first-encountered. Two viewports can both fail; the one
  // worth naming is the one that fails hardest, so the verdict is ranked and then broken by
  // how much is actually wrong.
  const order = { pass: 0, warn: 1, fail: 2 } as const;
  // Ranked by how little of the subject reads, not by a sum of the four losses: summing
  // made a partly-cropped, partly-covered frame score worse than one where the subject is
  // gone altogether.
  const badness = (reading: ViewportReading): number => 1 - reading.effectiveVisibility;
  const worst = viewports.reduce((worstSoFar, reading) => {
    if (order[reading.verdict] !== order[worstSoFar.verdict]) {
      return order[reading.verdict] > order[worstSoFar.verdict] ? reading : worstSoFar;
    }
    return badness(reading) > badness(worstSoFar) ? reading : worstSoFar;
  });

  return {
    platform: input.format.platform,
    format: input.format.format,
    profileVersion: PLATFORM_PROFILE_VERSION,
    viewports,
    verdict: worst.verdict,
    worstViewport: worst.viewport,
    safeZone: safeZone(input.format),
    thresholds,
    scrimUnmeasured: !input.sampler,
  };
}

/** Measures one master against every format a platform uses. */
export function measureAcrossPlatform(input: {
  platform: Platform;
  masterAspect: number;
  focal: Focal | null;
  sampler?: LuminanceSampler;
  thresholds?: Partial<Thresholds>;
}): AssetReading[] {
  return formatsFor(input.platform).map((format) =>
    measure({
      format,
      masterAspect: input.masterAspect,
      focal: input.focal,
      sampler: input.sampler,
      thresholds: input.thresholds,
    }),
  );
}

/**
 * Where to put the subject: the intersection of every format's safe zone for a platform.
 * The storefront answer was uncomfortably small, and these will be too.
 */
export function platformSafeZone(platform: Platform): Rect {
  return formatsFor(platform)
    .map((format) => safeZone(format))
    .reduce((acc, zone) => intersection(acc, zone), { x: 0, y: 0, w: 1, h: 1 });
}

const pct = (value: number): string => `${(value * 100).toFixed(1)}%`;
