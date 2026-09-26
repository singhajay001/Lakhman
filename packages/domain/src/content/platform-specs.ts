/**
 * What each platform takes, and what it limits.
 *
 * **None of this is verified.** Section 4 requires every posting limit and media
 * specification to be checked against current official documentation, and this
 * environment cannot reach it (docs/social-studio/04-platforms-and-scopes.md). These
 * are starting values with `verified: false`, carried as a versioned spec so that a
 * verification pass changes data rather than code, and so that nothing downstream can
 * present a limit as confirmed when it is not.
 */
export const PLATFORM_SPEC_VERSION = '2026-09-26.unverified';

export const PLATFORMS = ['FACEBOOK', 'INSTAGRAM', 'X', 'TIKTOK', 'YOUTUBE', 'PINTEREST'] as const;
export type Platform = (typeof PLATFORMS)[number];

export interface PlatformSpec {
  platform: Platform;
  label: string;
  verified: false;
  /** Hard limit on the body a reader sees. Exceeding it is a blocking validation error. */
  captionMax: number;
  /** Beyond this the copy reads as keyword stuffing, which section 13 forbids. */
  hashtagMax: number;
  hashtagRecommended: number;
  altTextMax: number | null;
  titleMax: number | null;
  /** Aspect ratios this platform's formats use, as width:height. */
  aspects: string[];
  videoMaxSeconds: number | null;
  /** Whether a post may carry a clickable link in the body. */
  linkInBody: boolean;
  /** Components a variant for this platform must carry to be complete. */
  requires: readonly string[];
  /** Components this app will not build for this platform, and why. */
  refuses: readonly { component: string; reason: string }[];
}

export const PLATFORM_SPECS: Record<Platform, PlatformSpec> = {
  FACEBOOK: {
    platform: 'FACEBOOK',
    label: 'Facebook',
    verified: false,
    captionMax: 2000,
    hashtagMax: 3,
    hashtagRecommended: 2,
    altTextMax: 1000,
    titleMax: null,
    aspects: ['1:1', '4:5', '16:9'],
    videoMaxSeconds: 240,
    linkInBody: true,
    requires: ['opening', 'body', 'callToAction', 'trackedLink'],
    refuses: [],
  },
  INSTAGRAM: {
    platform: 'INSTAGRAM',
    label: 'Instagram',
    verified: false,
    captionMax: 2200,
    hashtagMax: 30,
    hashtagRecommended: 8,
    altTextMax: 1000,
    titleMax: null,
    aspects: ['4:5', '1:1', '9:16'],
    videoMaxSeconds: 90,
    // The link goes in the bio or a Story sticker, not the caption.
    linkInBody: false,
    requires: ['firstLine', 'captionShort', 'captionMedium', 'captionLong', 'altText'],
    refuses: [
      {
        component: 'productTag',
        reason:
          'Product tagging requires Instagram Shopping, which sits under Meta’s Commerce Policy prohibition on alcohol. Expected unavailable, pending verification.',
      },
    ],
  },
  X: {
    platform: 'X',
    label: 'X',
    verified: false,
    captionMax: 280,
    hashtagMax: 2,
    hashtagRecommended: 1,
    altTextMax: 1000,
    titleMax: null,
    aspects: ['16:9', '1:1'],
    videoMaxSeconds: 140,
    linkInBody: true,
    requires: ['post', 'alternativeHook', 'linkCardCopy'],
    refuses: [],
  },
  TIKTOK: {
    platform: 'TIKTOK',
    label: 'TikTok',
    verified: false,
    captionMax: 2200,
    hashtagMax: 5,
    hashtagRecommended: 4,
    altTextMax: null,
    titleMax: 100,
    aspects: ['9:16'],
    videoMaxSeconds: 180,
    linkInBody: false,
    requires: ['hook', 'storyboard', 'onScreenText', 'caption', 'searchTerms', 'disclosure'],
    refuses: [
      {
        component: 'paidCreative',
        reason:
          'TikTok’s advertising policy excludes alcohol. Organic only; no paid creative is built for this platform.',
      },
    ],
  },
  YOUTUBE: {
    platform: 'YOUTUBE',
    label: 'YouTube',
    verified: false,
    captionMax: 5000,
    hashtagMax: 3,
    hashtagRecommended: 3,
    altTextMax: null,
    titleMax: 100,
    aspects: ['16:9', '9:16'],
    videoMaxSeconds: 900,
    linkInBody: true,
    requires: ['titleOptions', 'description', 'script', 'shotList', 'thumbnailBrief', 'endScreen'],
    refuses: [],
  },
  PINTEREST: {
    platform: 'PINTEREST',
    label: 'Pinterest',
    verified: false,
    captionMax: 500,
    hashtagMax: 4,
    hashtagRecommended: 3,
    altTextMax: 500,
    titleMax: 100,
    aspects: ['2:3', '9:16'],
    videoMaxSeconds: 900,
    linkInBody: false,
    requires: ['pinTitle', 'description', 'destination', 'altText', 'boardSuggestion'],
    refuses: [],
  },
};

