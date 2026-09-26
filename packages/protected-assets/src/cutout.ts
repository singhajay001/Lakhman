import { decode, encode, type Raster } from './raster.js';
import { bounds, maskFromAlpha } from './mask.js';

/**
 * Giving an opaque packshot a transparent background, without leaving a halo.
 *
 * A packshot photographed on white has no alpha, so compositing it over a dark environment would
 * paste a white rectangle. Cutting it out is easy; cutting it out *without a halo* is the part
 * worth writing down.
 *
 * Every pixel along the bottle's edge is a blend of the bottle and the backdrop it was shot on:
 *
 *     C = a·F + (1 - a)·B
 *
 * Making those pixels fully opaque keeps the backdrop's contribution, and over a dark environment
 * that reads as a bright fringe. Two honest responses exist: drop the blended pixels (a matte
 * choke, which shaves a pixel off a silhouette this pipeline exists to preserve), or solve for F.
 * This solves for F. `a` comes from how far the pixel has travelled from the backdrop toward the
 * nearest interior colour, and the backdrop's contribution is then removed:
 *
 *     F = (C - (1 - a)·B) / a
 *
 * The result is verified rather than asserted: `haloBrightness` measures the edge against the
 * interior over black, and a test holds it to what was measured on a real packshot.
 *
 * What this will not do is guess. A lifestyle plate has no plain backdrop to subtract, so the
 * border uniformity is checked first and a non-plain background is refused with its measurement.
 * Inventing a silhouette for a product image is exactly the kind of quiet alteration section 15
 * forbids.
 */

export interface CutoutOptions {
  /**
   * How far a pixel may sit from the sampled backdrop and still count as backdrop, as a
   * Euclidean distance in 0-255 RGB. 32 accepts JPEG mosquito noise and a soft vignette without
   * reaching into a pale label.
   */
  tolerance?: number;
  /** Maximum standard deviation across the border ring before the backdrop is called non-plain. */
  maxBorderStdDev?: number;
  /** Width of the band, in pixels, where partial alpha is solved for. */
  edgeBand?: number;
}

export const DEFAULT_CUTOUT_OPTIONS: Required<CutoutOptions> = {
  tolerance: 32,
  maxBorderStdDev: 12,
  edgeBand: 2,
};

export interface CutoutResult {
  /** The cut-out image, or the input unchanged when nothing was done. */
  png: Uint8Array;
  applied: boolean;
  /** Why it was or was not applied, in words a reviewer can act on. */
  reason: string;
  /** The backdrop that was subtracted, where one was found. */
  background: { r: number; g: number; b: number } | null;
  measurements: {
    borderStdDev: number;
    /** Fraction of the frame kept as subject. */
    coverage: number;
    /** Pixels given partial alpha and decontaminated. */
    edgePixels: number;
  };
}

/** True when the image already carries a cutout worth trusting. */
export function hasUsableAlpha(raster: Raster, minTransparentFraction = 0.02): boolean {
  const total = raster.width * raster.height;
  let transparent = 0;
  for (let index = 0; index < total; index += 1) {
    if ((raster.data[index * 4 + 3] ?? 255) < 250) transparent += 1;
  }
  return transparent / total >= minTransparentFraction;
}

interface BorderSample {
  mean: { r: number; g: number; b: number };
  stdDev: number;
}

/** The backdrop, sampled from a one-pixel ring around the frame. */
function sampleBorder(raster: Raster): BorderSample {
  const samples: number[][] = [];
  const push = (x: number, y: number): void => {
    const i = (y * raster.width + x) * 4;
    samples.push([raster.data[i] ?? 0, raster.data[i + 1] ?? 0, raster.data[i + 2] ?? 0]);
  };

  for (let x = 0; x < raster.width; x += 1) {
    push(x, 0);
    push(x, raster.height - 1);
  }
  for (let y = 1; y < raster.height - 1; y += 1) {
    push(0, y);
    push(raster.width - 1, y);
  }

  const mean = { r: 0, g: 0, b: 0 };
  for (const [r, g, b] of samples) {
    mean.r += r ?? 0;
    mean.g += g ?? 0;
    mean.b += b ?? 0;
  }
  mean.r /= samples.length;
  mean.g /= samples.length;
  mean.b /= samples.length;

  let variance = 0;
  for (const [r, g, b] of samples) {
    variance += ((r ?? 0) - mean.r) ** 2 + ((g ?? 0) - mean.g) ** 2 + ((b ?? 0) - mean.b) ** 2;
  }

  return { mean, stdDev: Math.sqrt(variance / (samples.length * 3)) };
}

const distance = (
  r: number,
  g: number,
  b: number,
  to: { r: number; g: number; b: number },
): number => Math.sqrt((r - to.r) ** 2 + (g - to.g) ** 2 + (b - to.b) ** 2);

