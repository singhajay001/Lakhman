import { specFor, validateAgainstSpec, type FactSheet, type Platform } from '@spirithaus/domain';
import type { Report } from '@spirithaus/compliance';

/**
 * The explainable content assessment of section 13.
 *
 * Ten dimensions, each with a score, a reason and the evidence behind it. Deliberately
 * first-party and deterministic: section 13 requires reasons, and section 27 requires an
 * external score to be labelled a provider estimate and compared against actuals. A
 * number we can explain beats a number we cannot.
 *
 * None of this predicts performance. The type says so and so does the wording.
 */
export const QUALITY_DIMENSIONS = [
  'relevance',
  'clarity',
  'brandConsistency',
  'searchOptimisation',
  'platformFit',
  'callToAction',
  'originality',
  'accessibility',
  'complianceRisk',
  'factualConfidence',
] as const;

export type QualityDimension = (typeof QUALITY_DIMENSIONS)[number];

export interface DimensionScore {
  dimension: QualityDimension;
  /** 0–100. A measurement of the copy in front of us, not a forecast. */
  score: number;
  reason: string;
  /** False when there was not enough to judge; the score is then withheld, not guessed. */
  measurable: boolean;
}

export interface QualityAssessment {
  platform: Platform;
  dimensions: DimensionScore[];
  /** Mean of the measurable dimensions. Not a prediction of anything. */
  overall: number;
  caveat: string;
}

export const QUALITY_CAVEAT =
  'These scores describe the copy as written — its clarity, fit and risk. They are not a prediction of engagement, reach or sales, and no score here has been calibrated against SPIRITHAUS results.';

export interface AssessInput {
  platform: Platform;
  primaryCopy: string;
  hashtags: readonly string[];
  altText?: string | null;
  title?: string | null;
  destinationUrl?: string | null;
  components: readonly string[];
  keywordCluster: readonly string[];
  factSheet: FactSheet;
  compliance: Report;
  /** Simhash distance to the nearest previously published variant, when one exists. */
  nearestDuplicateBits?: number | null;
  brandVocabulary?: readonly string[];
}

