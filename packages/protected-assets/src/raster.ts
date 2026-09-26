import sharp from 'sharp';

/**
 * Raw rasters, so every operation below is arithmetic on bytes rather than a library call
 * whose behaviour might change. A PNG round-trip is lossless, so encoding only happens at
 * the edges: storage, and the payload handed to a provider.
 */
export interface Raster {
  width: number;
  height: number;
  /** RGBA, 4 bytes per pixel. */
  data: Uint8Array;
}

/** Single-channel coverage, 0 or 255. A mask is not a greyscale image. */
export interface Mask {
  width: number;
  height: number;
  data: Uint8Array;
}

export async function decode(png: Uint8Array | Buffer): Promise<Raster> {
  const { data, info } = await sharp(Buffer.from(png))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data) };
}

export async function encode(raster: Raster): Promise<Buffer> {
  return sharp(Buffer.from(raster.data), {
    raw: { width: raster.width, height: raster.height, channels: 4 },
  })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

export async function encodeMask(mask: Mask): Promise<Buffer> {
  return sharp(Buffer.from(mask.data), {
    raw: { width: mask.width, height: mask.height, channels: 1 },
  })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

export const pixelIndex = (raster: Raster | Mask, x: number, y: number, channels: number): number =>
  (y * raster.width + x) * channels;

/** Relative luminance, 0–1, from sRGB bytes. */
export function luminance(r: number, g: number, b: number): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Greyscale bytes, for the structural comparisons. */
export function greyscale(raster: Raster): Uint8Array {
  const out = new Uint8Array(raster.width * raster.height);
  for (let index = 0; index < out.length; index += 1) {
    const at = index * 4;
    // Rec. 601 luma: the conventional choice for perceptual structure comparisons.
    out[index] = Math.round(
      0.299 * (raster.data[at] ?? 0) +
        0.587 * (raster.data[at + 1] ?? 0) +
        0.114 * (raster.data[at + 2] ?? 0),
    );
  }
  return out;
}

export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Converts a normalised region to whole pixels, clamped to the raster. */
export function toPixels(region: Region, width: number, height: number): Region {
  const x = Math.max(0, Math.round(region.x * width));
  const y = Math.max(0, Math.round(region.y * height));
  return {
    x,
    y,
    w: Math.min(width - x, Math.round(region.w * width)),
    h: Math.min(height - y, Math.round(region.h * height)),
  };
}

export function cropRaster(raster: Raster, region: Region): Raster {
  const out = new Uint8Array(region.w * region.h * 4);
  for (let row = 0; row < region.h; row += 1) {
    const from = ((region.y + row) * raster.width + region.x) * 4;
    out.set(raster.data.subarray(from, from + region.w * 4), row * region.w * 4);
  }
  return { width: region.w, height: region.h, data: out };
}

/**
 * Re-encodes any decodable image as PNG.
 *
 * The CDN serves whatever was uploaded — JPEG, WebP, PNG. A protected master has to be PNG,
 * because a JPEG has no alpha to composite with and every later check is defined over RGBA. This
 * runs before the digest is taken, so the digest identifies the bytes the pipeline actually holds.
 */
export async function toPng(bytes: Uint8Array): Promise<Uint8Array> {
  return sharp(Buffer.from(bytes)).png({ compressionLevel: 9 }).toBuffer();
}

/**
 * Crops to a region and flattens onto a solid colour, for reading.
 *
 * OCR sees transparency as black, which turns pale label text on a cut-out bottle into nothing.
 * Flattening onto white first is what makes the read possible; the colour is the caller's choice
 * because it changes what OCR sees.
 */
export async function cropForReading(
  png: Uint8Array,
  region: { x: number; y: number; w: number; h: number },
  background = '#ffffff',
  /**
   * Minimum width to present to OCR. Tesseract needs glyphs of a certain pixel height, and a
   * narrow bottle inside a square packshot gives it nothing: a Penfolds Grange crops to 200px
   * wide, where OCR finds 2 words. Upscaled to 600, the same crop yields 63.
   *
   * This resamples what is *read*, never what is composited. ADR 0009 forbids resampling the
   * protected layer because it destroys the checks; enlarging a copy to read text off it changes
   * no stored artwork and no digest.
   */
  minWidth = 600,
): Promise<Uint8Array> {
  const pipeline = sharp(Buffer.from(png))
    .extract({ left: region.x, top: region.y, width: region.w, height: region.h })
    .flatten({ background });

  if (region.w < minWidth) {
    pipeline.resize({ width: minWidth, kernel: 'lanczos3' }).greyscale().normalise();
  }

  return pipeline.png().toBuffer();
}