export async function cutout(png: Uint8Array, options: CutoutOptions = {}): Promise<CutoutResult> {
  const opts = { ...DEFAULT_CUTOUT_OPTIONS, ...options };
  const raster = await decode(png);
  const { width, height } = raster;
  const total = width * height;

  if (hasUsableAlpha(raster)) {
    return {
      png,
      applied: false,
      reason: 'The image already carries an alpha channel, so it was ingested as supplied.',
      background: null,
      measurements: { borderStdDev: 0, coverage: 0, edgePixels: 0 },
    };
  }

  const border = sampleBorder(raster);
  if (border.stdDev > opts.maxBorderStdDev) {
    return {
      png,
      applied: false,
      reason: `The border of this image varies too much to be a plain backdrop (standard deviation ${border.stdDev.toFixed(1)}, limit ${opts.maxBorderStdDev}). It looks like a lifestyle or in-situ photograph rather than a packshot. Nothing was cut out, because guessing a silhouette would alter the product.`,
      background: null,
      measurements: { borderStdDev: border.stdDev, coverage: 0, edgePixels: 0 },
    };
  }

  // Flood fill inward from the frame edge. A fill rather than a global threshold, so a white
  // label *inside* the bottle is kept while the white around it is removed.
  const isBackground = new Uint8Array(total);
  const stack: number[] = [];
  const consider = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (isBackground[p]) return;
    const i = p * 4;
    if (
      distance(raster.data[i] ?? 0, raster.data[i + 1] ?? 0, raster.data[i + 2] ?? 0, border.mean) >
      opts.tolerance
    ) {
      return;
    }
    isBackground[p] = 1;
    stack.push(p);
  };

  for (let x = 0; x < width; x += 1) {
    consider(x, 0);
    consider(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    consider(0, y);
    consider(width - 1, y);
  }

  while (stack.length > 0) {
    const p = stack.pop() as number;
    const x = p % width;
    const y = (p - x) / width;
    consider(x - 1, y);
    consider(x + 1, y);
    consider(x, y - 1);
    consider(x, y + 1);
  }

  let subject = 0;
  for (let p = 0; p < total; p += 1) if (!isBackground[p]) subject += 1;

  const coverage = subject / total;
  if (coverage < 0.005) {
    return {
      png,
      applied: false,
      reason: `Cutting out the backdrop would leave ${(coverage * 100).toFixed(2)}% of the frame, which is not a product. Nothing was cut out.`,
      background: border.mean,
      measurements: { borderStdDev: border.stdDev, coverage, edgePixels: 0 },
    };
  }
  if (coverage > 0.995) {
    return {
      png,
      applied: false,
      reason: `Nothing around the edge matched a plain backdrop, so there is nothing to cut out (${(coverage * 100).toFixed(1)}% of the frame would be kept).`,
      background: border.mean,
      measurements: { borderStdDev: border.stdDev, coverage, edgePixels: 0 },
    };
  }

  const out = new Uint8Array(raster.data);
  for (let p = 0; p < total; p += 1) {
    if (isBackground[p]) {
      out[p * 4 + 3] = 0;
      // Zero the colour too: a transparent pixel carrying the backdrop's colour is a halo waiting
      // for a resampler to average it back in.
      out[p * 4] = 0;
      out[p * 4 + 1] = 0;
      out[p * 4 + 2] = 0;
    } else {
      out[p * 4 + 3] = 255;
    }
  }

  // Solve for partial alpha in the band next to the backdrop, and subtract the backdrop's
  // contribution from what is left.
  const nearBackground = (x: number, y: number, radius: number): boolean => {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        if (isBackground[ny * width + nx]) return true;
      }
    }
    return false;
  };

  /** The nearest colour that is definitely the product, used as F in the alpha estimate. */
  const interiorReference = (x: number, y: number): { r: number; g: number; b: number } | null => {
    for (let radius = opts.edgeBand + 1; radius <= opts.edgeBand + 4; radius += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const p = ny * width + nx;
          if (isBackground[p] || nearBackground(nx, ny, opts.edgeBand)) continue;
          const i = p * 4;
          return {
            r: raster.data[i] ?? 0,
            g: raster.data[i + 1] ?? 0,
            b: raster.data[i + 2] ?? 0,
          };
        }
      }
    }
    return null;
  };

  let edgePixels = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = y * width + x;
      if (isBackground[p]) continue;
      if (!nearBackground(x, y, opts.edgeBand)) continue;

      const i = p * 4;
      const c = {
        r: raster.data[i] ?? 0,
        g: raster.data[i + 1] ?? 0,
        b: raster.data[i + 2] ?? 0,
      };
      const reference = interiorReference(x, y);
      if (!reference) continue;

      const span = distance(reference.r, reference.g, reference.b, border.mean);
      // With the product the same colour as the backdrop there is no blend to solve; leaving the
      // pixel opaque is the honest outcome, since there is nothing to subtract.
      if (span < 1) continue;

      const travelled = distance(c.r, c.g, c.b, border.mean);
      const alpha = Math.min(1, Math.max(0, travelled / span));
      if (alpha >= 0.999) continue;
      if (alpha <= 0.001) {
        out[i + 3] = 0;
        out[i] = 0;
        out[i + 1] = 0;
        out[i + 2] = 0;
        edgePixels += 1;
        continue;
      }

      const unblend = (channel: number, background: number): number =>
        Math.min(255, Math.max(0, Math.round((channel - (1 - alpha) * background) / alpha)));

      out[i] = unblend(c.r, border.mean.r);
      out[i + 1] = unblend(c.g, border.mean.g);
      out[i + 2] = unblend(c.b, border.mean.b);
      out[i + 3] = Math.round(alpha * 255);
      edgePixels += 1;
    }
  }

  const encoded = await encode({ width, height, data: out });

  return {
    png: encoded,
    applied: true,
    reason: `Cut out from a plain backdrop (standard deviation ${border.stdDev.toFixed(1)}); ${edgePixels} edge pixels were given partial alpha and had the backdrop subtracted.`,
    background: border.mean,
    measurements: { borderStdDev: border.stdDev, coverage, edgePixels },
  };
}

