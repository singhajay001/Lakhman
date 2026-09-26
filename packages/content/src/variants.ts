import {
  err,
  ok,
  promptFacts,
  specFor,
  type FactSheet,
  type Platform,
  type Result,
} from '@spirithaus/domain';
import type { BrandRules } from '@spirithaus/compliance';
import type { TextGenerationProvider } from '@spirithaus/providers';
import { buildTrackedLink } from './utm.js';
import type { CampaignStrategy } from './strategy.js';

/**
 * The six platform variants (section 12).
 *
 * Structure is ours and deterministic; prose is the provider's. That split is the point:
 * the differences between platforms — what fields exist, how many hashtags, whether a
 * link is clickable, what a storyboard needs — are decisions, not something to hope a
 * model gets right. It also means the platform differences are testable, and that a
 * mocked provider still produces six genuinely different variants rather than nothing.
 */
export interface VariantDraft {
  platform: Platform;
  /** The platform-shaped object stored on ContentVariant.content. */
  content: Record<string, unknown>;
  /** The body a reader sees. Denormalised for hashing and for the approval trigger. */
  primaryCopy: string;
  callToAction: string;
  hashtags: string[];
  altText: string | null;
  destinationUrl: string;
  /** Which of the platform's required components this draft carries. */
  components: string[];
  generation: {
    adapterId: string;
    model: string | null;
    mock: boolean;
    promptVersion: string;
  };
}

export const PROMPT_VERSION = 'variant/v1';

export interface GenerateInput {
  platform: Platform;
  strategy: CampaignStrategy;
  factSheet: FactSheet;
  brand: BrandRules;
  campaignId: string;
  provider: TextGenerationProvider;
  paid?: boolean;
}

export type GenerateFailure = { reason: string; providerError?: string };

export async function generateVariant(
  input: GenerateInput,
): Promise<Result<VariantDraft, GenerateFailure>> {
  const spec = specFor(input.platform);
  const link = buildTrackedLink({
    destination: input.strategy.landingDestination,
    platform: input.platform,
    campaignId: input.campaignId,
    campaignSlug: input.strategy.name,
    variantSlug: `${input.platform.toLowerCase()}-organic`,
    paid: input.paid ?? false,
  });

  const prose = await requestProse(input, spec.captionMax);
  if (!prose.ok) return prose;

  const hashtags = selectHashtags(input.strategy, spec.hashtagRecommended);
  const body = prose.value.text;

  switch (input.platform) {
    case 'FACEBOOK':
      return ok(facebook(input, body, hashtags, link, prose.value));
    case 'INSTAGRAM':
      return ok(instagram(input, body, hashtags, link, prose.value));
    case 'X':
      return ok(x(input, body, hashtags, link, prose.value));
    case 'TIKTOK':
      return ok(tiktok(input, body, hashtags, link, prose.value));
    case 'YOUTUBE':
      return ok(youtube(input, body, hashtags, link, prose.value));
    case 'PINTEREST':
      return ok(pinterest(input, body, hashtags, link, prose.value));
    default:
      return err({ reason: `no generator for ${String(input.platform)}` });
  }
}

interface Prose {
  text: string;
  adapterId: string;
  model: string | null;
  mock: boolean;
}

/**
 * One provider call per platform, with the platform's own brief. The system prompt
 * carries the constraints; the approved facts are passed as data, never as instructions,
 * and nothing outside the fact sheet reaches the model.
 */
async function requestProse(
  input: GenerateInput,
  captionMax: number,
): Promise<Result<Prose, GenerateFailure>> {
  const spec = specFor(input.platform);
  const budget = Math.max(80, Math.floor(captionMax * 0.6));

  const system = [
    'You write for SPIRITHAUS, a Sydney online liquor retailer, in Australian English.',
    'Hard rules, in order of precedence:',
    '1. State nothing that is not in the FACTS block. No award, rating, vintage, age statement, ABV, price or provenance that is not listed there.',
    '2. Never present alcohol as healthy, therapeutic, or a route to confidence, popularity or success.',
    '3. Never reference intoxication, excessive or rapid consumption, or driving.',
    '4. Never write anything with appeal to people under 18.',
    '5. Adults described must read as clearly over 25.',
    input.brand.prohibitedPhrases.length > 0
      ? `6. Never use these phrases: ${input.brand.prohibitedPhrases.join('; ')}.`
      : '6. (no prohibited phrases configured)',
    'Tone: premium, knowledgeable, welcoming, plain. No exclamation marks. No emoji.',
    'Return prose only — no headings, no hashtags, no links, no quotation marks around the whole.',
  ].join('\n');

  const prompt = [
    `Platform: ${spec.label}. ${platformBrief(input.platform)}`,
    `Write at most ${budget} characters.`,
    `Objective: ${input.strategy.objective}.`,
    `Key message: ${input.strategy.keyMessage}`,
    `Story angle: ${input.strategy.storyAngle}`,
    `Audience: ${input.strategy.targetAudience}`,
    '',
    'FACTS (the only things you may state):',
    promptFacts(input.factSheet),
  ].join('\n');

  const result = await input.provider.generate({
    system,
    prompt,
    maxOutputTokens: 600,
  });

  if (!result.ok) {
    return err({
      reason: `the text provider refused or failed, so no copy was written for ${spec.label}`,
      providerError: `${result.error.class}: ${result.error.message}`,
    });
  }

  const text = result.value.value.text.trim();
  if (text.length === 0) {
    return err({ reason: `the text provider returned nothing for ${spec.label}` });
  }

  return ok({
    text,
    adapterId: input.provider.id,
    model: result.value.value.model,
    mock: result.value.mock,
  });
}

