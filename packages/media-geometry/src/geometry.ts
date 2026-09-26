import type { Insets, PlatformFormat, Rect, TypeSpec } from './profiles.js';

/**
 * The geometry, as arithmetic.
 *
 * This is a port of the measurement model in `docs/spirithaus/tools/calibrate.mjs`, not of
 * its machinery. That tool drives a real browser because the *theme* owns the layout and
 * the only honest way to find the glyphs is to render them. Here the composition is ours,
 * so the type region is exact and the whole thing is closed-form — no browser, no
 * screenshot, and a test that runs in a millisecond.
 *
 * Three findings carry across, and each is load-bearing:
 *
 *   1. Measure per delivered aspect, never per asset. Over fifteen real frames the
 *      asset-level verdict had no discriminating power, because an asset's verdict is its
 *      worst viewport and the narrowest crop failed everything.
 *   2. Measure where the glyphs are, not a band. A band charged frames for brightness
 *      nobody reads over, and missed type that extended above it.
 *   3. Scrim obscuration is a difference, not an absolute. Testing whether a pixel is
 *      near-black reported SPIRITHAUS's own low-key house style as a defect on 25 of 25.
 */

/** A subject as a disc on the master, normalised. A point cannot be 72% visible. */
export interface Focal {
  x: number;
  y: number;
  /** Radius as a fraction of the shorter master edge. */
  r: number;
}

/** The visible rect of a master, normalised on the master, after a centred cover crop. */
export function coverCrop(masterAspect: number, deliveredAspect: number): Rect {
  if (masterAspect <= 0 || deliveredAspect <= 0) throw new Error('aspects must be positive');

  if (deliveredAspect > masterAspect) {
    // Delivered frame is wider: full width is kept, height is cropped.
    const h = masterAspect / deliveredAspect;
    return { x: 0, y: (1 - h) / 2, w: 1, h };
  }
  // Delivered frame is taller or equal: full height is kept, width is cropped.
  const w = deliveredAspect / masterAspect;
  return { x: (1 - w) / 2, y: 0, w, h: 1 };
}

/**
 * The type region in delivered-frame coordinates: the union of per-line glyph boxes,
 * dilated, and never the whole band.
 */
export function typeRegion(spec: TypeSpec, deliveredAspect: number): Rect {
  const lines = spec.lineWidths.length;
  if (lines === 0) return { x: 0, y: 1, w: 0, h: 0 };

  const widest = Math.max(...spec.lineWidths);
  const blockH = lines * spec.lineHeight;
  // One em is the line height; the dilation is symmetric.
  const dilateY = spec.dilateEm * spec.lineHeight;
  // Horizontal dilation is in the same em, converted through the aspect so it is the same
  // physical distance as the vertical one.
  const dilateX = dilateY * deliveredAspect;

  const top = 1 - spec.inset.y - blockH - dilateY;
  const height = blockH + dilateY * 2;

  if (spec.anchor === 'bottom-centre') {
    const width = widest + dilateX * 2;
    return { x: (1 - width) / 2, y: top, w: width, h: height };
  }
  if (spec.anchor === 'centre') {
    const width = widest + dilateX * 2;
    return { x: (1 - width) / 2, y: (1 - height) / 2, w: width, h: height };
  }
  return {
    x: Math.max(0, spec.inset.x - dilateX),
    y: top,
    w: Math.min(1, widest + dilateX * 2),
    h: height,
  };
}

/** The rect left once the platform's own furniture is excluded. */
export function safeRect(safe: Insets): Rect {
  return {
    x: safe.left,
    y: safe.top,
    w: 1 - safe.left - safe.right,
    h: 1 - safe.top - safe.bottom,
  };
}

export function intersection(a: Rect, b: Rect): Rect {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.w, b.x + b.w);
  const bottom = Math.min(a.y + a.h, b.y + b.h);
  return { x, y, w: Math.max(0, right - x), h: Math.max(0, bottom - y) };
}

export const area = (rect: Rect): number => Math.max(0, rect.w) * Math.max(0, rect.h);

/**
 * Samples the focal disc on a grid and reports how many samples fall inside `rect`.
 * A disc rather than a point, and a grid rather than a formula, so the same routine
 * answers "visible after the crop" and "under the type" identically.
 */
