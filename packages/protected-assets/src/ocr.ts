import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createWorker, type Worker } from 'tesseract.js';
import { err, ok, type Result } from '@spirithaus/domain';

/**
 * Reading the label back (section 15).
 *
 * This is the check that still works after a lossy re-encode: pixel identity is gone the
 * moment a platform turns the composite into a JPEG, and a tolerance wide enough to accept
 * that re-encode is wide enough to accept a changed digit. OCR reads the text independently
 * of the pixels, so "43%" becoming "45%" is caught either way.
 *
 * Runs entirely offline. tesseract.js fetches its language data from a CDN by default, which
 * this environment refuses, so the traineddata is resolved from node_modules and the worker is
 * told where to look. If it cannot be found, the check reports unavailable with the paths it
 * tried rather than silently passing.
 */
export interface OcrResult {
  text: string;
  confidence: number;
}

const LANG_CANDIDATES = [
  'node_modules/@tesseract.js-data/eng/4.0.0',
  '../../node_modules/@tesseract.js-data/eng/4.0.0',
  '../../../node_modules/@tesseract.js-data/eng/4.0.0',
];

export function findLanguageData(): Result<string, string> {
  const fromEnv = process.env.TESSERACT_LANG_PATH;
  // Resolved through the module system first: in a pnpm workspace the package lives under
  // the consuming package's node_modules, not the repository root, so walking up from the
  // working directory finds nothing.
  const resolved: string[] = [];
  try {
    const require = createRequire(import.meta.url);
    resolved.push(
      resolve(dirname(require.resolve('@tesseract.js-data/eng/package.json')), '4.0.0'),
    );
  } catch {
    // Not installed here; the path candidates below are the fallback.
  }

  const candidates = [...(fromEnv ? [fromEnv] : []), ...resolved, ...LANG_CANDIDATES];
  const tried: string[] = [];

  for (const candidate of candidates) {
    const path = resolve(process.cwd(), candidate);
    tried.push(path);
    if (
      existsSync(resolve(path, 'eng.traineddata.gz')) ||
      existsSync(resolve(path, 'eng.traineddata'))
    ) {
      return ok(path);
    }
  }

  return err(
    `No offline Tesseract language data found. Set TESSERACT_LANG_PATH, or install @tesseract.js-data/eng. Tried:\n${tried.join('\n')}`,
  );
}

let shared: Promise<Worker> | null = null;

/**
 * One worker for the process. Starting a Tesseract worker costs a second or two, and the
 * verification pass reads two regions per asset.
 */
async function worker(): Promise<Result<Worker, string>> {
  const langPath = findLanguageData();
  if (!langPath.ok) return langPath;

  if (!shared) {
    shared = createWorker('eng', 1, {
      langPath: langPath.value,
      cachePath: process.env.TESSERACT_CACHE_PATH ?? langPath.value,
      logger: () => {},
    });
  }

  try {
    return ok(await shared);
  } catch (error) {
    shared = null;
    return err(
      `Tesseract could not start: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function readText(png: Uint8Array): Promise<Result<OcrResult, string>> {
  const instance = await worker();
  if (!instance.ok) return instance;

  try {
    const { data } = await instance.value.recognize(Buffer.from(png));
    return ok({ text: data.text, confidence: data.confidence });
  } catch (error) {
    return err(`OCR failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export interface OcrWord {
  text: string;
  confidence: number;
  /** Pixel box in the image that was read. */
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

/**
 * The same read, with each word's box.
 *
 * Used to find where the printed label actually is, rather than asking a person to draw a
 * rectangle on every product in a 238-item catalogue. The words are evidence: a region derived
 * from them is a region that demonstrably contains text.
 */
export async function readWords(png: Uint8Array): Promise<Result<OcrWord[], string>> {
  const instance = await worker();
  if (!instance.ok) return instance;

  try {
    const { data } = await instance.value.recognize(Buffer.from(png), {}, { blocks: true });
    const words: OcrWord[] = [];
    for (const block of data.blocks ?? []) {
      for (const paragraph of block.paragraphs) {
        for (const line of paragraph.lines) {
          for (const word of line.words) {
            words.push({ text: word.text, confidence: word.confidence, bbox: word.bbox });
          }
        }
      }
    }
    return ok(words);
  } catch (error) {
    return err(`OCR failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function shutdownOcr(): Promise<void> {
  if (!shared) return;
  const instance = await shared.catch(() => null);
  shared = null;
  await instance?.terminate();
}

/**
 * Normalises for comparison: case, whitespace and the characters OCR routinely confuses.
 *
 * The confusion map is deliberately narrow. Folding O to 0 is safe on a strength statement;
 * folding 5 to S would hide exactly the change this check exists to catch, so it is not here.
 */
export function normaliseLabelText(text: string): string {
  return text
    .toUpperCase()
    .replace(/[|]/g, 'I')
    .replace(/\s+/g, ' ')
    .replace(/[^A-Z0-9%. ]/g, '')
    .trim();
}

export interface TextComparison {
  matches: boolean;
  master: string;
  candidate: string;
  /** Tokens present in one and not the other, which is what a reviewer needs to see. */
  differences: { onlyInMaster: string[]; onlyInCandidate: string[] };
}

export function compareLabelText(masterText: string, candidateText: string): TextComparison {
  const master = normaliseLabelText(masterText);
  const candidate = normaliseLabelText(candidateText);
  const masterTokens = master.split(' ').filter(Boolean);
  const candidateTokens = candidate.split(' ').filter(Boolean);

  const onlyInMaster = masterTokens.filter((token) => !candidateTokens.includes(token));
  const onlyInCandidate = candidateTokens.filter((token) => !masterTokens.includes(token));

  return {
    matches: onlyInMaster.length === 0 && onlyInCandidate.length === 0,
    master,
    candidate,
    differences: { onlyInMaster, onlyInCandidate },
  };
}
