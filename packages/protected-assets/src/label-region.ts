import { decode, type Raster, type Region } from './raster.js';
import { bounds, maskFromAlpha } from './mask.js';
import { normaliseLabelText, readWords, type OcrWord } from './ocr.js';
import { err, ok, type Result } from '@spirithaus/domain';

/**
 * Finding the printed label on a real packshot.
 *
 * The synthetic master had its label region drawn by hand, which does not survive contact with a
 * 238-product catalogue. The region is derived from OCR word boxes instead: the words are the
 * evidence, so a region built from them demonstrably contains printed text rather than a guess at
 * where a label usually sits.
 *
 * Measured on this store's own packshots, the thresholds below separate the two real cases:
 *
 * - Absolut Vodka, Husk Rum, Jack Daniel's — 6 to 23 confident words, clean clusters.
 * - Karu Affinity Gin — reversed-out type on clear glass over a patterned backdrop. 53 word
 *   candidates, of which none survive: every one is a two-character fragment like "il" or "oN"
 *   at confidence 60-72. Confidence alone does not separate them; a minimum length of three does.
 *
 * So this returns a region or it returns nothing, and nothing means a person draws it. A wrong
 * region would silently move the colour reference off the label and make the ΔE guard meaningless.
 */
export interface LabelDetection {
  /** Normalised to the whole master, ready for the ingest pipeline. */
  region: Region;
  /** What OCR read inside the detected region, as stored ground truth. */
  text: string;
  words: { text: string; confidence: number }[];
  meanConfidence: number;
}

export interface LabelDetectionOptions {
  minConfidence?: number;
  minWordLength?: number;
  minWords?: number;
  /** Vertical gap, as a fraction of the product's height, that starts a new cluster. */
  clusterGap?: number;
  /** Padding around the chosen cluster, as a fraction of the product's size. */
  padding?: number;
}

export const DEFAULT_LABEL_DETECTION: Required<LabelDetectionOptions> = {
  minConfidence: 60,
  minWordLength: 3,
  minWords: 3,
  clusterGap: 0.08,
  padding: 0.02,
};

const area = (word: OcrWord): number =>
  Math.max(0, word.bbox.x1 - word.bbox.x0) * Math.max(0, word.bbox.y1 - word.bbox.y0);

/**
 * The product's own bounds within the frame, from its alpha. Reading outside them is reading the
 * empty space around the bottle.
 */
export function productBounds(
  raster: Raster,
): { x: number; y: number; w: number; h: number } | null {
  return bounds(maskFromAlpha(raster));
}

export async function detectLabelRegion(
  masterPng: Uint8Array,
  /**
   * The product area, cropped and flattened, as it should be read. Passed in rather than cropped
   * here so the caller controls the flattening colour, which changes what OCR sees.
   */
  productCropPng: Uint8Array,
  options: LabelDetectionOptions = {},
): Promise<Result<LabelDetection, string>> {
  const opts = { ...DEFAULT_LABEL_DETECTION, ...options };
  const raster = await decode(masterPng);
  const product = productBounds(raster);
  if (!product) {
    return err('This image has no opaque subject, so there is nothing to find a label on.');
  }

  const read = await readWords(productCropPng);
  if (!read.ok) return err(read.error);

  const accepted = read.value.filter((word) => {
    const text = normaliseLabelText(word.text).replace(/\s/g, '');
    return word.confidence >= opts.minConfidence && text.length >= opts.minWordLength;
  });

  if (accepted.length < opts.minWords) {
    return err(
      `Only ${accepted.length} of ${read.value.length} words read on this product were confident and long enough to trust (needed ${opts.minWords}). This is what a reversed-out label on clear glass looks like to OCR. A person needs to draw the label region for this product.`,
    );
  }

  // Cluster by vertical position: a neck label and a body label are different labels, and a
  // region spanning both would take in the glass between them.
  const sorted = [...accepted].sort((a, b) => a.bbox.y0 - b.bbox.y0);
  const gap = opts.clusterGap * product.h;
  const clusters: OcrWord[][] = [];
  let current: OcrWord[] = [];
  let previousBottom = -Infinity;

  for (const word of sorted) {
    if (current.length > 0 && word.bbox.y0 - previousBottom > gap) {
      clusters.push(current);
      current = [];
    }
    current.push(word);
    previousBottom = Math.max(previousBottom, word.bbox.y1);
  }
  if (current.length > 0) clusters.push(current);

  // The densest cluster by printed area is the main label.
  const chosen = clusters.reduce((best, cluster) => {
    const total = cluster.reduce((sum, word) => sum + area(word), 0);
    const bestTotal = best.reduce((sum, word) => sum + area(word), 0);
    return total > bestTotal ? cluster : best;
  }, clusters[0] as OcrWord[]);

  if (chosen.length < opts.minWords) {
    return err(
      `The confident words on this product did not cluster into a single label (largest group ${chosen.length}, needed ${opts.minWords}). A person needs to draw the label region.`,
    );
  }

  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const word of chosen) {
    x0 = Math.min(x0, word.bbox.x0);
    y0 = Math.min(y0, word.bbox.y0);
    x1 = Math.max(x1, word.bbox.x1);
    y1 = Math.max(y1, word.bbox.y1);
  }

  const padX = opts.padding * product.w;
  const padY = opts.padding * product.h;
  // Word boxes are in the crop's coordinates; the region the pipeline wants is normalised to the
  // whole master, so the product's offset goes back on here.
  const left = Math.max(product.x, product.x + x0 - padX);
  const top = Math.max(product.y, product.y + y0 - padY);
  const right = Math.min(product.x + product.w, product.x + x1 + padX);
  const bottom = Math.min(product.y + product.h, product.y + y1 + padY);

  if (right - left < 8 || bottom - top < 8) {
    return err('The detected label region is too small to measure a colour or read text in.');
  }

  const text = chosen.map((word) => word.text).join(' ');

  return ok({
    region: {
      x: left / raster.width,
      y: top / raster.height,
      w: (right - left) / raster.width,
      h: (bottom - top) / raster.height,
    },
    text: normaliseLabelText(text),
    words: chosen.map((word) => ({ text: word.text, confidence: word.confidence })),
    meanConfidence: chosen.reduce((sum, word) => sum + word.confidence, 0) / chosen.length,
  });
}