/** What each platform actually wants from the prose, in one line. */
function platformBrief(platform: Platform): string {
  switch (platform) {
    case 'FACEBOOK':
      return 'A strong opening line, then a short readable story or offer. Complete sentences.';
    case 'INSTAGRAM':
      return 'A first line that works alone before the caption is expanded, then two or three sentences.';
    case 'X':
      return 'One tight sentence. No wind-up.';
    case 'TIKTOK':
      return 'A spoken opening hook of one sentence, then what the viewer sees, as narration.';
    case 'YOUTUBE':
      return 'An opening paragraph for the description that reads well in search results.';
    case 'PINTEREST':
      return 'A keyword-led description a reader searching for this would recognise.';
    default:
      return '';
  }
}

// --- assemblers ---------------------------------------------------------------
// Each one decides what the platform gets, and trims the prose rather than the
// structure when the total will not fit. A caption over the limit is rejected by the
// platform at dispatch; a caption trimmed here is still a caption.

function facebook(
  input: GenerateInput,
  body: string,
  hashtags: string[],
  link: string,
  prose: Prose,
): VariantDraft {
  const cta = input.strategy.callToAction;
  const [opening, ...rest] = splitOpening(body);
  const primaryCopy = fit(
    [opening, rest.join(' '), `${cta}: ${link}`, hashtags.join(' ')],
    specFor('FACEBOOK').captionMax,
  );

  return {
    platform: 'FACEBOOK',
    content: {
      opening,
      body: rest.join(' '),
      callToAction: cta,
      trackedLink: link,
      mediaSuggestion: '1:1 product hero, or a 3-card carousel: bottle, serve, maker',
      organicVariant: primaryCopy,
      paidVariant: null,
    },
    primaryCopy,
    callToAction: cta,
    hashtags,
    altText: `${input.factSheet.products[0]?.title ?? 'Product'} photographed on a dark timber bench under one warm light.`,
    destinationUrl: link,
    components: ['opening', 'body', 'callToAction', 'trackedLink'],
    generation: {
      adapterId: prose.adapterId,
      model: prose.model,
      mock: prose.mock,
      promptVersion: PROMPT_VERSION,
    },
  };
}

function instagram(
  input: GenerateInput,
  body: string,
  hashtags: string[],
  link: string,
  prose: Prose,
): VariantDraft {
  const spec = specFor('INSTAGRAM');
  const [firstLine, ...rest] = splitOpening(body);
  const short = fit([firstLine], 125);
  const medium = fit([firstLine, rest.join(' ')], 400);
  const long = fit([firstLine, rest.join(' '), input.strategy.customerProposition], 1200);
  // No link in the caption: Instagram does not make it clickable, so the caption points
  // at the bio instead of somewhere the reader cannot follow.
  const primaryCopy = fit([long, 'Link in bio.', hashtags.join(' ')], spec.captionMax);
  const product = input.factSheet.products[0];

  return {
    platform: 'INSTAGRAM',
    content: {
      firstLine,
      captionShort: short,
      captionMedium: medium,
      captionLong: long,
      carouselNarrative: [
        'Card 1 — the bottle, centred, in shadow',
        'Card 2 — the serve being built, hands only',
        'Card 3 — the maker or the place',
        'Card 4 — the offer or the range',
      ],
      storyFrames: [
        'Frame 1 — bottle, bottom half quiet',
        'Frame 2 — the serve',
        'Frame 3 — link sticker',
      ],
      linkStrategy: 'bio link; Story link sticker where the account is eligible',
      trackedLink: link,
      productTag: null,
      productTagNote:
        'Not built: product tagging needs Instagram Shopping, which sits under Meta’s Commerce Policy prohibition on alcohol.',
    },
    primaryCopy,
    callToAction: 'Link in bio',
    hashtags,
    altText: `${product?.title ?? 'Product'} on a dark bench, one warm light from the left, glass and ice alongside.`,
    destinationUrl: link,
    components: ['firstLine', 'captionShort', 'captionMedium', 'captionLong', 'altText'],
    generation: {
      adapterId: prose.adapterId,
      model: prose.model,
      mock: prose.mock,
      promptVersion: PROMPT_VERSION,
    },
  };
}

