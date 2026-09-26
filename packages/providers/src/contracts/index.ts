import type { RateCard, Usage } from '@spirithaus/observability';
import type { Capability, ProviderAdapter, ProviderResult } from './common.js';

export * from './common.js';

// --- Text, research, intelligence, scoring -------------------------------------

export interface TextGenerationRequest {
  system: string;
  /** Retrieved material is passed here, never in `system`. Section 33. */
  untrustedContext?: { origin: string; content: string }[];
  prompt: string;
  maxOutputTokens: number;
  temperature?: number;
  model?: string;
}

export interface TextGenerationProvider extends ProviderAdapter {
  readonly contract: 'TextGenerationProvider';
  generate(
    request: TextGenerationRequest,
  ): Promise<ProviderResult<{ text: string; model: string }>>;
}

export interface ResearchHit {
  url: string;
  publisher?: string;
  title?: string;
  retrievedAt: string;
  content: string;
}

export interface ResearchProvider extends ProviderAdapter {
  readonly contract: 'ResearchProvider';
  search(query: string, limit: number): Promise<ProviderResult<ResearchHit[]>>;
  fetch(url: string): Promise<ProviderResult<ResearchHit>>;
}

export interface TrendObservation {
  term: string;
  platform: string;
  market: string;
  observedAt: string;
  sampleSize: number;
  velocity: number;
  sourceUrl?: string;
}

export interface TrendIntelligenceProvider extends ProviderAdapter {
  readonly contract: 'TrendIntelligenceProvider';
  observe(category: string, market: string): Promise<ProviderResult<TrendObservation[]>>;
}

export interface CopyScore {
  dimension: string;
  score: number;
  /** Section 13: a score without a reason is not a score. */
  reason: string;
  /** Section 27: an external number is a provider estimate, and is labelled one. */
  providerEstimate: boolean;
}

export interface CopyScoringProvider extends ProviderAdapter {
  readonly contract: 'CopyScoringProvider';
  score(
    copy: string,
    context: { platform: string; objective: string },
  ): Promise<ProviderResult<CopyScore[]>>;
}

// --- Image and video -----------------------------------------------------------

export interface ImageGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  widthPx: number;
  heightPx: number;
  steps?: number;
  seed?: number;
}

export interface GeneratedImage {
  bytes: Uint8Array;
  contentType: 'image/png' | 'image/jpeg' | 'image/webp';
  widthPx: number;
  heightPx: number;
  seed?: number;
}

export interface ImageGenerationProvider extends ProviderAdapter {
  readonly contract: 'ImageGenerationProvider';
  generate(request: ImageGenerationRequest): Promise<ProviderResult<GeneratedImage>>;
}

/**
 * The protected-product pipeline needs mask-conditioned inpainting rather than
 * text-to-image, and an adapter that cannot honour a mask must say so through
 * `capabilities()` rather than quietly repainting the bottle.
 */
export interface ImageEditRequest extends ImageGenerationRequest {
  reference: { bytes: Uint8Array; contentType: string };
  /** White where the model may paint, black where it may not. */
  mask: { bytes: Uint8Array; contentType: string };
  structure?: { kind: 'depth' | 'edge'; bytes: Uint8Array; contentType: string };
}

export interface ImageEditingProvider extends ProviderAdapter {
  readonly contract: 'ImageEditingProvider';
  edit(request: ImageEditRequest): Promise<ProviderResult<GeneratedImage>>;
}

export interface AvatarVideoProvider extends ProviderAdapter {
  readonly contract: 'AvatarVideoProvider';
  render(request: {
    script: string;
    avatarId: string;
    aspect: string;
  }): Promise<ProviderResult<{ jobId: string }>>;
  status(
    jobId: string,
  ): Promise<ProviderResult<{ state: 'pending' | 'done' | 'failed'; url?: string }>>;
}

export interface VoiceProvider extends ProviderAdapter {
  readonly contract: 'VoiceProvider';
  speak(request: { text: string; voiceId: string }): Promise<
    ProviderResult<{
      audio: Uint8Array;
      contentType: string;
      /** Word-level alignment drives caption timing. */
      alignment?: { word: string; startMs: number; endMs: number }[];
    }>
  >;
  /** Cloning is disabled by default and requires recorded consent (section 17). */
  cloneVoice?(request: {
    consentRecordId: string;
    samples: Uint8Array[];
  }): Promise<ProviderResult<{ voiceId: string }>>;
}

