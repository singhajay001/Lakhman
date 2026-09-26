export {
  RULESET_VERSION,
  DISCLAIMER,
  type Severity,
  type Outcome,
  type Category,
  type TextField,
  type ComplianceInput,
  type BrandRules,
  type Evidence,
  type Finding,
  type Rule,
  type Report,
} from './types.js';
export { findPhrases, findPattern, normaliseNumber } from './text.js';
export { ALL_RULES, runCompliance, isHighRisk, summarise } from './engine.js';
export { ABAC_RULES } from './rules/abac.js';
export { FACT_RULES } from './rules/facts.js';
export { PROMOTION_RULES } from './rules/promotions.js';
export { BRAND_RULES } from './rules/brand.js';
