import type { Evidence, TextField } from './types.js';

/** A word-boundary search across named fields, returning every hit with its offset. */
export function findPhrases(
  fields: readonly TextField[],
  phrases: readonly string[],
  options: { exclude?: readonly string[] } = {},
): Evidence[] {
  const evidence: Evidence[] = [];

  for (const field of fields) {
    if (!field.value) continue;
    const haystack = field.value;
    const lower = haystack.toLowerCase();

    for (const phrase of phrases) {
      const needle = phrase.toLowerCase();
      let from = 0;
      for (;;) {
        const index = lower.indexOf(needle, from);
        if (index === -1) break;
        from = index + needle.length;

        if (!isWordBoundary(lower, index, needle.length)) continue;
        if (
          options.exclude?.some((allowed) => overlapsAllowed(lower, index, needle.length, allowed))
        ) {
          continue;
        }

        evidence.push({
          field: field.name,
          match: haystack.slice(index, index + needle.length),
          index,
          excerpt: excerptAround(haystack, index, needle.length),
        });
      }
    }
  }

  return evidence;
}

/** Runs a regex over named fields, capturing group 1 when present. */
export function findPattern(
  fields: readonly TextField[],
  pattern: RegExp,
): (Evidence & { captured?: string })[] {
  const evidence: (Evidence & { captured?: string })[] = [];

  for (const field of fields) {
    if (!field.value) continue;
    const regex = new RegExp(
      pattern.source,
      pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`,
    );
    for (const match of field.value.matchAll(regex)) {
      const index = match.index ?? 0;
      evidence.push({
        field: field.name,
        match: match[0],
        index,
        excerpt: excerptAround(field.value, index, match[0].length),
        captured: match[1],
      });
    }
  }

  return evidence;
}

function isWordBoundary(haystack: string, index: number, length: number): boolean {
  const before = index === 0 ? '' : haystack[index - 1];
  const after = haystack[index + length] ?? '';
  const isWord = (character: string) => /[a-z0-9]/i.test(character);
  return !(before && isWord(before)) && !(after && isWord(after));
}

/**
 * True when the match sits inside a longer permitted phrase. "designated driver" is
 * responsible messaging, so a rule about driving must not fire on the word inside it.
 */
function overlapsAllowed(lower: string, index: number, length: number, allowed: string): boolean {
  const needle = allowed.toLowerCase();
  let from = 0;
  for (;;) {
    const at = lower.indexOf(needle, from);
    if (at === -1) return false;
    if (at <= index && at + needle.length >= index + length) return true;
    from = at + 1;
  }
}

function excerptAround(haystack: string, index: number, length: number): string {
  const start = Math.max(0, index - 32);
  const end = Math.min(haystack.length, index + length + 32);
  return `${start > 0 ? '…' : ''}${haystack.slice(start, end)}${end < haystack.length ? '…' : ''}`;
}

/** Normalises a number the way a reader writes it: "40.0%" and "40 %" are one value. */
export function normaliseNumber(raw: string): string {
  const parsed = Number.parseFloat(raw.replace(/[^\d.]/g, ''));
  if (Number.isNaN(parsed)) return raw.trim().toLowerCase();
  return String(parsed);
}