function x(
  input: GenerateInput,
  body: string,
  hashtags: string[],
  link: string,
  prose: Prose,
): VariantDraft {
  const spec = specFor('X');
  // 280 characters, and the link and hashtag are structural, so the prose gives way.
  const primaryCopy = fit([firstSentence(body), link, hashtags.join(' ')], spec.captionMax);

  return {
    platform: 'X',
    content: {
      post: primaryCopy,
      thread: [
        firstSentence(body),
        input.strategy.customerProposition,
        `${input.strategy.callToAction}: ${link}`,
      ],
      alternativeHook: input.strategy.keyMessage,
      linkCardCopy: fit([input.strategy.customerProposition], 120),
      mediaNote: '16:9 or 1:1; alt text required',
      tierNote:
        'Posting allowance and media limits depend on the API tier, which is part of the capability rather than a property of the platform.',
    },
    primaryCopy,
    callToAction: input.strategy.callToAction,
    hashtags,
    altText: `${input.factSheet.products[0]?.title ?? 'Product'}, low-key product photograph.`,
    destinationUrl: link,
    components: ['post', 'alternativeHook', 'linkCardCopy'],
    generation: {
      adapterId: prose.adapterId,
      model: prose.model,
      mock: prose.mock,
      promptVersion: PROMPT_VERSION,
    },
  };
}

function tiktok(
  input: GenerateInput,
  body: string,
  hashtags: string[],
  link: string,
  prose: Prose,
): VariantDraft {
  const spec = specFor('TIKTOK');
  const hook = firstSentence(body);
  const primaryCopy = fit([hook, 'Profile link to order.', hashtags.join(' ')], spec.captionMax);

  return {
    platform: 'TIKTOK',
    content: {
      hook,
      storyboard: [
        {
          shot: 1,
          seconds: 2,
          what: 'Bottle lands on the bench, one light',
          audio: 'glass on timber',
        },
        { shot: 2, seconds: 4, what: 'Hands pour, ice cracks', audio: 'pour, ice' },
        { shot: 3, seconds: 4, what: 'Garnish, close', audio: 'peel twist' },
        { shot: 4, seconds: 3, what: 'Finished serve, held still', audio: 'room tone' },
        {
          shot: 5,
          seconds: 2,
          what: 'End card: SPIRITHAUS and the responsible line',
          audio: 'none',
        },
      ],
      voiceover: body,
      onScreenText: [hook, input.strategy.callToAction],
      caption: primaryCopy,
      searchTerms: input.strategy.keywordCluster.slice(0, 5),
      coverTitle: fit([input.strategy.keyMessage], spec.titleMax ?? 100),
      disclosure: 'Commercial content. Age-restricted. 18+.',
      audioDirection:
        'Licensed track or room tone only; no trending audio without a licence check.',
      trackedLink: link,
      paidCreative: null,
      paidNote: 'Not built: TikTok’s advertising policy excludes alcohol.',
    },
    primaryCopy,
    callToAction: input.strategy.callToAction,
    hashtags,
    altText: null,
    destinationUrl: link,
    components: ['hook', 'storyboard', 'onScreenText', 'caption', 'searchTerms', 'disclosure'],
    generation: {
      adapterId: prose.adapterId,
      model: prose.model,
      mock: prose.mock,
      promptVersion: PROMPT_VERSION,
    },
  };
}