/**
 * How much brighter the subject's edge is than its interior when composited over black.
 *
 * This is the halo, measured. A clean cutout sits near or below 1: edges are usually darker than
 * the body because they are partly transparent. A white fringe pushes it well above 1.
 */
export async function haloBrightness(png: Uint8Array, band = 2): Promise<number> {
  const raster = await decode(png);
  const { width, height } = raster;
  const alphaAt = (x: number, y: number): number => raster.data[(y * width + x) * 4 + 3] ?? 0;

  const nearTransparent = (x: number, y: number): boolean => {
    for (let dy = -band; dy <= band; dy += 1) {
      for (let dx = -band; dx <= band; dx += 1) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) return true;
        if (alphaAt(nx, ny) < 8) return true;
      }
    }
    return false;
  };

  let edgeSum = 0;
  let edgeCount = 0;
  let coreSum = 0;
  let coreCount = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = alphaAt(x, y);
      if (alpha < 8) continue;
      const i = (y * width + x) * 4;
      // Over black the composite is simply alpha times the colour.
      const over =
        (((raster.data[i] ?? 0) + (raster.data[i + 1] ?? 0) + (raster.data[i + 2] ?? 0)) / 3) *
        (alpha / 255);
      if (nearTransparent(x, y)) {
        edgeSum += over;
        edgeCount += 1;
      } else {
        coreSum += over;
        coreCount += 1;
      }
    }
  }

  if (edgeCount === 0 || coreCount === 0) return 0;
  const core = coreSum / coreCount;
  if (core < 1) return 0;
  return edgeSum / edgeCount / core;
}

/**
 * Trims a cut-out master down to its subject, with a small margin.
 *
 * A packshot exported with the bottle sitting inside a square canvas is mostly empty: a 1600x1600
 * frame holding a 649x1437 bottle is 63% nothing. That padding is not neutral. The compositor
 * places the *frame* in a safe zone, so the transparent margin is scaled to fit and the bottle
 * comes out smaller than the zone allows and centred on the canvas rather than on itself. Measured
 * on this catalogue, that costs about a tenth of the available height on a Reel.
 *
 * So the master is defined as the product: trimmed once at ingestion, before the digest is taken,
 * which makes the digest identify the bytes the pipeline actually holds. Nothing is resampled and
 * no pixel of the subject is touched — this is a crop of empty space, and it refuses to run on an
 * image with no alpha to trim by.
 */
export async function trimToSubject(
  png: Uint8Array,
  marginPx = 8,
): Promise<{
  png: Uint8Array;
  trimmed: boolean;
  from: { width: number; height: number };
  to: { width: number; height: number };
}> {
  const raster = await decode(png);
  const from = { width: raster.width, height: raster.height };

  const box = bounds(maskFromAlpha(raster));
  if (!box) return { png, trimmed: false, from, to: from };

  const left = Math.max(0, box.x - marginPx);
  const top = Math.max(0, box.y - marginPx);
  const right = Math.min(raster.width, box.x + box.w + marginPx);
  const bottom = Math.min(raster.height, box.y + box.h + marginPx);
  const width = right - left;
  const height = bottom - top;

  if (width <= 0 || height <= 0) return { png, trimmed: false, from, to: from };
  if (width === raster.width && height === raster.height) {
    return { png, trimmed: false, from, to: from };
  }

  const out = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sourceRow = (y + top) * raster.width;
    for (let x = 0; x < width; x += 1) {
      const source = (sourceRow + x + left) * 4;
      const target = (y * width + x) * 4;
      out[target] = raster.data[source] ?? 0;
      out[target + 1] = raster.data[source + 1] ?? 0;
      out[target + 2] = raster.data[source + 2] ?? 0;
      out[target + 3] = raster.data[source + 3] ?? 0;
    }
  }

  return {
    png: await encode({ width, height, data: out }),
    trimmed: true,
    from,
    to: { width, height },
  };
}
