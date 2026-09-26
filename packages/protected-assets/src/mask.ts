import { pixelIndex, type Mask, type Raster } from './raster.js';

/**
 * The protected region (section 15).
 *
 * Two masks, not one: the whole product, and the label drawn tighter. They answer different
 * questions — "did anything of the bottle change" and "does the label still say what it
 * said" — and a single mask would let a label change hide inside a tolerance set for glass.
 */

/** Everything with meaningful alpha is product. */
export function maskFromAlpha(raster: Raster, alphaThreshold = 8): Mask {
  const data = new Uint8Array(raster.width * raster.height);
  for (let index = 0; index < data.length; index += 1) {
    data[index] = (raster.data[index * 4 + 3] ?? 0) >= alphaThreshold ? 255 : 0;
  }
  return { width: raster.width, height: raster.height, data };
}

/**
 * Grows the mask by `radius` pixels, with a square structuring element.
 *
 * The inpainting mask handed to a provider is the inverse of a **dilated** product mask, so
 * the model may not paint within `radius` pixels of the bottle. Without that buffer, the
 * generator's own feathering bleeds across the silhouette and the composite shows a halo
 * that no verification check would call a label change. Three pixels by default.
 */
export function dilate(mask: Mask, radius: number): Mask {
  if (radius <= 0) return { ...mask, data: new Uint8Array(mask.data) };
  const out = new Uint8Array(mask.data.length);

  // Separable: a square structuring element is a horizontal pass then a vertical one.
  const horizontal = new Uint8Array(mask.data.length);
  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      let hit = 0;
      for (let dx = -radius; dx <= radius && hit === 0; dx += 1) {
        const sx = x + dx;
        if (sx < 0 || sx >= mask.width) continue;
        if ((mask.data[y * mask.width + sx] ?? 0) > 0) hit = 255;
      }
      horizontal[y * mask.width + x] = hit;
    }
  }
  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      let hit = 0;
      for (let dy = -radius; dy <= radius && hit === 0; dy += 1) {
        const sy = y + dy;
        if (sy < 0 || sy >= mask.height) continue;
        if ((horizontal[sy * mask.width + x] ?? 0) > 0) hit = 255;
      }
      out[y * mask.width + x] = hit;
    }
  }

  return { width: mask.width, height: mask.height, data: out };
}

/**
 * Shrinks the mask. The pixel-identity check erodes by one before comparing, because the
 * silhouette edge is antialiased and a resample moves it by a fraction of a pixel — an edge
 * pixel differing is not the label having been redrawn.
 */
export function erode(mask: Mask, radius: number): Mask {
  if (radius <= 0) return { ...mask, data: new Uint8Array(mask.data) };
  const inverted = invert(mask);
  return invert(dilate(inverted, radius));
}

export function invert(mask: Mask): Mask {
  const data = new Uint8Array(mask.data.length);
  for (let index = 0; index < data.length; index += 1)
    data[index] = (mask.data[index] ?? 0) > 0 ? 0 : 255;
  return { width: mask.width, height: mask.height, data };
}

export function maskArea(mask: Mask): number {
  let count = 0;
  for (const value of mask.data) if (value > 0) count += 1;
  return count;
}

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function bounds(mask: Mask): Bounds | null {
  let minX = mask.width;
  let minY = mask.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      if ((mask.data[y * mask.width + x] ?? 0) === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** A mask covering a rectangle, for the label region. */
export function maskFromRect(width: number, height: number, rect: Bounds): Mask {
  const data = new Uint8Array(width * height);
  for (let y = rect.y; y < Math.min(height, rect.y + rect.h); y += 1) {
    for (let x = rect.x; x < Math.min(width, rect.x + rect.w); x += 1) {
      data[y * width + x] = 255;
    }
  }
  return { width, height, data };
}

export function intersectMasks(a: Mask, b: Mask): Mask {
  if (a.width !== b.width || a.height !== b.height) throw new Error('masks differ in size');
  const data = new Uint8Array(a.data.length);
  for (let index = 0; index < data.length; index += 1) {
    data[index] = (a.data[index] ?? 0) > 0 && (b.data[index] ?? 0) > 0 ? 255 : 0;
  }
  return { width: a.width, height: a.height, data };
}

/** True where the mask covers the pixel. */
export const covered = (mask: Mask, x: number, y: number): boolean =>
  (mask.data[pixelIndex(mask, x, y, 1)] ?? 0) > 0;
