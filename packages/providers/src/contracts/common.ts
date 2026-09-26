import type { Result } from '@spirithaus/domain';
import type { CostEstimate, RateCard, Usage } from '@spirithaus/observability';

/**
 * The envelope every adapter shares. This is the part that makes provider
 * independence real rather than aspirational: capability detection, config
 * validation, health, and a cost estimate are not optional for any adapter,
 * including the mocks.
 */
export const PROVIDER_CONTRACTS = [
  'TextGenerationProvider',
  'ResearchProvider',
  'TrendIntelligenceProvider',
  'CopyScoringProvider',
  'ImageGenerationProvider',
  'ImageEditingProvider',
  'AvatarVideoProvider',
  'VoiceProvider',
  'VideoGenerationProvider',
  'VideoRenderProvider',
  'ModerationProvider',
  'SocialPublishingProvider',
  'SocialAnalyticsProvider',
  'AttributionProvider',
  'EmailMarketingProvider',
  'ObjectStorageProvider',
] as const;

export type ProviderContract = (typeof PROVIDER_CONTRACTS)[number];

export type ProviderErrorClass =
  | 'auth'
  | 'rate_limit'
  | 'quota'
  | 'invalid_input'
  | 'policy'
  | 'transient'
  | 'timeout'
  | 'unavailable'
  | 'budget_refused';

export interface ProviderError {
  class: ProviderErrorClass;
  message: string;
  /** The provider's own request identifier, when it gave one. Needed to raise a ticket. */
  providerRequestId?: string;
  retryable: boolean;
  retryAfterMs?: number;
}

export interface ProviderSuccess<T> {
  value: T;
  usage: Usage;
  providerRequestId?: string;
  /** True when this came from a mock. Never suppressed — section 21. */
  mock: boolean;
}

export type ProviderResult<T> = Result<ProviderSuccess<T>, ProviderError>;

export interface Capability {
  /** e.g. "publish:instagram:reel", "generate:image:inpaint" */
  id: string;
  available: boolean;
  /**
   * False until someone checked the platform's current documentation. The UI refuses
   * to enable an unverified capability (docs/social-studio/04-platforms-and-scopes.md).
   */
  verified: boolean;
  /** Why it is unavailable, in words a user can act on. */
  reason?: string;
  documentationUrl?: string;
  checkedAt?: string;
}

export type ConfigResult = { valid: true } | { valid: false; missing: string[]; message: string };

export type HealthResult =
  | { healthy: true; latencyMs: number }
  | { healthy: false; message: string; class: ProviderErrorClass };

export interface ProviderAdapter {
  readonly contract: ProviderContract;
  /** "anthropic", "fal", "elevenlabs", "meta", "mock", … */
  readonly id: string;
  readonly isMock: boolean;
  capabilities(): Promise<Capability[]>;
  validateConfig(): ConfigResult;
  health(): Promise<HealthResult>;
  estimateCost(request: unknown, rateCard: RateCard | null): CostEstimate;
}

export const providerError = (
  errorClass: ProviderErrorClass,
  message: string,
  extra: Partial<Omit<ProviderError, 'class' | 'message'>> = {},
): ProviderError => ({
  class: errorClass,
  message,
  retryable: extra.retryable ?? ['transient', 'timeout', 'rate_limit'].includes(errorClass),
  ...extra,
});