export const specFor = (platform: Platform): PlatformSpec => PLATFORM_SPECS[platform];

export type ValidationIssue = {
  platform: Platform;
  field: string;
  problem: string;
  /** Blocking issues stop publication; advisory ones are shown to the author. */
  blocking: boolean;
};

/** Checks a variant against its platform's spec. Structural only — not compliance. */
export function validateAgainstSpec(input: {
  platform: Platform;
  primaryCopy: string;
  hashtags: readonly string[];
  altText?: string | null;
  title?: string | null;
  destinationUrl?: string | null;
  components: readonly string[];
}): ValidationIssue[] {
  const spec = specFor(input.platform);
  const issues: ValidationIssue[] = [];
  const add = (field: string, problem: string, blocking = true) =>
    issues.push({ platform: input.platform, field, problem, blocking });

  if (input.primaryCopy.trim().length === 0) add('primaryCopy', 'the copy is empty');
  if (input.primaryCopy.length > spec.captionMax) {
    add(
      'primaryCopy',
      `${input.primaryCopy.length} characters against a limit of ${spec.captionMax}`,
    );
  }

  if (input.hashtags.length > spec.hashtagMax) {
    add('hashtags', `${input.hashtags.length} hashtags against a limit of ${spec.hashtagMax}`);
  } else if (input.hashtags.length > spec.hashtagRecommended) {
    add(
      'hashtags',
      `${input.hashtags.length} hashtags, above the ${spec.hashtagRecommended} this platform reads well with`,
      false,
    );
  }

  const duplicates = input.hashtags.filter(
    (tag, index) =>
      input.hashtags.findIndex((other) => other.toLowerCase() === tag.toLowerCase()) !== index,
  );
  if (duplicates.length > 0) add('hashtags', `repeated hashtags: ${duplicates.join(', ')}`);

  if (spec.altTextMax !== null && input.altText && input.altText.length > spec.altTextMax) {
    add('altText', `${input.altText.length} characters against a limit of ${spec.altTextMax}`);
  }
  if (spec.altTextMax !== null && !input.altText) {
    // Accessibility is a stated requirement of section 13, not a nicety.
    add('altText', 'this platform supports alt text and none was written', false);
  }

  if (spec.titleMax !== null && input.title && input.title.length > spec.titleMax) {
    add('title', `${input.title.length} characters against a limit of ${spec.titleMax}`);
  }

  if (!spec.linkInBody && input.primaryCopy.match(/https?:\/\//)) {
    add(
      'primaryCopy',
      'this platform does not make a link in the body clickable, so the copy points somewhere the reader cannot follow',
      false,
    );
  }

  for (const required of spec.requires) {
    if (!input.components.includes(required)) add('components', `missing ${required}`);
  }

  return issues;
}
