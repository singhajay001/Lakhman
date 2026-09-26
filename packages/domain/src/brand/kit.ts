/**
 * The Brand Kit (section 14).
 *
 * Seeded from the live theme rather than typed in, so the storefront and the social
 * output are provably one brand rather than two readings of it. The tokens come from
 * docs/spirithaus/theme-profile.json, which is generated from the theme and never
 * hand-edited.
 *
 * Section 14 forbids inventing missing brand details. Anything not derivable is seeded as
 * a marked placeholder that an administrator must confirm, and a placeholder that is
 * still unconfirmed makes the kit unusable for the rules that depend on it — the
 * responsible-consumption check, for instance, cannot pass until the line is confirmed.
 */
export interface ThemeProfileTokens {
  ink: string;
  white: string;
  bone: string;
  red: string;
  fontDisplay: string;
  fontMono: string;
  weights: Record<string, number>;
}

export interface ThemeProfileShape {
  tokens: ThemeProfileTokens;
  source?: { shop?: string; themeName?: string; themeUpdatedAt?: string };
}

export interface BrandKitContent {
  derivedFrom: { themeProfile: string; shop: string | null; themeUpdatedAt: string | null };
  colours: { name: string; hex: string; use: string }[];
  typography: { role: string; family: string; weights: number[] }[];
  tone: string[];
  vocabulary: { prefer: string[]; avoid: string[] };
  prohibitedPhrases: string[];
  approvedBrandVariations: string[];
  productPresentationRules: string[];
  ctaPatterns: string[];
  watermarkRules: string[];
  responsibleConsumptionLine: string | null;
  business: {
    tradingName: string;
    licenceNumber: string | null;
    licensedPremises: string | null;
    deliveryAreas: string | null;
    timezone: string;
    currency: string;
  };
  socialHandles: Record<string, string | null>;
  channelGuidance: { platform: string; guidance: string }[];
  visualReferences: string[];
}

export interface BuiltBrandKit {
  content: BrandKitContent;
  /** Dot-paths an administrator must confirm before the kit is complete. */
  placeholders: string[];
}

export const PLACEHOLDER = '[TO BE CONFIRMED]';

export interface BuildBrandKitInput {
  themeProfile: ThemeProfileShape;
  /** Present only when it has been read off something authoritative. */
  licenceNumber?: string | null;
  licensedPremises?: string | null;
  socialHandles?: Record<string, string | null>;
  timezone?: string;
  currency?: string;
}

export function buildBrandKit(input: BuildBrandKitInput): BuiltBrandKit {
  const { tokens, source } = input.themeProfile;
  const placeholders: string[] = [];
  const placeholder = (path: string): null => {
    placeholders.push(path);
    return null;
  };

  const content: BrandKitContent = {
    derivedFrom: {
      themeProfile: 'docs/spirithaus/theme-profile.json',
      shop: source?.shop ?? null,
      themeUpdatedAt: source?.themeUpdatedAt ?? null,
    },
    colours: [
      { name: 'ink', hex: tokens.ink, use: 'Text, and the scrim laid over photography.' },
      { name: 'bone', hex: tokens.bone, use: 'Page background and reversed type.' },
      { name: 'white', hex: tokens.white, use: 'Surfaces and cards.' },
      {
        name: 'red',
        hex: tokens.red,
        use: 'One accent, for calls to action only. Never decorative.',
      },
    ],
    typography: [
      {
        role: 'display',
        family: tokens.fontDisplay,
        weights: [
          tokens.weights.light ?? 300,
          tokens.weights.regular ?? 400,
          tokens.weights.black ?? 900,
        ],
      },
      { role: 'mono', family: tokens.fontMono, weights: [tokens.weights.regular ?? 400] },
    ],
    // Derived from the shooting brief already in the repository, which was written to
    // the ABAC code.
    tone: [
      'Premium, knowledgeable, welcoming, visually refined.',
      'Plain Australian English. No exclamation marks, no emoji.',
      'A shop, not a party. The range is the subject; people are hands and context.',
    ],
    vocabulary: {
      prefer: ['serve', 'botanicals', 'distillery', 'the range', 'order', 'delivered'],
      avoid: ['booze', 'grog', 'cheap', 'smashed', 'sesh', 'bevvy'],
    },
    prohibitedPhrases: ['drink responsibly'],
    approvedBrandVariations: [],
    productPresentationRules: [
      'The bottle, label, closure and packaging are photographed, never generated.',
      'Scenes only: a generated environment may surround the product but must not redraw it.',
      'No legible third-party labels in a scene.',
      'Hands read 35 or older. No faces.',
      'The quiet zone is the bottom of the frame; a phone keeps only the middle half of the width.',
    ],
    ctaPatterns: ['Order at spirithaus.com.au', 'Browse the range', 'Link in bio'],
    watermarkRules: ['No watermark on product photography.', 'Wordmark on video end cards only.'],
    responsibleConsumptionLine:
      // Deliberately not written here. The exact wording is a compliance decision, and
      // 'drink responsibly' is on the prohibited list because it is the phrase every
      // regulator has seen used as a fig leaf.
      placeholder('responsibleConsumptionLine'),
    business: {
      tradingName: 'SPIRITHAUS',
      licenceNumber: input.licenceNumber ?? placeholder('business.licenceNumber'),
      licensedPremises: input.licensedPremises ?? placeholder('business.licensedPremises'),
      deliveryAreas: placeholder('business.deliveryAreas'),
      timezone: input.timezone ?? 'Australia/Sydney',
      currency: input.currency ?? 'AUD',
    },
    socialHandles: input.socialHandles ?? {
      facebook: null,
      instagram: null,
      x: null,
      tiktok: null,
      youtube: null,
      pinterest: null,
    },
    channelGuidance: [
      {
        platform: 'INSTAGRAM',
        guidance: 'First line carries the post. Link in bio; no link in caption.',
      },
      {
        platform: 'FACEBOOK',
        guidance: 'Story or offer, complete sentences, restrained hashtags.',
      },
      { platform: 'X', guidance: 'One sentence. The link is structural; the prose gives way.' },
      { platform: 'TIKTOK', guidance: 'Hook in the first second. Hands and sound, no faces.' },
      { platform: 'YOUTUBE', guidance: 'Title reads well in search. Uploads are quota-scarce.' },
      {
        platform: 'PINTEREST',
        guidance: 'Keyword-led title and description; it is a search engine.',
      },
    ],
    visualReferences: [
      'docs/spirithaus/image-prompt-pack.md — the shooting brief and negative prompt',
      'docs/spirithaus/safe-zone.svg — the measured safe zone on a 3:2 master',
    ],
  };

  if (!input.socialHandles) placeholders.push('socialHandles');

  return { content, placeholders };
}

/** Whether the kit can be used for generation yet, and what is missing if not. */
export function brandKitReadiness(placeholders: readonly string[]): {
  usable: boolean;
  blocking: string[];
} {
  // A campaign can be drafted without delivery areas. It cannot carry a
  // responsible-consumption line that nobody has confirmed.
  const blocking = placeholders.filter((path) =>
    ['responsibleConsumptionLine', 'business.licenceNumber'].includes(path),
  );
  return { usable: blocking.length === 0, blocking };
}
