export {
  PLATFORM_UTM_SOURCE,
  buildTrackedLink,
  campaignCode,
  readTracking,
  slug,
  type TrackedLinkInput,
} from './utm.js';
export {
  simhash,
  hammingDistance,
  isNearDuplicate,
  NEAR_DUPLICATE_BITS,
  type Simhash,
} from './simhash.js';
export {
  buildStrategy,
  OCCASION_PRESETS,
  HIGH_RISK_OCCASIONS,
  type CampaignStrategy,
  type BriefInput,
} from './strategy.js';
export {
  generateVariant,
  fit,
  PROMPT_VERSION,
  type VariantDraft,
  type GenerateInput,
  type GenerateFailure,
} from './variants.js';
export {
  assessQuality,
  QUALITY_DIMENSIONS,
  QUALITY_CAVEAT,
  type QualityAssessment,
  type QualityDimension,
  type DimensionScore,
  type AssessInput,
} from './quality.js';
