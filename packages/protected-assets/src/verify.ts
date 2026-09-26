import sharp from 'sharp';
import { deltaE2000, meanLab, srgbToLab, type Lab } from './colour.js';
import { bounds, erode, intersectMasks, maskArea, maskFromRect, type Bounds } from './mask.js';
import { compareLabelText, readText } from './ocr.js';
import {
  cropRaster,
  decode,
  encode,
  greyscale,
  toPixels,
  type Raster,
  type Region,
} from './raster.js';
import { hammingDistance64, pHash, ssim } from './structure.js';
import type { CompositeOutput, Transform } from './composite.js';

/**
 * The four checks of section 15, all of which must pass before a human is even asked.
 *
 * They overlap on purpose, because they fail differently:
 *
 *   - **pixel identity** is exact and free, and is gone the moment anything re-encodes;
 *   - **label text** survives a re-encode and catches the change that matters most;
 *   - **structure** catches geometry moving when the text happens to read the same;
 *   - **colour** catches a tint the other three call identical, because they compare the
 *     product layer against itself and a warm environment changes how it reads.
 *
 * Every threshold here is **uncalibrated**. They are starting points, labelled as such, and
 * the same was true of the storefront harness's 90/5/40 for three runs.
 */
export interface VerificationThresholds {
  /** Per-channel tolerance for pixel identity. 0 demands bit-identical. */
  maxChannelDelta: number;
  /** Fraction of protected pixels permitted to exceed that tolerance. */
  maxDeviantFraction: number;
  /** Structural hash distance, out of 64 bits. */
  maxPHashDistance: number;
  /** Mean SSIM floor over the label region. */
  minSsim: number;
  /** Mean ΔE2000 ceiling inside the label. */
  maxDeltaE: number;
  /** Pixels eroded from the mask edge before comparing, to ignore antialiasing. */
  edgeErodePx: number;
}

export const DEFAULT_VERIFICATION_THRESHOLDS: VerificationThresholds = {
  maxChannelDelta: 2,
  maxDeviantFraction: 0.0005,
  maxPHashDistance: 4,
  minSsim: 0.95,
  maxDeltaE: 3,
  edgeErodePx: 1,
};

export type CheckName = 'pixel_identity' | 'label_text' | 'structure' | 'colour';

export interface CheckResult {
  check: CheckName;
  outcome: 'PASS' | 'FAIL' | 'UNAVAILABLE';
  /** What the check measured, for the report. */
  detail: string;
  measurements: Record<string, number | string | null>;
  /** Region of the composite the reviewer should look at, normalised. */
  region?: Region;
}

export interface VerificationReport {
  outcome: 'PASS' | 'FAIL' | 'INCOMPLETE';
  checks: CheckResult[];
  thresholds: VerificationThresholds;
  /** True when a check could not run, so a PASS would be overstating things. */
  incomplete: boolean;
  /** PNG highlighting every protected pixel that moved. Null when nothing moved. */
  diffPng: Buffer | null;
  calibration: string;
}

export const CALIBRATION_NOTE =
  'These thresholds are uncalibrated starting points, not derived values. A pass means the four checks found nothing at these settings; it is not a substitute for the human approval section 15 requires.';

export interface VerifyInput {
  masterPng: Uint8Array;
  composite: CompositeOutput;
  /** The label region on the master, normalised. */
  labelRegion: Region;
  /** Mean Lab of the label on the approved master, recorded at ingestion. */
  approvedColour?: Lab | null;
  thresholds?: Partial<VerificationThresholds>;
}

export async function verifyComposite(input: VerifyInput): Promise<VerificationReport> {
  const thresholds = { ...DEFAULT_VERIFICATION_THRESHOLDS, ...input.thresholds };
  const master = await decode(input.masterPng);
  const output = input.composite.raster;
  const transform = input.composite.spec.transform;

  const checks: CheckResult[] = [];

  const pixel = await checkPixelIdentity(master, input.composite, thresholds);
  checks.push(pixel.result);

  const labelOnMaster = toPixels(input.labelRegion, master.width, master.height);
  const labelOnOutput = labelInOutput(
    labelOnMaster,
    transform,
    input.composite.spec.transform.scale,
  );

  const pair = await prepareLabelPair(
    master,
    output,
    labelOnMaster,
    labelOnOutput,
    transform.scale,
    input.composite.spec.kernel,
  );
  checks.push(await checkLabelText(pair, input.labelRegion, transform.scale));
  checks.push(checkStructure(pair, thresholds, input.labelRegion));
  checks.push(checkColour(pair, thresholds, input.approvedColour ?? null, input.labelRegion));

  const failed = checks.filter((check) => check.outcome === 'FAIL');
  const unavailable = checks.filter((check) => check.outcome === 'UNAVAILABLE');

  return {
    // A check that could not run is not a pass. Section 3's honest-capability rule applied
    // to our own verification.
    outcome: failed.length > 0 ? 'FAIL' : unavailable.length > 0 ? 'INCOMPLETE' : 'PASS',
    checks,
    thresholds,
    incomplete: unavailable.length > 0,
    diffPng: pixel.diffPng,
    calibration: CALIBRATION_NOTE,
  };
}

