import { PROVIDER_CONTRACTS, type ProviderContract } from './contracts/common.js';
import {
  MockObjectStorageProvider,
  MockSocialPublishingProvider,
  MockTextGenerationProvider,
  MockVideoRenderProvider,
  MockVoiceProvider,
  UnconfiguredProvider,
} from './adapters/mock/index.js';
import type { AnyProvider, SocialPlatform } from './contracts/index.js';

/**
 * Which adapter serves which contract, resolved from configuration.
 *
 * Every contract resolves to something. A contract with no live adapter resolves to
 * an UnconfiguredProvider that reports unavailable with a reason, rather than to
 * undefined — section 3's honest-capability rule is easier to keep when the absence
 * of a provider is itself an object with an explanation.
 */
export const SELECTION_ENV_VAR: Record<ProviderContract, string> = {
  TextGenerationProvider: 'PROVIDER_TEXT',
  ResearchProvider: 'PROVIDER_RESEARCH',
  TrendIntelligenceProvider: 'PROVIDER_TREND',
  CopyScoringProvider: 'PROVIDER_COPY_SCORING',
  ImageGenerationProvider: 'PROVIDER_IMAGE',
  ImageEditingProvider: 'PROVIDER_IMAGE_EDIT',
  AvatarVideoProvider: 'PROVIDER_AVATAR',
  VoiceProvider: 'PROVIDER_VOICE',
  VideoGenerationProvider: 'PROVIDER_VIDEO_GEN',
  VideoRenderProvider: 'PROVIDER_VIDEO_RENDER',
  ModerationProvider: 'PROVIDER_MODERATION',
  SocialPublishingProvider: 'PROVIDER_PUBLISHING',
  SocialAnalyticsProvider: 'PROVIDER_SOCIAL_ANALYTICS',
  AttributionProvider: 'PROVIDER_ATTRIBUTION',
  EmailMarketingProvider: 'PROVIDER_EMAIL',
  ObjectStorageProvider: 'PROVIDER_STORAGE',
};

/**
 * Contracts deliberately shipped with no provider for the initial release, and why.
 * docs/social-studio/05-providers.md.
 */
export const DEFERRED_CONTRACTS: Partial<Record<ProviderContract, string>> = {
  TrendIntelligenceProvider:
    'No provider configured. Shipping an adapter without a credible permitted data source would misrepresent what the app can observe (section 10).',
  AvatarVideoProvider:
    'Disabled. AI-avatar video requires a provider evaluation and compliance review before it is enabled (section 18).',
  VideoGenerationProvider:
    'Disabled. Generative video cannot be constrained to leave a real label intact across frames (section 15).',
  EmailMarketingProvider:
    'Optional and disabled. Klaviyo is enabled per shop by an administrator (section 25).',
};

export interface ProviderSelection {
  contract: ProviderContract;
  adapterId: string;
  envVar: string;
  configured: boolean;
}

export function readSelections(env: NodeJS.ProcessEnv = process.env): ProviderSelection[] {
  return PROVIDER_CONTRACTS.map((contract) => {
    const envVar = SELECTION_ENV_VAR[contract];
    const raw = env[envVar]?.trim();
    return {
      contract,
      envVar,
      adapterId: raw && raw.length > 0 ? raw : 'mock',
      configured: Boolean(raw && raw.length > 0 && raw !== 'mock'),
    };
  });
}

export const SOCIAL_PLATFORMS: readonly SocialPlatform[] = [
  'facebook',
  'instagram',
  'x',
  'tiktok',
  'youtube',
  'pinterest',
];

/**
 * Builds the adapter for a contract. Only mock adapters exist in Phase 1; a live
 * adapter registers here and everything upstream is unchanged, which is the whole
 * point of the contract layer.
 */
export function resolveAdapter(
  contract: ProviderContract,
  adapterId: string,
): AnyProvider | UnconfiguredProvider {
  const deferred = DEFERRED_CONTRACTS[contract];
  if (deferred && adapterId === 'mock') return new UnconfiguredProvider(contract, deferred);

  if (adapterId !== 'mock') {
    return new UnconfiguredProvider(
      contract,
      `Adapter "${adapterId}" is named in ${SELECTION_ENV_VAR[contract]} but is not implemented in this build. Nothing was contacted.`,
    );
  }

  switch (contract) {
    case 'TextGenerationProvider':
      return new MockTextGenerationProvider();
    case 'ObjectStorageProvider':
      return new MockObjectStorageProvider();
    case 'SocialPublishingProvider':
      return new MockSocialPublishingProvider('instagram');
    case 'VoiceProvider':
      return new MockVoiceProvider();
    case 'VideoRenderProvider':
      return new MockVideoRenderProvider();
    default:
      return new UnconfiguredProvider(
        contract,
        `No adapter is implemented for ${contract} in Phase 1. It is defined as a contract and mocked where a feature needs it.`,
      );
  }
}

export function publishingAdapter(
  platform: SocialPlatform,
  adapterId: string,
): MockSocialPublishingProvider | UnconfiguredProvider {
  if (adapterId !== 'mock') {
    return new UnconfiguredProvider(
      'SocialPublishingProvider',
      `No live ${platform} adapter in this build. Publishing is not possible and is reported as not published.`,
    );
  }
  return new MockSocialPublishingProvider(platform);
}
