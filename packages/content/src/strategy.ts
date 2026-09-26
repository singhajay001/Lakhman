import type { FactSheet, Platform } from '@spirithaus/domain';

/**
 * The campaign strategy of section 11. One strategy, from which every platform variant
 * is derived independently — section 12 forbids publishing identical copy everywhere by
 * default, and the way to avoid it is to derive rather than copy.
 */
export interface CampaignStrategy {
  name: string;
  objective: string;
  targetAudience: string;
  exclusions: string[];
  keyMessage: string;
  customerProposition: string;
  creativeConcept: string;
  storyAngle: string;
  visualDirection: string;
  platforms: Platform[];
  contentPillars: string[];
  publishingSequence: { platform: Platform; order: number; note: string }[];
  callToAction: string;
  landingDestination: string;
  keywordCluster: string[];
  hashtagGroups: { name: string; tags: string[] }[];
  assetRequirements: string[];
  tests: string[];
  metrics: string[];
  complianceNotes: string[];
}

export interface BriefInput {
  campaignName: string;
  objective: string;
  audience?: string;
  exclusions?: string[];
  landingUrl: string;
  platforms: Platform[];
  factSheet: FactSheet;
  /** Occasion presets are editable Australian dates, per section 11. */
  occasion?: string | null;
}

/**
 * Australian occasion presets (section 11), as editable data. Dates are the recurring
 * ones; a year-specific date belongs on the campaign.
 */
export const OCCASION_PRESETS: { key: string; label: string; window: string; note: string }[] = [
  {
    key: 'australia-day',
    label: 'Australia Day',
    window: '26 January',
    note: 'Contested date; check tone.',
  },
  {
    key: 'easter',
    label: 'Easter',
    window: 'March–April',
    note: 'Trading-hour restrictions apply.',
  },
  { key: 'mothers-day', label: "Mother's Day", window: 'Second Sunday in May', note: 'Gifting.' },
  { key: 'eofy', label: 'End of financial year', window: '30 June', note: 'Clearance context.' },
  {
    key: 'fathers-day',
    label: "Father's Day",
    window: 'First Sunday in September',
    note: 'Gifting; whisky index.',
  },
  {
    key: 'melbourne-cup',
    label: 'Melbourne Cup',
    window: 'First Tuesday in November',
    note: 'High-risk: excess and gambling adjacency.',
  },
  {
    key: 'black-friday',
    label: 'Black Friday',
    window: 'Late November',
    note: 'Offer terms required.',
  },
  {
    key: 'christmas',
    label: 'Christmas',
    window: 'December',
    note: 'Gifting; delivery cut-offs matter.',
  },
  {
    key: 'new-year',
    label: "New Year's Eve",
    window: '31 December',
    note: 'High-risk: excess framing.',
  },
  {
    key: 'summer',
    label: 'Australian summer',
    window: 'December–February',
    note: 'Long serves, spritz.',
  },
];

/**
 * Occasions where the compliance engine's consumption rules deserve extra attention. The
 * engine runs the same rules either way; this only raises what a reviewer is told.
 */
export const HIGH_RISK_OCCASIONS = new Set(['melbourne-cup', 'new-year', 'australia-day']);

/**
 * Builds the strategy skeleton deterministically from the brief and the approved facts.
 *
 * Deliberately not a model call. The structural parts — pillars, sequence, keywords,
 * hashtags, metrics, compliance notes — are derivable, and deriving them means two
 * campaigns built from the same brief are comparable. The prose that needs a writer is
 * filled per platform in variants.ts.
 */