// --- 1. pixel identity --------------------------------------------------------

async function checkPixelIdentity(
  master: Raster,
  composite: CompositeOutput,
  thresholds: VerificationThresholds,
): Promise<{ result: CheckResult; diffPng: Buffer | null }> {
  const transform = composite.spec.transform;
  const output = composite.raster;

  if (transform.scale !== 1) {
    return {
      result: {
        check: 'pixel_identity',
        outcome: 'UNAVAILABLE',
        detail: `The product layer was resampled at scale ${transform.scale} with the ${composite.spec.kernel} kernel, so the pixels cannot be identical. Compose at scale 1 for an exact comparison; the other three checks still apply.`,
        measurements: { scale: transform.scale, kernel: composite.spec.kernel },
      },
      diffPng: null,
    };
  }

  // Erode first: the silhouette edge is antialiased against transparency, and an edge pixel
  // differing is not the label having been redrawn.
  const protectedMask = erode(composite.placedMask, thresholds.edgeErodePx);
  const total = maskArea(protectedMask);

  let opaquePixels = 0;
  let blendedPixels = 0;
  let deviantOpaque = 0;
  let deviantBlended = 0;
  let maxOpaqueDelta = 0;
  let maxBlendedDelta = 0;
  let sumDelta = 0;
  const diff = new Uint8Array(output.width * output.height * 4);

  for (let y = 0; y < output.height; y += 1) {
    for (let x = 0; x < output.width; x += 1) {
      if ((protectedMask.data[y * output.width + x] ?? 0) === 0) continue;

      const masterX = x - transform.x;
      const masterY = y - transform.y;
      if (masterX < 0 || masterY < 0 || masterX >= master.width || masterY >= master.height)
        continue;

      const a = (masterY * master.width + masterX) * 4;
      const b = (y * output.width + x) * 4;
      const alpha = master.data[a + 3] ?? 0;

      let worst = 0;
      if (alpha === 255) {
        // Fully opaque: the label, the cap, the printed area. Here the composite must be the
        // master byte for byte, and no tolerance is needed or wanted.
        opaquePixels += 1;
        for (let channel = 0; channel < 3; channel += 1) {
          worst = Math.max(
            worst,
            Math.abs((master.data[a + channel] ?? 0) - (output.data[b + channel] ?? 0)),
          );
        }
        if (worst > 0) deviantOpaque += 1;
        maxOpaqueDelta = Math.max(maxOpaqueDelta, worst);
      } else {
        // Glass is semi-transparent by nature, so the composite is *meant* to differ from the
        // master here. What must hold is that it is exactly the deterministic alpha-over of
        // the approved master onto this environment — which is a stronger statement than
        // comparing colours, and the reason this check was rewritten.
        blendedPixels += 1;
        const weight = alpha / 255;
        for (let channel = 0; channel < 3; channel += 1) {
          const behind = environmentPixel(composite, x, y, channel);
          const expected = (master.data[a + channel] ?? 0) * weight + behind * (1 - weight);
          worst = Math.max(worst, Math.abs(expected - (output.data[b + channel] ?? 0)));
        }
        if (worst > thresholds.maxChannelDelta) deviantBlended += 1;
        maxBlendedDelta = Math.max(maxBlendedDelta, worst);
      }

      sumDelta += worst;
      if (worst > (alpha === 255 ? 0 : thresholds.maxChannelDelta)) {
        // Marked in the brand red, so the overlay reads as an alarm rather than a heatmap.
        diff[b] = 0xcf;
        diff[b + 1] = 0x1c;
        diff[b + 2] = 0x29;
        diff[b + 3] = 255;
      }
    }
  }

  const deviant = deviantOpaque + deviantBlended;
  const deviantFraction = total === 0 ? 1 : deviant / total;
  // Opaque pixels are held to exact identity; blended ones to the tolerance.
  const passed =
    total > 0 &&
    deviantOpaque === 0 &&
    deviantBlended / Math.max(1, blendedPixels) <= thresholds.maxDeviantFraction;

  return {
    result: {
      check: 'pixel_identity',
      outcome: passed ? 'PASS' : 'FAIL',
      detail:
        total === 0
          ? 'No protected pixels were found in the composite, so nothing could be compared.'
          : passed
            ? `${opaquePixels} opaque product pixels are identical to the master, and ${blendedPixels} semi-transparent ones match the deterministic alpha-over within ${thresholds.maxChannelDelta}/255.`
            : deviantOpaque > 0
              ? `${deviantOpaque} of ${opaquePixels} opaque product pixels differ from the master (worst ${maxOpaqueDelta}/255). Opaque product pixels are held to exact identity.`
              : `${deviantBlended} of ${blendedPixels} semi-transparent product pixels do not match the alpha-over of the approved master (worst ${maxBlendedDelta.toFixed(1)}/255).`,
      measurements: {
        protectedPixels: total,
        opaquePixels,
        blendedPixels,
        deviantOpaquePixels: deviantOpaque,
        deviantBlendedPixels: deviantBlended,
        deviantFraction: Number(deviantFraction.toFixed(6)),
        maxOpaqueDelta,
        maxBlendedDelta: Number(maxBlendedDelta.toFixed(2)),
        meanChannelDelta: total === 0 ? 0 : Number((sumDelta / total).toFixed(4)),
      },
    },
    diffPng:
      deviant > 0 ? await encode({ width: output.width, height: output.height, data: diff }) : null,
  };
}