export function discCoverage(
  focal: Focal,
  rect: Rect,
  masterAspect: number,
  samplesPerAxis = 21,
): { inside: number; total: number; fraction: number; samples: { x: number; y: number }[] } {
  const samples: { x: number; y: number }[] = [];
  // The radius is a fraction of the shorter edge, so it is not isotropic in normalised
  // coordinates: on a wide master the same physical radius spans less normalised width.
  const rx = masterAspect >= 1 ? focal.r / masterAspect : focal.r;
  const ry = masterAspect >= 1 ? focal.r : focal.r * masterAspect;

  let inside = 0;
  let total = 0;
  const step = 2 / (samplesPerAxis - 1);
  for (let u = -1; u <= 1 + 1e-9; u += step) {
    for (let v = -1; v <= 1 + 1e-9; v += step) {
      if (u * u + v * v > 1) continue;
      const x = focal.x + u * rx;
      const y = focal.y + v * ry;
      total += 1;
      samples.push({ x, y });
      if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) inside += 1;
    }
  }

  return { inside, total, fraction: total === 0 ? 0 : inside / total, samples };
}

/** Maps a point on the master into the delivered frame. Outside 0–1 means cropped away. */
export function toDelivered(point: { x: number; y: number }, crop: Rect): { x: number; y: number } {
  return { x: (point.x - crop.x) / crop.w, y: (point.y - crop.y) / crop.h };
}

/**
 * The region that survives every delivered crop **and** clears the platform furniture:
 * where a subject can be placed and still be seen everywhere.
 */
/**
 * Where a subject can sit and still be seen on every surface: the intersection of every
 * delivered crop, each surface's own furniture mapped back onto the master, and the band
 * above our own headline.
 *
 * The type region is clipped rather than subtracted, because a rect minus a rect is not a
 * rect. For a bottom-anchored headline that is exact; for a centred one it would not be,
 * and the function says so rather than pretending.
 */
export function safeZone(format: PlatformFormat): Rect {
  let zone: Rect = { x: 0, y: 0, w: 1, h: 1 };

  for (const surface of format.deliveredAspects) {
    const crop = coverCrop(format.aspect, surface.aspect);
    const furniture = safeRect(surface.safe);
    // The surface's furniture is in delivered coordinates; map it back onto the master
    // through that surface's own crop.
    zone = intersection(zone, {
      x: crop.x + furniture.x * crop.w,
      y: crop.y + furniture.y * crop.h,
      w: furniture.w * crop.w,
      h: furniture.h * crop.h,
    });
  }

  if (format.type.anchor === 'bottom-left' || format.type.anchor === 'bottom-centre') {
    const type = typeRegion(format.type, format.aspect);
    const bottom = Math.min(zone.y + zone.h, type.y);
    zone = { ...zone, h: Math.max(0, bottom - zone.y) };
  }

  return zone;
}

/**
 * Where to put the product so it lands inside the safe zone.
 *
 * Closes the loop between measurement and composition: the composite step asks this for a
 * transform rather than placing the bottle by eye. A frame rendered without it put the label
 * squarely under the headline — which the measurement engine would have failed, and which one
 * look at a rendered frame made obvious.
 */
export interface Placement {
  /** Top-left of the product layer in output pixels. */
  x: number;
  y: number;
  scale: number;
  /** Where the product's centre ended up, normalised, for the focal record. */
  focal: { x: number; y: number };
  /** True when the product had to be scaled down to fit the zone. */
  scaledToFit: boolean;
}

export function placeInSafeZone(input: {
  format: PlatformFormat;
  output: { width: number; height: number };
  /** The product's own pixel size. */
  product: { width: number; height: number };
  /** Fraction of the safe zone's height the product should occupy. */
  fill?: number;
}): Placement {
  const zone = safeZone(input.format);
  const fill = input.fill ?? 0.9;

  const zonePx = {
    x: zone.x * input.output.width,
    y: zone.y * input.output.height,
    w: zone.w * input.output.width,
    h: zone.h * input.output.height,
  };

  const scale = Math.min(
    (zonePx.h * fill) / input.product.height,
    (zonePx.w * fill) / input.product.width,
    1,
  );

  const width = input.product.width * scale;
  const height = input.product.height * scale;
  const x = Math.round(zonePx.x + (zonePx.w - width) / 2);
  const y = Math.round(zonePx.y + (zonePx.h - height) / 2);

  return {
    x,
    y,
    scale,
    focal: {
      x: (x + width / 2) / input.output.width,
      y: (y + height / 2) / input.output.height,
    },
    scaledToFit: scale < 1,
  };
}