export interface VideoGenerationProvider extends ProviderAdapter {
  readonly contract: 'VideoGenerationProvider';
  generate(request: {
    prompt: string;
    seconds: number;
    aspect: string;
  }): Promise<ProviderResult<{ jobId: string }>>;
}

export interface VideoRenderProvider extends ProviderAdapter {
  readonly contract: 'VideoRenderProvider';
  render(request: {
    composition: string;
    props: Record<string, unknown>;
    aspect: string;
    fps: number;
    durationFrames: number;
  }): Promise<ProviderResult<{ jobId: string }>>;
  progress(jobId: string): Promise<ProviderResult<{ pct: number; done: boolean; url?: string }>>;
  cancel(jobId: string): Promise<ProviderResult<{ cancelled: boolean }>>;
}

// --- Moderation, social, analytics --------------------------------------------

export interface ModerationProvider extends ProviderAdapter {
  readonly contract: 'ModerationProvider';
  /** Advisory input to the first-party compliance engine, never the decision. */
  review(content: {
    text?: string;
    imageBytes?: Uint8Array;
  }): Promise<
    ProviderResult<{ flags: { category: string; confidence: number }[]; advisory: true }>
  >;
}

export type SocialPlatform = 'facebook' | 'instagram' | 'x' | 'tiktok' | 'youtube' | 'pinterest';

export interface PublishRequest {
  platform: SocialPlatform;
  accountId: string;
  /** Idempotency key owned by the caller; the adapter must pass it through where the API supports one. */
  idempotencyKey: string;
  body: string;
  mediaUrls: string[];
  scheduledAt?: Date;
  extra?: Record<string, unknown>;
}

export interface PublishOutcome {
  /**
   * False from every mock, always. Section 21 forbids simulating publication
   * success, so this flag is what the UI renders, not the absence of an error.
   */
  published: boolean;
  externalId?: string;
  publicUrl?: string;
  /** Asynchronous APIs (TikTok) return a job to poll rather than a post. */
  providerJobId?: string;
  state: 'published' | 'processing' | 'not_published';
}

export interface SocialPublishingProvider extends ProviderAdapter {
  readonly contract: 'SocialPublishingProvider';
  readonly platform: SocialPlatform;
  publish(request: PublishRequest): Promise<ProviderResult<PublishOutcome>>;
  pollStatus(providerJobId: string): Promise<ProviderResult<PublishOutcome>>;
}

export interface PlatformMetricRow {
  externalPostId: string;
  metric: string;
  value: number;
  /** Section 23: freshness, coverage and latency are recorded, never assumed. */
  measuredAt: string;
  coverage: 'complete' | 'partial';
}

export interface SocialAnalyticsProvider extends ProviderAdapter {
  readonly contract: 'SocialAnalyticsProvider';
  readonly platform: SocialPlatform;
  metrics(externalPostIds: string[]): Promise<
    ProviderResult<{
      rows: PlatformMetricRow[];
      freshness: { latestAt: string; latencyMinutes: number };
    }>
  >;
}

export interface AttributionProvider extends ProviderAdapter {
  readonly contract: 'AttributionProvider';
  ingest(
    events: { eventId: string; type: string; occurredAt: string; payload: unknown }[],
  ): Promise<ProviderResult<{ accepted: number; duplicates: number }>>;
}

export interface EmailMarketingProvider extends ProviderAdapter {
  readonly contract: 'EmailMarketingProvider';
  segments(): Promise<ProviderResult<{ id: string; name: string; size: number }[]>>;
}

export interface ObjectStorageProvider extends ProviderAdapter {
  readonly contract: 'ObjectStorageProvider';
  put(
    key: string,
    bytes: Uint8Array,
    contentType: string,
  ): Promise<ProviderResult<{ key: string }>>;
  get(key: string): Promise<ProviderResult<{ bytes: Uint8Array; contentType: string }>>;
  signedUrl(
    key: string,
    ttlSeconds: number,
  ): Promise<ProviderResult<{ url: string; expiresAt: string }>>;
  delete(key: string): Promise<ProviderResult<{ deleted: boolean }>>;
}

export type AnyProvider =
  | TextGenerationProvider
  | ResearchProvider
  | TrendIntelligenceProvider
  | CopyScoringProvider
  | ImageGenerationProvider
  | ImageEditingProvider
  | AvatarVideoProvider
  | VoiceProvider
  | VideoGenerationProvider
  | VideoRenderProvider
  | ModerationProvider
  | SocialPublishingProvider
  | SocialAnalyticsProvider
  | AttributionProvider
  | EmailMarketingProvider
  | ObjectStorageProvider;

export type { Capability, RateCard, Usage };