/**
 * The environment behind a pixel, from the layer the composite was built on.
 *
 * Read from the resized environment the composite recorded, not the original, because the
 * comparison has to be against what was actually behind the product.
 */
function environmentPixel(
  composite: CompositeOutput,
  x: number,
  y: number,
  channel: number,
): number {
  const environment = composite.environmentRaster;
  if (!environment) return 0;
  const at = (y * environment.width + x) * 4;
  return environment.data[at + channel] ?? 0;
}

// --- the shared label pair ---------------------------------------------------

/**
 * One preparation for all three label checks.
 *
 * The first version let each check crop for itself, and they disagreed: the master crop
 * carries transparency where the composite carries the environment, so OCR read two
 * different images and the colour means were sampled over two different pixel sets. That
 * produced a ΔE of 8 and a one-character OCR difference on a composite that was, in fact,
 * byte-perfect.
 *
 * So both sides are cropped to the same bounds and every pixel that is not fully opaque on
 * the *master* is replaced with the same flat colour on both. What is left is exactly the
 * protected printed area, identical in framing on both sides, which is the only fair
 * comparison.
 */
interface LabelPair {
  master: Raster;
  candidate: Raster;
  /** Pixels that were fully opaque on the master, in crop order. */
  opaque: boolean[];
  opaqueCount: number;
}

const FLAT = [0x11, 0x11, 0x10] as const;

async function prepareLabelPair(
  master: Raster,
  output: Raster,
  labelOnMaster: Bounds,
  labelOnOutput: Bounds,
  scale: number,
  kernel: 'lanczos3' | 'nearest',
): Promise<LabelPair> {
  const candidateCrop = cropRaster(output, clampBounds(labelOnOutput, output));
  // When the product layer was resampled, the master's label region has to be resampled the
  // same way before the two can be compared at all. Pixel identity reports itself unavailable
  // in that case; the other three still apply, with resampling noise inside their thresholds.
  const masterCrop =
    scale === 1
      ? cropRaster(master, labelOnMaster)
      : await resizeRaster(
          cropRaster(master, labelOnMaster),
          candidateCrop.width,
          candidateCrop.height,
          kernel,
        );

  const width = Math.min(masterCrop.width, candidateCrop.width);
  const height = Math.min(masterCrop.height, candidateCrop.height);

  const a: Raster = { width, height, data: new Uint8Array(width * height * 4) };
  const b: Raster = { width, height, data: new Uint8Array(width * height * 4) };
  const opaque: boolean[] = [];
  let opaqueCount = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const at = index * 4;
      const fromMaster = (y * masterCrop.width + x) * 4;
      const fromCandidate = (y * candidateCrop.width + x) * 4;
      const isOpaque = (masterCrop.data[fromMaster + 3] ?? 0) === 255;
      opaque.push(isOpaque);
      if (isOpaque) opaqueCount += 1;

      for (let channel = 0; channel < 3; channel += 1) {
        const flat = FLAT[channel] ?? 0;
        a.data[at + channel] = isOpaque ? (masterCrop.data[fromMaster + channel] ?? 0) : flat;
        b.data[at + channel] = isOpaque ? (candidateCrop.data[fromCandidate + channel] ?? 0) : flat;
      }
      a.data[at + 3] = 255;
      b.data[at + 3] = 255;
    }
  }

  return { master: a, candidate: b, opaque, opaqueCount };
}

