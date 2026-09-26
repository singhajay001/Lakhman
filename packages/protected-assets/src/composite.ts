import sharp from 'sharp';
import type { OverlayOptions } from 'sharp';
import { dilate, invert, maskFromAlpha } from './mask.js';
import { decode, encode, encodeMask, type Mask, type Raster } from './raster.js';

/**
 * The composite (section 15).
 *
 * The verified product pixels are laid over the generated environment by an alpha-over, with
 * no model anywhere in the path. Shadow and reflection are generated *layers placed beneath*
 * the product, never paint applied to it — which is the difference between an environment
 * that touches the bottle and one that surrounds it.
 *
 * Reproducible from (master, mask, environment, transform), and that tuple is stored, so any
 * asset can be rebuilt later and re-verified.
 */
export interface Transform {
  /** Top-left placement of the product layer in the output, in whole pixels. */
  x: number;
  y: number;
  /**
   * Scale applied to the master. 1 means no resampling, and therefore a bit-identical
   * product layer — which is why the pipeline prefers composing at the master's own size.
   */
  scale: number;
}

export interface CompositeSpec {
  output: { width: number; height: number };
  transform: Transform;
  /** Resampling kernel, recorded because it changes the bytes. */
  kernel: 'lanczos3' | 'nearest';
}

export const DEFAULT_KERNEL = 'lanczos3' as const;

export interface CompositeInput {
  /** The approved master, with alpha. */
  masterPng: Uint8Array;
  /** The generated environment, at output size. */
  environmentPng: Uint8Array;
  /** Optional shadow layer, composited under the product. */
  shadowPng?: Uint8Array;
  spec: CompositeSpec;
}

export interface CompositeOutput {
  png: Buffer;
  raster: Raster;
  /** The product mask in output coordinates: where the protected pixels landed. */
  placedMask: Mask;
  /**
   * The environment as it was actually laid down, at output size. Kept because the
   * verification pass has to recompute the alpha-over behind semi-transparent glass, and
   * the original environment may have been a different size.
   */
  environmentRaster: Raster;
  spec: CompositeSpec;
}

export async function composite(input: CompositeInput): Promise<CompositeOutput> {
  const master = await decode(input.masterPng);
  const scaled =
    input.spec.transform.scale === 1
      ? input.masterPng
      : await sharp(Buffer.from(input.masterPng))
          .resize({
            width: Math.round(master.width * input.spec.transform.scale),
            height: Math.round(master.height * input.spec.transform.scale),
            kernel: input.spec.kernel,
            fit: 'fill',
          })
          .png()
          .toBuffer();

  const layers: OverlayOptions[] = [];
  if (input.shadowPng) layers.push({ input: Buffer.from(input.shadowPng), top: 0, left: 0 });
  layers.push({
    input: Buffer.from(scaled),
    top: input.spec.transform.y,
    left: input.spec.transform.x,
  });

  const environmentPng = await sharp(Buffer.from(input.environmentPng))
    .resize({ width: input.spec.output.width, height: input.spec.output.height, fit: 'cover' })
    .png()
    .toBuffer();

  const png = await sharp(environmentPng).composite(layers).png({ compressionLevel: 9 }).toBuffer();

  const raster = await decode(png);
  const placedMask = await placeMask(await decode(scaled), input.spec, raster.width, raster.height);

  return {
    png,
    raster,
    placedMask,
    environmentRaster: await decode(environmentPng),
    spec: input.spec,
  };
}

/** The product mask, moved into output coordinates. */
async function placeMask(
  scaledMaster: Raster,
  spec: CompositeSpec,
  width: number,
  height: number,
): Promise<Mask> {
  const source = maskFromAlpha(scaledMaster);
  const data = new Uint8Array(width * height);
  for (let y = 0; y < source.height; y += 1) {
    const targetY = y + spec.transform.y;
    if (targetY < 0 || targetY >= height) continue;
    for (let x = 0; x < source.width; x += 1) {
      const targetX = x + spec.transform.x;
      if (targetX < 0 || targetX >= width) continue;
      data[targetY * width + targetX] = source.data[y * source.width + x] ?? 0;
    }
  }
  return { width, height, data };
}

/**
 * The mask handed to an image provider: white where it may paint, black where it may not.
 *
 * The protected region is dilated first, so the model's own feathering cannot bleed across
 * the silhouette. Three pixels is the default; two to four is the useful range, and below two
 * a halo appears at the edge that no verification check would attribute to the label.
 */
export const DEFAULT_DILATE_PX = 3;

export async function inpaintMask(
  masterPng: Uint8Array,
  dilatePx = DEFAULT_DILATE_PX,
): Promise<{ png: Buffer; mask: Mask; dilatePx: number }> {
  const master = await decode(masterPng);
  const product = maskFromAlpha(master);
  const buffered = dilate(product, dilatePx);
  const paintable = invert(buffered);
  return { png: await encodeMask(paintable), mask: paintable, dilatePx };
}

export { encode, encodeMask };

/**
 * A rendition of an approved master at a target size.
 *
 * Resampling is a deliberate, recorded, verifiable step rather than something hidden inside
 * every composite. The reason is measurable: at a downscale the pixel-identity check cannot
 * run, OCR reads identical content two different ways, and the structural check does not
 * separate a changed digit from an honest resample (SSIM 0.9983 against 0.9998). So a
 * composite that needs the product smaller uses a rendition, approves it once, and composites
 * it at scale 1 — where all four checks are decisive again.
 */
export interface Rendition {
  png: Buffer;
  width: number;
  height: number;
  kernel: CompositeSpec['kernel'];
  /** What it was derived from, so the chain back to the approved master is recorded. */
  sourceDigest: string;
}

export async function createRendition(
  masterPng: Uint8Array,
  target: { width: number; height: number },
  kernel: CompositeSpec['kernel'] = DEFAULT_KERNEL,
  sourceDigest = '',
): Promise<Rendition> {
  const png = await sharp(Buffer.from(masterPng))
    .resize({ width: target.width, height: target.height, kernel, fit: 'fill' })
    .png({ compressionLevel: 9 })
    .toBuffer();

  return { png, width: target.width, height: target.height, kernel, sourceDigest };
}
