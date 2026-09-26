import { approvedPrices, approvedValues, hasApprovedField } from '@spirithaus/domain';
import { findPattern, normaliseNumber } from '../text.js';
import type { Evidence, Rule } from '../types.js';

/**
 * Claims the copy makes that the approved facts do not support (sections 3 and 9).
 *
 * This is a guard over the claim types that carry the most risk when invented — ABV, age
 * statements, awards, ratings, vintages, price and availability. It is not proof that
 * nothing was invented: a fabricated tasting note or a wrong region will not be caught
 * here, which is why only approved facts are given to the generator in the first place
 * and why a human still reads the copy. Stated plainly because a guard presented as a
 * guarantee is worse than no guard.
 */

const unsupported = (
  matches: (Evidence & { captured?: string })[],
  approved: string[],
): Evidence[] => {
  const permitted = new Set(approved.map((value) => normaliseNumber(value)));
  return matches
    .filter((match) => !permitted.has(normaliseNumber(match.captured ?? match.match)))
    .map(({ captured: _captured, ...evidence }) => evidence);
};

export const FACT_RULES: Rule[] = [
  {
    id: 'facts.abv',
    code: 'FACT-ABV',
    category: 'unsupported_claim',
    severity: 'BLOCKING',
    title: 'An ABV the approved facts do not carry',
    standard:
      'Alcohol strength is a regulated product statement. The system must never invent an ABV, and a figure in copy must match an approved research claim.',
    suggestion:
      'Remove the figure, or approve the ABV claim in the Research Library first. If sources disagree, the conflict has to be resolved by a reviewer, not by picking one.',
    check: (input) =>
      unsupported(
        [
          ...findPattern(input.fields, /(\d{1,2}(?:\.\d{1,2})?)\s*%\s*(?:abv|alc(?:ohol)?)/i),
          ...findPattern(input.fields, /abv[:\s]+(\d{1,2}(?:\.\d{1,2})?)\s*%/i),
        ],
        approvedValues(input.factSheet, 'abv'),
      ),
  },
  {
    id: 'facts.age_statement',
    code: 'FACT-AGE',
    category: 'unsupported_claim',
    severity: 'BLOCKING',
    title: 'An age statement the approved facts do not carry',
    standard:
      'An age statement is a claim about how long the spirit was matured, and is regulated. It must come from an approved source.',
    suggestion: 'Remove the age, or approve an age-statement claim with its source.',
    check: (input) =>
      unsupported(
        [
          ...findPattern(input.fields, /(\d{1,3})[\s-]*year[\s-]*old/i),
          ...findPattern(input.fields, /aged\s+(?:for\s+)?(\d{1,3})\s+years?/i),
        ],
        approvedValues(input.factSheet, 'age_statement'),
      ),
  },
  {
    id: 'facts.award',
    code: 'FACT-AWARD',
    category: 'unsupported_claim',
    severity: 'BLOCKING',
    title: 'An award or medal with no approved award claim',
    standard:
      'An award claim is a representation about the product that must be true and substantiated. Section 3 forbids inventing one.',
    suggestion:
      'Remove the award language, or record the award as a research claim with the awarding body, year and category, and approve it.',
    check: (input) => {
      const matches = findPattern(
        input.fields,
        /\b(double gold|gold medal|silver medal|bronze medal|trophy|best in class|award[-\s]?winning|award winner|world'?s best|master medal)\b/i,
      );
      if (matches.length === 0) return [];
      // Any approved award claim at all permits award language; which award it is, a
      // reviewer checks.
      return hasApprovedField(input.factSheet, 'award')
        ? []
        : matches.map(({ captured: _captured, ...evidence }) => evidence);
    },
  },
  {
    id: 'facts.rating',
    code: 'FACT-RATING',
    category: 'unsupported_claim',
    severity: 'BLOCKING',
    title: 'A score or rating with no approved rating claim',
    standard:
      'A critic score is a factual claim about a third party’s assessment and must be sourced.',
    suggestion:
      'Remove the score, or approve a rating claim naming the critic and the vintage reviewed.',
    check: (input) => {
      const matches = [
        ...findPattern(input.fields, /\b(\d{2,3})\s*(?:points|pts)\b/i),
        ...findPattern(input.fields, /\b(\d(?:\.\d)?)\s*\/\s*5\b/),
        ...findPattern(input.fields, /\b(\d{2,3})\s*\/\s*100\b/),
      ];
      return unsupported(matches, approvedValues(input.factSheet, 'rating'));
    },
  },
  {
    id: 'facts.vintage',
    code: 'FACT-VINTAGE',
    category: 'unsupported_claim',
    severity: 'BLOCKING',
    title: 'A vintage the approved facts do not carry',
    standard: 'A vintage is a regulated statement about the year of production.',
    suggestion: 'Remove the year, or approve a vintage claim.',
    check: (input) =>
      unsupported(
        [
          ...findPattern(input.fields, /\bvintage\s+((?:19|20)\d{2})\b/i),
          ...findPattern(input.fields, /\b((?:19|20)\d{2})\s+vintage\b/i),
        ],
        approvedValues(input.factSheet, 'vintage'),
      ),
  },
  {
    id: 'facts.price',
    code: 'FACT-PRICE',
    category: 'pricing',
    severity: 'BLOCKING',
    title: 'A price the store does not charge',
    standard:
      'Advertising a price the store does not charge is a misleading representation under Australian Consumer Law, whether or not it was deliberate.',
    suggestion:
      'Use the price from the product snapshot, or remove the figure and let the landing page carry it. Preflight revalidates price immediately before publication either way.',
    check: (input) => {
      const matches = findPattern(input.fields, /\$\s?(\d{1,5}(?:\.\d{2})?)/);
      return unsupported(matches, approvedPrices(input.factSheet));
    },
  },
  {
    id: 'facts.availability',
    code: 'FACT-STOCK',
    category: 'availability',
    severity: 'BLOCKING',
    title: 'An availability claim with nothing available',
    standard:
      'Promoting a product as available when no variant is for sale with stock behind it is a misleading representation, and section 7 forbids promoting an unavailable product without an explicit authorisation.',
    suggestion:
      'Either wait for stock, or have a manager authorise a back-order or awareness campaign and remove the availability language.',
    check: (input) => {
      const anyAvailable = input.factSheet.products.some(
        (product) => product.availableForSale && product.inventoryQuantity > 0,
      );
      if (anyAvailable) return [];
      const matches = findPattern(
        input.fields,
        /\b(in stock|available now|order now|buy now|shop now|on the shelf|ready to ship|grab one|last bottles?|limited stock)\b/i,
      );
      return matches.map(({ captured: _captured, ...evidence }) => evidence);
    },
  },
];