export function buildStrategy(input: BriefInput): CampaignStrategy {
  const product = input.factSheet.products[0];
  const productName = product?.title ?? 'the selected products';
  const category = product?.productType ?? 'spirits';
  const region = firstFact(input.factSheet, 'region') ?? firstFact(input.factSheet, 'country');

  const keywords = dedupe([
    productName.toLowerCase(),
    category.toLowerCase(),
    `buy ${category.toLowerCase()} online australia`,
    `${category.toLowerCase()} delivery sydney`,
    region ? `${region.toLowerCase()} ${category.toLowerCase()}` : null,
    product?.vendor ? product.vendor.toLowerCase() : null,
  ]);

  return {
    name: input.campaignName,
    objective: input.objective,
    targetAudience:
      input.audience ??
      'Australian adults of legal drinking age who buy premium spirits online, in NSW and nationally.',
    // Section 11 forbids targeting minors and prohibits segmentation on harmful
    // consumption behaviour; both are recorded as exclusions on every campaign.
    exclusions: dedupe([
      'anyone under 18',
      'audiences defined by consumption volume or frequency',
      ...(input.exclusions ?? []),
    ]),
    keyMessage: `${productName}${region ? `, from ${region}` : ''} — ${category.toLowerCase()} worth the shelf space.`,
    customerProposition: `Buy ${productName} from SPIRITHAUS, delivered in Australia.`,
    creativeConcept:
      'A shop, not a party: the bottle, the hands, the making of a drink. The range is the subject.',
    storyAngle: input.occasion
      ? `${productName} for ${label(input.occasion)}`
      : `Why ${productName} is on the shelf`,
    visualDirection:
      'Low key, one directional light, warm neutrals against near-black. No faces. Hands read 35 or older. The quiet zone is the bottom of the frame.',
    platforms: input.platforms,
    contentPillars: ['product truth', 'the serve', 'the maker', 'the occasion'],
    publishingSequence: input.platforms.map((platform, index) => ({
      platform,
      order: index + 1,
      note: index === 0 ? 'Lead placement' : 'Staggered to avoid competing with the lead',
    })),
    callToAction: 'Order at spirithaus.com.au',
    landingDestination: input.landingUrl,
    keywordCluster: keywords,
    hashtagGroups: [
      { name: 'brand', tags: ['#spirithaus'] },
      {
        name: 'category',
        tags: dedupe([
          `#${slugTag(category)}`,
          product?.vendor ? `#${slugTag(product.vendor)}` : null,
        ]),
      },
      { name: 'place', tags: ['#sydney', '#australianspirits'] },
    ],
    assetRequirements: [
      '9:16 vertical for Reels, TikTok and Shorts',
      '4:5 for the Instagram feed',
      '1:1 for Facebook',
      '16:9 for YouTube',
      '2:3 for Pinterest',
      'protected product layer, composited not generated',
    ],
    tests: ['hook A against hook B', 'serve-led against maker-led opening'],
    // Section 26's ranking, recorded on the campaign so the report cannot quietly
    // reorder it later.
    metrics: [
      'contribution margin',
      'net revenue after refunds',
      'confirmed orders',
      'conversion rate',
      'new-customer acquisition',
      'add to cart',
      'qualified sessions',
      'engagement (awareness score only)',
    ],
    complianceNotes: dedupe([
      'ABAC checks run before approval; a clean report is not an approval.',
      input.occasion && HIGH_RISK_OCCASIONS.has(input.occasion)
        ? `${label(input.occasion)} carries a raised risk of excess framing — read the consumption findings closely.`
        : null,
      input.factSheet.facts.length === 0
        ? 'No research claim is approved, so copy may state nothing beyond Shopify product data.'
        : null,
      input.factSheet.excluded.length > 0
        ? `${input.factSheet.excluded.length} claim(s) were excluded from the fact sheet and may not appear in copy.`
        : null,
    ]),
  };
}

const label = (key: string): string =>
  OCCASION_PRESETS.find((preset) => preset.key === key)?.label ?? key;

const firstFact = (sheet: FactSheet, field: string): string | null =>
  sheet.facts.find((fact) => fact.field === field)?.value ?? null;

const dedupe = (values: (string | null | undefined)[]): string[] => [
  ...new Set(values.filter((value): value is string => Boolean(value && value.trim().length > 0))),
];

const slugTag = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, '');
