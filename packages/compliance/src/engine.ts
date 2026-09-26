import { ABAC_RULES } from './rules/abac.js';
import { FACT_RULES } from './rules/facts.js';
import { PROMOTION_RULES } from './rules/promotions.js';
import { BRAND_RULES } from './rules/brand.js';
import {
  DISCLAIMER,
  RULESET_VERSION,
  type ComplianceInput,
  type Finding,
  type Report,
  type Rule,
  type Severity,
} from './types.js';

export const ALL_RULES: readonly Rule[] = [
  ...ABAC_RULES,
  ...FACT_RULES,
  ...PROMOTION_RULES,
  ...BRAND_RULES,
];

/**
 * Rules that become blocking on paid creative. Section 32 treats paid placements more
 * strictly, and several platforms require the wording as a condition of running the ad.
 */
const ESCALATED_ON_PAID = new Set(['abac.service.responsible_line']);

export function runCompliance(input: ComplianceInput, rules: readonly Rule[] = ALL_RULES): Report {
  const findings: Finding[] = [];

  for (const rule of rules) {
    const applicable = rule.applies ? rule.applies(input) : true;
    const severity: Severity =
      input.paid && ESCALATED_ON_PAID.has(rule.id) ? 'BLOCKING' : rule.severity;

    if (!applicable) {
      findings.push({
        ruleId: rule.id,
        code: rule.code,
        category: rule.category,
        severity,
        outcome: 'NOT_APPLICABLE',
        title: rule.title,
        explanation: rule.standard,
        suggestion: rule.suggestion,
        evidence: [],
      });
      continue;
    }

    const evidence = rule.check(input);
    findings.push({
      ruleId: rule.id,
      code: rule.code,
      category: rule.category,
      severity,
      outcome: evidence.length > 0 ? 'FAIL' : 'PASS',
      title: rule.title,
      explanation: rule.standard,
      suggestion: rule.suggestion,
      evidence,
    });
  }

  const failed = findings.filter((finding) => finding.outcome === 'FAIL');
  const blocking = failed.filter((finding) => finding.severity === 'BLOCKING');
  const advisory = failed.filter((finding) => finding.severity === 'ADVISORY');

  return {
    rulesetVersion: RULESET_VERSION,
    platform: input.platform,
    findings,
    blocking,
    advisory,
    // Advisory findings are shown, not enforced. Blocking ones stop publication unless a
    // Compliance Reviewer records an exception, which then needs two keys.
    publishable: blocking.length === 0,
    disclaimer: DISCLAIMER,
  };
}

/** True when a report's failures warrant a Compliance Reviewer as a second key. */
export function isHighRisk(report: Report): boolean {
  return (
    report.blocking.length > 0 ||
    report.advisory.some((finding) =>
      ['minors', 'health', 'consumption', 'safety', 'social_success'].includes(finding.category),
    )
  );
}

/** A one-line summary for a list view. Honest about what a pass does and does not mean. */
export function summarise(report: Report): string {
  if (report.blocking.length > 0) {
    return `${report.blocking.length} blocking, ${report.advisory.length} advisory — cannot publish`;
  }
  if (report.advisory.length > 0) {
    return `${report.advisory.length} advisory finding${report.advisory.length === 1 ? '' : 's'} for review`;
  }
  return 'No finding — still requires human review';
}
