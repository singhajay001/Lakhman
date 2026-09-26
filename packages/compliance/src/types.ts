import type { FactSheet, Platform } from '@spirithaus/domain';

/**
 * The compliance engine (section 32).
 *
 * First-party and versioned rather than a provider call, because section 32 requires a
 * rule identifier, a severity, the evidence, an explanation, a suggested correction and
 * a reviewer's decision per finding — and a vendor score supplies none of those.
 *
 * It is not legal advice, and the report says so in the text the reviewer reads. What it
 * is: a configurable set of checks that assist a human review.
 */
export const RULESET_VERSION = '2026-09-26.1';

export type Severity = 'BLOCKING' | 'ADVISORY' | 'INFO';
export type Outcome = 'PASS' | 'FAIL' | 'NOT_APPLICABLE';

export type Category =
  | 'minors'
  | 'consumption'
  | 'health'
  | 'social_success'
  | 'safety'
  | 'responsible_service'
  | 'unsupported_claim'
  | 'pricing'
  | 'availability'
  | 'promotion_terms'
  | 'brand'
  | 'platform_policy'
  | 'search';

/** One field of the content, named so evidence can point at it. */
export interface TextField {
  /** 'primaryCopy', 'hook', 'script', 'onScreenText', 'altText', 'title', … */
  name: string;
  value: string;
}

export interface ComplianceInput {
  platform: Platform;
  fields: readonly TextField[];
  hashtags: readonly string[];
  factSheet: FactSheet;
  /** Components the variant actually carries, checked against what the platform refuses. */
  components: readonly string[];
  /** Whether this is paid creative. Several rules are stricter for paid. */
  paid: boolean;
  /** Recorded promotion terms, if any. */
  offerTerms?: string | null;
  /** Whether a competition approval exists for this campaign. */
  competitionApproved?: boolean;
  brand: BrandRules;
}

export interface BrandRules {
  /** Exact phrases the Brand Kit forbids. */
  prohibitedPhrases: readonly string[];
  /** Brand-name spellings an administrator has recorded as approved. */
  approvedBrandVariations: readonly string[];
  /** The responsible-consumption line the Brand Kit holds, if one is confirmed. */
  responsibleConsumptionLine?: string | null;
  brandKitVersionId?: string | null;
}

export interface Evidence {
  field: string;
  match: string;
  /** Character offset within that field, so the editor can highlight it. */
  index: number;
  excerpt: string;
}

export interface Finding {
  ruleId: string;
  code: string;
  category: Category;
  severity: Severity;
  outcome: Outcome;
  title: string;
  /** What the rule checks, in words a reviewer can act on. */
  explanation: string;
  suggestion: string;
  evidence: Evidence[];
}

export interface Rule {
  id: string;
  /** A short stable code for the report, e.g. ABAC-MINORS-1. */
  code: string;
  category: Category;
  severity: Severity;
  title: string;
  /** The standard this check is aimed at, described rather than cited by clause. */
  standard: string;
  suggestion: string;
  /** Returns the evidence that the rule fired on. Empty means the content passed. */
  check(input: ComplianceInput): Evidence[];
  /** When false, the rule reports NOT_APPLICABLE instead of running. */
  applies?(input: ComplianceInput): boolean;
}

export interface Report {
  rulesetVersion: string;
  platform: Platform;
  findings: Finding[];
  blocking: Finding[];
  advisory: Finding[];
  /** True when nothing blocking fired. Advisory findings do not stop publication. */
  publishable: boolean;
  /** Shown verbatim to the reviewer. Section 32 requires it. */
  disclaimer: string;
}

export const DISCLAIMER =
  'These automated checks assist human review and are not legal advice. They are a configurable set of patterns aimed at the ABAC Responsible Alcohol Marketing Code, Australian Consumer Law principles, NSW liquor requirements and platform policies; they cannot confirm compliance, and a clean report is not an approval. A Compliance Reviewer decides.';
