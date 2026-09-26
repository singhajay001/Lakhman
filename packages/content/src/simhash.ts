import { createHash } from 'node:crypto';

/**
 * Copy similarity, for the near-duplicate prevention of section 24.
 *
 * A 64-bit simhash over word trigrams: near-identical copy lands within a few bits, and
 * the four 16-bit buckets let a candidate search use an index instead of scanning every
 * asset ever published.
 */
export interface Simhash {
  hash: Buffer;
  buckets: [number, number, number, number];
}

export function simhash(text: string): Simhash {
  const tokens = trigrams(normalise(text));
  const weights = new Array<number>(64).fill(0);

  for (const token of tokens) {
    const digest = createHash('sha1').update(token).digest();
    for (let bit = 0; bit < 64; bit += 1) {
      const byte = digest[bit >> 3] ?? 0;
      const set = (byte >> (7 - (bit & 7))) & 1;
      weights[bit] = (weights[bit] ?? 0) + (set === 1 ? 1 : -1);
    }
  }

  const hash = Buffer.alloc(8);
  for (let bit = 0; bit < 64; bit += 1) {
    if ((weights[bit] ?? 0) > 0) {
      const index = bit >> 3;
      hash[index] = (hash[index] ?? 0) | (1 << (7 - (bit & 7)));
    }
  }

  return {
    hash,
    buckets: [
      hash.readUInt16BE(0),
      hash.readUInt16BE(2),
      hash.readUInt16BE(4),
      hash.readUInt16BE(6),
    ],
  };
}

/** Bits that differ. 0 is identical; above roughly 12 the copy is unrelated. */
export function hammingDistance(a: Buffer, b: Buffer): number {
  if (a.length !== b.length) throw new Error('hashes of different lengths cannot be compared');
  let distance = 0;
  for (let index = 0; index < a.length; index += 1) {
    let xor = (a[index] ?? 0) ^ (b[index] ?? 0);
    while (xor !== 0) {
      distance += xor & 1;
      xor >>= 1;
    }
  }
  return distance;
}

/** The reuse policy of section 24: configurable, with 12 bits as the initial candidate. */
export const NEAR_DUPLICATE_BITS = 12;

export function isNearDuplicate(a: Buffer, b: Buffer, bits = NEAR_DUPLICATE_BITS): boolean {
  return hammingDistance(a, b) <= bits;
}

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[#@]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function trigrams(text: string): string[] {
  const words = text.split(' ').filter(Boolean);
  if (words.length < 3) return words;
  const out: string[] = [];
  for (let index = 0; index + 2 < words.length; index += 1) {
    out.push(`${words[index]} ${words[index + 1]} ${words[index + 2]}`);
  }
  return out;
}