export function assessQuality(input: AssessInput): QualityAssessment {
  const spec = specFor(input.platform);
  const copy = input.primaryCopy;
  const words = copy.split(/\s+/).filter(Boolean);
  const lower = copy.toLowerCase();
  const dimensions: DimensionScore[] = [];
  const add = (dimension: QualityDimension, score: number, reason: string, measurable = true) =>
    dimensions.push({ dimension, score: clamp(score), reason, measurable });

  // Relevance — does the copy mention what it is selling?
  const product = input.factSheet.products[0];
  const mentionsProduct = product ? lower.includes(product.title.toLowerCase()) : false;
  const mentionsCategory = product?.productType
    ? lower.includes(product.productType.toLowerCase())
    : false;
  add(
    'relevance',
    mentionsProduct ? (mentionsCategory ? 95 : 80) : mentionsCategory ? 55 : 25,
    mentionsProduct
      ? `Names the product${mentionsCategory ? ' and its category' : ''}.`
      : mentionsCategory
        ? 'Mentions the category but never the product by name.'
        : 'Neither the product nor its category appears in the copy.',
  );

  // Clarity — sentence length and the absence of throat-clearing.
  const sentences = copy.split(/[.!?]+/).filter((sentence) => sentence.trim().length > 0);
  const averageWords = sentences.length > 0 ? words.length / sentences.length : words.length;
  add(
    'clarity',
    averageWords <= 22 ? 90 : averageWords <= 30 ? 70 : 45,
    `Average sentence length ${averageWords.toFixed(1)} words across ${sentences.length} sentence(s).`,
    words.length >= 8,
  );

  // Brand consistency — the wordmark, and no forbidden spelling.
  const usesWordmark = /spirithaus/i.test(copy);
  const separated = /spirit[\s-]haus/i.test(copy);
  add(
    'brandConsistency',
    separated ? 20 : usesWordmark ? 90 : 60,
    separated
      ? 'Uses a separated spelling of the brand name, which belongs to another business.'
      : usesWordmark
        ? 'Uses SPIRITHAUS as one word.'
        : 'Does not name the brand; acceptable where the account itself carries it.',
  );

  // Search — keyword coverage without stuffing.
  const covered = input.keywordCluster.filter((keyword) => lower.includes(keyword.toLowerCase()));
  const stuffed = input.compliance.findings.some(
    (finding) => finding.code === 'SEO-1' && finding.outcome === 'FAIL',
  );
  add(
    'searchOptimisation',
    stuffed ? 30 : covered.length === 0 ? 40 : Math.min(95, 50 + covered.length * 15),
    stuffed
      ? 'A term is repeated to the point of stuffing, which costs more than the coverage gains.'
      : `Covers ${covered.length} of ${input.keywordCluster.length} cluster terms${covered.length > 0 ? `: ${covered.slice(0, 3).join(', ')}` : ''}.`,
    input.keywordCluster.length > 0,
  );

  // Platform fit — the spec check, reused rather than re-implemented.
  const issues = validateAgainstSpec({
    platform: input.platform,
    primaryCopy: copy,
    hashtags: input.hashtags,
    altText: input.altText ?? null,
    title: input.title ?? null,
    destinationUrl: input.destinationUrl ?? null,
    components: input.components,
  });
  const blockingIssues = issues.filter((issue) => issue.blocking);
  add(
    'platformFit',
    blockingIssues.length > 0 ? 20 : issues.length > 0 ? 70 : 95,
    blockingIssues.length > 0
      ? `Breaks the platform spec: ${blockingIssues.map((issue) => `${issue.field} — ${issue.problem}`).join('; ')}.`
      : issues.length > 0
        ? `Within limits, with ${issues.length} advisory note(s).`
        : `Within every ${spec.label} limit this build knows of, none of which is verified.`,
  );

  // Call to action — present, and pointing somewhere.
  const hasCta = /\b(order|shop|buy|browse|find|discover|link in bio|available at)\b/i.test(copy);
  const hasLink = Boolean(input.destinationUrl);
  add(
    'callToAction',
    hasCta && hasLink ? 90 : hasCta ? 65 : hasLink ? 50 : 20,
    hasCta
      ? hasLink
        ? 'Asks for an action and carries a tracked destination.'
        : 'Asks for an action but has no tracked destination.'
      : 'No call to action in the copy.',
  );

  // Originality — distance from what has already been published.
  if (input.nearestDuplicateBits === null || input.nearestDuplicateBits === undefined) {
    add(
      'originality',
      0,
      'Nothing comparable has been published yet, so there is nothing to measure against.',
      false,
    );
  } else {
    const bits = input.nearestDuplicateBits;
    add(
      'originality',
      bits <= 4 ? 10 : bits <= 12 ? 45 : bits <= 20 ? 75 : 95,
      `Closest published copy differs by ${bits} of 64 hash bits${bits <= 12 ? ' — close enough to read as a repeat' : ''}.`,
    );
  }

  // Accessibility — alt text where the platform takes it.
  if (spec.altTextMax === null) {
    add('accessibility', 0, `${spec.label} takes no alt text through the API.`, false);
  } else {
    const alt = input.altText?.trim() ?? '';
    add(
      'accessibility',
      alt.length === 0 ? 0 : alt.length < 30 ? 55 : 95,
      alt.length === 0
        ? 'No alt text, on a platform that supports it.'
        : alt.length < 30
          ? `Alt text is only ${alt.length} characters; describe what is in the frame.`
          : 'Alt text describes the image.',
    );
  }

  // Compliance risk — inverted from the report, so a blocking finding cannot be
  // outvoted by a good score elsewhere.
  const blocking = input.compliance.blocking.length;
  const advisory = input.compliance.advisory.length;
  add(
    'complianceRisk',
    blocking > 0 ? 0 : advisory === 0 ? 95 : Math.max(40, 90 - advisory * 15),
    blocking > 0
      ? `${blocking} blocking finding(s): ${input.compliance.blocking.map((f) => f.code).join(', ')}.`
      : advisory > 0
        ? `${advisory} advisory finding(s) for a reviewer.`
        : 'No finding — which is not an approval.',
  );

  // Factual confidence — how much of what is said rests on approved facts.
  const approved = input.factSheet.facts.length;
  const excluded = input.factSheet.excluded.length;
  add(
    'factualConfidence',
    approved === 0 ? (excluded > 0 ? 25 : 45) : Math.min(95, 55 + approved * 8),
    approved === 0
      ? excluded > 0
        ? `No approved claim, and ${excluded} awaiting review — the copy can only restate Shopify data.`
        : 'No research claim exists yet, so the copy rests on Shopify product data alone.'
      : `${approved} approved claim(s) available${excluded > 0 ? `, ${excluded} excluded` : ''}.`,
  );

  const measurable = dimensions.filter((dimension) => dimension.measurable);
  const overall =
    measurable.length === 0
      ? 0
      : Math.round(
          measurable.reduce((total, dimension) => total + dimension.score, 0) / measurable.length,
        );

  return { platform: input.platform, dimensions, overall, caveat: QUALITY_CAVEAT };
}

const clamp = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));