// --- 2. label text ------------------------------------------------------------

/**
 * Tesseract reads small type poorly, and a label crop is small type. Both sides are upscaled
 * identically before recognition — identically being the only thing that matters, since the
 * check compares the two reads rather than either against an expected string.
 */
const OCR_UPSCALE = 2;

async function checkLabelText(
  pair: LabelPair,
  region: Region,
  scale: number,
): Promise<CheckResult> {
  if (scale !== 1) {
    // Measured, not assumed: at a 0.527 downscale the same reader produced "APPLEWOOD GI"
    // from the master crop and "APPLEWOOD GL" from the composite crop — of identical content.
    // A check that fails on honest work is worse than no check, so it reports that it cannot
    // decide, and the pipeline composites renditions at scale 1 instead.
    return {
      check: 'label_text',
      outcome: 'UNAVAILABLE',
      detail: `The label was resampled at scale ${scale}. OCR reads identical content differently at different scales, so it cannot be decisive here. Composite a rendition of the master at its target size and verify at scale 1.`,
      measurements: { scale },
      region,
    };
  }

  const [masterCrop, candidateCrop] = await Promise.all([
    upscaleForOcr(pair.master),
    upscaleForOcr(pair.candidate),
  ]);
  const [masterText, outputText] = await Promise.all([
    readText(masterCrop),
    readText(candidateCrop),
  ]);

  if (!masterText.ok || !outputText.ok) {
    return {
      check: 'label_text',
      outcome: 'UNAVAILABLE',
      detail: !masterText.ok ? masterText.error : (outputText as { error: string }).error,
      measurements: {},
      region,
    };
  }

  const comparison = compareLabelText(masterText.value.text, outputText.value.text);

  return {
    check: 'label_text',
    outcome: comparison.matches ? 'PASS' : 'FAIL',
    detail: comparison.matches
      ? `The label reads the same in both: "${comparison.master}".`
      : `The label text changed. Master: "${comparison.master}". Composite: "${comparison.candidate}". Missing: ${comparison.differences.onlyInMaster.join(', ') || 'none'}. Added: ${comparison.differences.onlyInCandidate.join(', ') || 'none'}.`,
    measurements: {
      master: comparison.master,
      candidate: comparison.candidate,
      masterConfidence: Number(masterText.value.confidence.toFixed(1)),
      candidateConfidence: Number(outputText.value.confidence.toFixed(1)),
    },
    region,
  };
}

// --- 3. structure -------------------------------------------------------------

function checkStructure(
  pair: LabelPair,
  thresholds: VerificationThresholds,
  region: Region,
): CheckResult {
  const a = pair.master;
  const b = pair.candidate;

  const greyA = greyscale(a);
  const greyB = greyscale(b);

  const distance = hammingDistance64(
    pHash(greyA, a.width, a.height),
    pHash(greyB, b.width, b.height),
  );

  // SSIM needs matching dimensions; a size mismatch is itself a finding.
  const comparable = a.width === b.width && a.height === b.height;
  const similarity = comparable ? ssim(greyA, greyB, a.width, a.height) : 0;

  const passed = distance <= thresholds.maxPHashDistance && similarity >= thresholds.minSsim;

  return {
    check: 'structure',
    outcome: passed ? 'PASS' : 'FAIL',
    detail: !comparable
      ? `The label region is ${a.width}×${a.height} on the master and ${b.width}×${b.height} in the composite, so its geometry moved.`
      : passed
        ? `Structure holds: ${distance} of 64 hash bits differ, mean SSIM ${similarity.toFixed(4)}.`
        : `Structure moved: ${distance} of 64 hash bits differ (limit ${thresholds.maxPHashDistance}), mean SSIM ${similarity.toFixed(4)} (floor ${thresholds.minSsim}).`,
    measurements: {
      pHashDistance: distance,
      ssim: Number(similarity.toFixed(4)),
      comparable: comparable ? 1 : 0,
    },
    region,
  };
}

// --- 4. colour ----------------------------------------------------------------