function youtube(
  input: GenerateInput,
  body: string,
  hashtags: string[],
  link: string,
  prose: Prose,
): VariantDraft {
  const spec = specFor('YOUTUBE');
  const product = input.factSheet.products[0];
  const primaryCopy = fit(
    [
      body,
      `${input.strategy.callToAction}: ${link}`,
      input.strategy.customerProposition,
      hashtags.join(' '),
    ],
    spec.captionMax,
  );

  return {
    platform: 'YOUTUBE',
    content: {
      titleOptions: [
        fit([input.strategy.keyMessage], spec.titleMax ?? 100),
        fit(
          [`${product?.title ?? 'This bottle'} — what it actually tastes like`],
          spec.titleMax ?? 100,
        ),
        fit([`How to serve ${product?.title ?? 'it'}`], spec.titleMax ?? 100),
      ],
      description: primaryCopy,
      chapters: [
        { at: '0:00', title: 'The bottle' },
        { at: '0:20', title: 'The serve' },
        { at: '0:50', title: 'Where it comes from' },
        { at: '1:20', title: 'How to order' },
      ],
      tags: input.strategy.keywordCluster,
      thumbnailBrief:
        'Bottle left of centre, dark background, one warm light, no text over the bottom third.',
      script: body,
      shotList: [
        'Bottle on bench',
        'Pour, hands only',
        'Garnish close-up',
        'Finished serve',
        'End card',
      ],
      pinnedComment: `${input.strategy.callToAction}: ${link}`,
      endScreen: 'SPIRITHAUS wordmark, responsible-consumption line, store link',
      formats: ['16:9 standard', '9:16 Shorts'],
      quotaNote:
        'An upload costs roughly 1600 quota units against a default 10,000 per day, so the calendar must treat uploads as scarce.',
    },
    primaryCopy,
    callToAction: input.strategy.callToAction,
    hashtags,
    altText: null,
    destinationUrl: link,
    components: [
      'titleOptions',
      'description',
      'script',
      'shotList',
      'thumbnailBrief',
      'endScreen',
    ],
    generation: {
      adapterId: prose.adapterId,
      model: prose.model,
      mock: prose.mock,
      promptVersion: PROMPT_VERSION,
    },
  };
}

function pinterest(
  input: GenerateInput,
  body: string,
  hashtags: string[],
  link: string,
  prose: Prose,
): VariantDraft {
  const spec = specFor('PINTEREST');
  const product = input.factSheet.products[0];
  const primaryCopy = fit([body, hashtags.join(' ')], spec.captionMax);

  return {
    platform: 'PINTEREST',
    content: {
      pinTitle: fit(
        [`${product?.title ?? 'Bottle'} — ${input.strategy.keywordCluster[0] ?? 'spirits'}`],
        spec.titleMax ?? 100,
      ),
      description: primaryCopy,
      destination: link,
      boardSuggestion: `${product?.productType ?? 'Spirits'} worth keeping`,
      formats: ['2:3 static', '9:16 video', 'carousel'],
      keywordLed: true,
      keywords: input.strategy.keywordCluster,
    },
    primaryCopy,
    callToAction: input.strategy.callToAction,
    hashtags,
    altText: `${product?.title ?? 'Product'} photographed vertically on dark timber, warm light from one side.`,
    destinationUrl: link,
    components: ['pinTitle', 'description', 'destination', 'altText', 'boardSuggestion'],
    generation: {
      adapterId: prose.adapterId,
      model: prose.model,
      mock: prose.mock,
      promptVersion: PROMPT_VERSION,
    },
  };
}

// --- assembly helpers ---------------------------------------------------------

/**
 * Joins the parts within the limit. The last-but-structural parts (link, hashtags) are
 * kept and the prose is trimmed, because a caption the platform rejects is worth less
 * than a shorter one.
 */
export function fit(parts: (string | null | undefined)[], max: number): string {
  const present = parts.filter((part): part is string => Boolean(part && part.trim().length > 0));
  const joined = present.join('\n\n');
  if (joined.length <= max) return joined;

  // Trim the first (prose) part by exactly the overflow, at a word boundary.
  const [first, ...others] = present;
  if (!first) return joined.slice(0, max);
  const othersLength = others.join('\n\n').length + (others.length > 0 ? 2 : 0);
  const room = max - othersLength - 1;
  if (room <= 0) return others.join('\n\n').slice(0, max);

  const trimmed = first.slice(0, room);
  const atWord = trimmed.lastIndexOf(' ');
  const prose = `${(atWord > room * 0.6 ? trimmed.slice(0, atWord) : trimmed).trimEnd()}…`;
  return [prose, ...others].join('\n\n').slice(0, max);
}

function splitOpening(body: string): string[] {
  const match = body.match(/^(.*?[.!?])\s+([\s\S]*)$/);
  if (!match) return [body];
  return [match[1] ?? body, match[2] ?? ''];
}

function firstSentence(body: string): string {
  return splitOpening(body)[0] ?? body;
}

function selectHashtags(strategy: CampaignStrategy, limit: number): string[] {
  const all = strategy.hashtagGroups.flatMap((group) => group.tags);
  const unique: string[] = [];
  for (const tag of all) {
    if (!unique.some((seen) => seen.toLowerCase() === tag.toLowerCase())) unique.push(tag);
    if (unique.length >= limit) break;
  }
  return unique;
}
