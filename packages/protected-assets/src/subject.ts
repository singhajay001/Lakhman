import type { Raster } from './raster.js';
import { bounds, maskFromAlpha } from './mask.js';

/**
 * Checking that a packshot actually shows one product.
 *
 * The store's image architecture says image #1 is a clean bottle on a plain background. Mostly it
 * is. It is also, in this catalogue, sometimes a bottle standing next to its gift box, and
 * sometimes a bottle whose cutout left a detached fragment of shadow behind. Ingesting either as a
 * "protected product master" would mean measuring, masking and colour-referencing the wrong thing.
 *
 * Aspect ratio is the obvious test and it is not good enough. Measured across 27 of this store's
 * own packshots: single bottles run 0.223 to 0.452, but a single can reads 0.589 while a
 * bottle-beside-its-box reads 0.564 — the two classes overlap, so any aspect threshold either
 * flags the can or misses the box.
 *
 * The column occupancy profile does separate them. A single product is one vertical mass; a second
 * object leaves a valley between two peaks. Over the same 27 packshots:
 *
 *     Maybe Sammy (cutout left a shadow fragment)   0.917
 *     Talisker 10 (bottle beside its box)           0.444
 *     Lark Devil's Storm (bottle against its box)   0.225
 *     ---- every single-subject packshot ----     <= 0.039
 *
 * A 5.7x gap, with the widest single can sitting at 0.001. The threshold is set in that gap.
 *
 * This flags for review; it does not reject. A person decides whether a packshot showing a gift
 * set is the artwork they meant to stage.
 */
export interface SubjectProfile {
  bounds: { x: number; y: number; w: number; h: number };
  aspect: number;
  /** Subject pixels as a fraction of the bounding box. */
  fill: number;
  /** Depth of the deepest interior valley in the column profile, 0 to 1. */
  separation: number;
  /** Where that valley sits across the subject, 0 to 1, or null when there is none. */
  separationAt: number | null;
  singleSubject: boolean;
  reason: string;
}

/**
 * Above this, the subject is treated as more than one object and flagged. Set from the measured
 * gap above, not from a guess, and recorded here so a later catalogue can re-measure it.
 */
export const MAX_SEPARATION = 0.1;

export function subjectProfile(
  raster: Raster,
  maxSeparation = MAX_SEPARATION,
): SubjectProfile | null {
  const mask = maskFromAlpha(raster);
  const box = bounds(mask);
  if (!box) return null;

  let subjectPixels = 0;
  const profile: number[] = [];
  for (let x = box.x; x < box.x + box.w; x += 1) {
    let column = 0;
    for (let y = box.y; y < box.y + box.h; y += 1) {
      if (mask.data[y * raster.width + x]) column += 1;
    }
    profile.push(column);
    subjectPixels += column;
  }

  // The deepest dip that has real mass on both sides of it. The margins are skipped because a
  // bottle's own neck makes the edges of the profile thin without meaning anything.
  let separation = 0;
  let separationAt: number | null = null;
  const from = Math.floor(profile.length * 0.1);
  const to = Math.floor(profile.length * 0.9);
  let runningLeftMax = 0;
  for (let i = 0; i < from; i += 1) runningLeftMax = Math.max(runningLeftMax, profile[i] ?? 0);

  // Suffix maxima, so this stays linear rather than rescanning for every column.
  const rightMax = new Array<number>(profile.length + 1).fill(0);
  for (let i = profile.length - 1; i >= 0; i -= 1) {
    rightMax[i] = Math.max(rightMax[i + 1] ?? 0, profile[i] ?? 0);
  }

  for (let i = from; i < to; i += 1) {
    runningLeftMax = Math.max(runningLeftMax, profile[i - 1] ?? 0);
    const shallower = Math.min(runningLeftMax, rightMax[i + 1] ?? 0);
    if (shallower <= 0) continue;
    const score = (shallower - (profile[i] ?? 0)) / shallower;
    if (score > separation) {
      separation = score;
      separationAt = i / profile.length;
    }
  }

  const aspect = box.w / box.h;
  const fill = subjectPixels / (box.w * box.h);
  const singleSubject = separation <= maxSeparation;

  return {
    bounds: box,
    aspect,
    fill,
    separation,
    separationAt: singleSubject ? null : separationAt,
    singleSubject,
    reason: singleSubject
      ? `One subject: the column profile has no interior gap worth the name (${separation.toFixed(3)}, limit ${maxSeparation}).`
      : `This packshot looks like more than one object: the subject splits into separate masses at ${((separationAt ?? 0) * 100).toFixed(0)}% across, with a gap of ${separation.toFixed(3)} (limit ${maxSeparation}). Usually that is a bottle beside its gift box, or a fragment of shadow the cutout kept. A person should confirm this is the artwork to stage.`,
  };
}