function checkColour(
  pair: LabelPair,
  thresholds: VerificationThresholds,
  approved: Lab | null,
  region: Region,
): CheckResult {
  // Sampled over the pixels that were opaque on the master — the printed area itself, and
  // the same set on both sides.
  const masterLab = meanLab(samplesOf(pair.master, pair.opaque));
  const outputLab = meanLab(samplesOf(pair.candidate, pair.opaque));

  if (!masterLab || !outputLab) {
    return {
      check: 'colour',
      outcome: 'UNAVAILABLE',
      detail: 'The label region contained no opaque pixels to sample.',
      measurements: {},
      region,
    };
  }

  // Against the composite, and against the colour recorded at ingestion when there is one:
  // a master that has itself drifted is worth catching.
  const deltaToComposite = deltaE2000(masterLab, outputLab);
  const deltaToApproved = approved ? deltaE2000(approved, outputLab) : null;
  const worst = Math.max(deltaToComposite, deltaToApproved ?? 0);
  const passed = worst <= thresholds.maxDeltaE;

  return {
    check: 'colour',
    outcome: passed ? 'PASS' : 'FAIL',
    detail: passed
      ? `Label colour holds: ΔE2000 ${deltaToComposite.toFixed(2)} against the master${
          deltaToApproved === null
            ? ''
            : `, ${deltaToApproved.toFixed(2)} against the approved reference`
        }.`
      : `Label colour shifted: ΔE2000 ${worst.toFixed(2)} against a ceiling of ${thresholds.maxDeltaE}. A ΔE above about 2 is visible side by side.`,
    measurements: {
      deltaEToMaster: Number(deltaToComposite.toFixed(3)),
      deltaEToApproved: deltaToApproved === null ? null : Number(deltaToApproved.toFixed(3)),
      masterL: Number(masterLab.L.toFixed(2)),
      compositeL: Number(outputLab.L.toFixed(2)),
    },
    region,
  };
}

// --- helpers ------------------------------------------------------------------

async function resizeRaster(
  raster: Raster,
  width: number,
  height: number,
  kernel: 'lanczos3' | 'nearest',
): Promise<Raster> {
  const { data, info } = await sharp(Buffer.from(raster.data), {
    raw: { width: raster.width, height: raster.height, channels: 4 },
  })
    .resize({ width, height, kernel, fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data) };
}

async function upscaleForOcr(raster: Raster): Promise<Buffer> {
  return sharp(Buffer.from(raster.data), {
    raw: { width: raster.width, height: raster.height, channels: 4 },
  })
    .resize({
      width: raster.width * OCR_UPSCALE,
      height: raster.height * OCR_UPSCALE,
      kernel: 'lanczos3',
      fit: 'fill',
    })
    .png()
    .toBuffer();
}

function samplesOf(raster: Raster, selector?: boolean[]): { r: number; g: number; b: number }[] {
  const samples: { r: number; g: number; b: number }[] = [];
  for (let index = 0; index < raster.width * raster.height; index += 1) {
    const at = index * 4;
    if (selector) {
      if (!selector[index]) continue;
    } else if ((raster.data[at + 3] ?? 0) < 250) continue;
    samples.push({
      r: raster.data[at] ?? 0,
      g: raster.data[at + 1] ?? 0,
      b: raster.data[at + 2] ?? 0,
    });
  }
  return samples;
}

function labelInOutput(labelOnMaster: Bounds, transform: Transform, scale: number): Bounds {
  return {
    x: Math.round(labelOnMaster.x * scale) + transform.x,
    y: Math.round(labelOnMaster.y * scale) + transform.y,
    w: Math.round(labelOnMaster.w * scale),
    h: Math.round(labelOnMaster.h * scale),
  };
}

function clampBounds(region: Bounds, raster: Raster): Bounds {
  const x = Math.max(0, Math.min(raster.width - 1, region.x));
  const y = Math.max(0, Math.min(raster.height - 1, region.y));
  return {
    x,
    y,
    w: Math.max(1, Math.min(raster.width - x, region.w)),
    h: Math.max(1, Math.min(raster.height - y, region.h)),
  };
}

/** The mean Lab of the label on an approved master, recorded once at ingestion. */
export async function colourReferenceFor(
  masterPng: Uint8Array,
  labelRegion: Region,
): Promise<Lab | null> {
  const master = await decode(masterPng);
  // Same rule as the check: only the fully opaque printed area, so the reference and the
  // measurement are comparable.
  return meanLab(samplesOf(cropRaster(master, toPixels(labelRegion, master.width, master.height))));
}

export { maskFromRect, bounds, intersectMasks };
export type { Mask } from './raster.js';
export { srgbToLab, deltaE2000, type Lab };
