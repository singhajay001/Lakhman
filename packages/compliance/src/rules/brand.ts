import { specFor } from '@spirithaus/domain';
import { findPattern, findPhrases } from '../text.js';
import type { Rule } from '../types.js';

/**
 * Function words, excluded so the density measure reads content rather than grammar.
 * Kept short and visible: a long hidden list turns an explainable rule into a black box.
 */
const STOP_WORDS = new Set(
  'the and for with who you your our are was has its but not all can from this that out off one two over into then than when what more very just also only has have had will would there their they them she him his her its each some any few most other such than too own same these those both into during before after above below down more much many make made take taken give given get got use used using like well back even still way'.split(
    ' ',
  ),
);

export const BRAND_RULES: Rule[] = [
  {
    id: 'brand.prohibited_phrase',
    code: 'BRAND-1',
    category: 'brand',
    severity: 'BLOCKING',
    title: 'A phrase the Brand Kit prohibits',
    standard:
      'The Brand Kit is the authoritative record of what SPIRITHAUS says and does not say (section 14).',
    suggestion:
      'Rewrite without the phrase. The Brand Kit lists it for a reason recorded against it.',
    check: (input) =>
      input.brand.prohibitedPhrases.length === 0
        ? []
        : findPhrases(input.fields, input.brand.prohibitedPhrases),
  },
  {
    id: 'brand.name_variation',
    code: 'BRAND-2',
    category: 'brand',
    severity: 'BLOCKING',
    title: 'A brand-name spelling that is not SPIRITHAUS',
    standard:
      'Section 2 requires SPIRITHAUS used consistently, and no variation unless an administrator records it as approved. The name is contested — a US retailer trades as Spirit Haus — so a variation also weakens the entity signal the storefront’s structured data is building.',
    suggestion:
      'Use SPIRITHAUS. If a variation is genuinely wanted, an administrator records it as an approved brand variation first.',
    check: (input) => {
      const approved = new Set(
        input.brand.approvedBrandVariations.map((variation) => variation.toLowerCase()),
      );
      return findPattern(input.fields, /\bspirit[\s-]?haus\b/i)
        .filter((match) => {
          const seen = match.match.toLowerCase();
          // The correct spelling has no separator and reads as one word.
          if (seen === 'spirithaus') return false;
          return !approved.has(seen);
        })
        .map(({ captured: _captured, ...evidence }) => evidence);
    },
  },
  {
    id: 'search.keyword_stuffing',
    code: 'SEO-1',
    category: 'search',
    severity: 'ADVISORY',
    title: 'A term repeated to the point of stuffing',
    standard:
      'Section 13 forbids keyword stuffing and misleading search claims. Repetition also reads badly, which costs more than it gains.',
    suggestion:
      'Say it once and let the rest of the copy do other work. Synonyms and related terms cover the same search intent.',
    check: (input) => {
      const evidence = [];
      for (const field of input.fields) {
        // Three letters, not four: "gin", "rum" and "dry" are exactly the terms a
        // stuffed caption repeats, and a four-letter floor made the rule blind to them.
        const words = (field.value.toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? []).filter(
          (word) => !STOP_WORDS.has(word),
        );
        if (words.length < 12) continue;

        const counts = new Map<string, number>();
        for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);

        for (const [word, count] of counts) {
          // Above roughly one content word in twelve, a term stops reading as prose.
          if (count >= 4 && count / words.length > 1 / 12) {
            const index = field.value.toLowerCase().indexOf(word);
            evidence.push({
              field: field.name,
              match: word,
              index: index < 0 ? 0 : index,
              excerpt: `"${word}" appears ${count} times in ${words.length} content words`,
            });
          }
        }
      }
      return evidence;
    },
  },
  {
    id: 'platform.refused_component',
    code: 'PLATFORM-1',
    category: 'platform_policy',
    severity: 'BLOCKING',
    title: 'A component this platform will not permit for alcohol',
    standard:
      'Platform capability differs by account, country and product category. Two components are expected unavailable to an Australian liquor retailer: Instagram product tagging, and TikTok paid creative.',
    suggestion:
      'Remove the component. The variant carries a tracked link to the SPIRITHAUS store instead, which is what section 21 instructs.',
    check: (input) => {
      const spec = specFor(input.platform);
      return spec.refuses
        .filter((refusal) => input.components.includes(refusal.component))
        .map((refusal) => ({
          field: 'components',
          match: refusal.component,
          index: 0,
          excerpt: refusal.reason,
        }));
    },
  },
];
