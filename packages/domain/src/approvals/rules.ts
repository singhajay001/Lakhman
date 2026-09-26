import type { RoleKey } from '../rbac/roles.js';

/**
 * Who may sign what, and how many keys it takes (section 20).
 *
 * The threshold is not defaulted. Until an administrator sets it, any paid action is
 * refused rather than treated as below a number this code chose — blocking question 6 in
 * docs/social-studio/README.md.
 */
export const APPROVAL_KINDS = [
  'ORGANIC_PUBLICATION',
  'HIGH_RISK_CONTENT',
  'PAID_BUDGET',
  'BUDGET_SCALING',
  'COMPETITION',
  'COMPLIANCE_EXCEPTION',
] as const;

export type ApprovalKind = (typeof APPROVAL_KINDS)[number];

export interface KeyRequirement {
  /** Roles that may hold key 1. */
  first: readonly RoleKey[];
  /** Roles that may hold key 2, where a second key is required. */
  second: readonly RoleKey[];
  keys: 1 | 2;
  why: string;
}

/**
 * Administrator appears in none of these lists. An account that can grant itself a
 * role must not also be an approval key (docs/adr/0007).
 */
export const KEY_REQUIREMENTS: Record<ApprovalKind, KeyRequirement> = {
  ORGANIC_PUBLICATION: {
    keys: 1,
    first: ['campaign_manager'],
    second: [],
    why: 'One Campaign Manager approval, per section 20.',
  },
  HIGH_RISK_CONTENT: {
    keys: 2,
    first: ['campaign_manager'],
    second: ['compliance_reviewer'],
    why: 'Content the compliance engine flagged as high risk needs a Compliance Reviewer as well.',
  },
  PAID_BUDGET: {
    keys: 2,
    first: ['campaign_manager'],
    second: ['finance_approver'],
    why: 'Paid budget activation above the configured threshold requires two distinct people.',
  },
  BUDGET_SCALING: {
    keys: 2,
    first: ['campaign_manager'],
    second: ['finance_approver'],
    why: 'Scaling a budget above the threshold is a new financial commitment.',
  },
  COMPETITION: {
    keys: 2,
    first: ['campaign_manager'],
    second: ['compliance_reviewer'],
    why: 'Competitions and giveaways carry terms, permit and platform-policy exposure.',
  },
  COMPLIANCE_EXCEPTION: {
    keys: 2,
    first: ['campaign_manager'],
    second: ['compliance_reviewer'],
    why: 'Accepting a blocking compliance finding is an exception, and is recorded as one.',
  },
};

export interface ApprovalRequest {
  kind: ApprovalKind;
  budgetAud?: number | null;
  /** From settings. Null means no administrator has set it yet. */
  dualControlThresholdAud?: number | null;
  /** True when the compliance run produced a blocking finding a reviewer accepted. */
  hasComplianceException?: boolean;
  /** True when the compliance run produced any high-risk advisory finding. */
  isHighRisk?: boolean;
}

export type RequirementOutcome =
  { ok: true; keys: 1 | 2; requirement: KeyRequirement } | { ok: false; reason: string };

/**
 * Computes the requirement from the action, never from what the requester asked for.
 * A paid action with no configured threshold is refused: proceeding would mean choosing
 * a threshold on the business's behalf.
 */
export function requiredKeysFor(request: ApprovalRequest): RequirementOutcome {
  const paid = request.kind === 'PAID_BUDGET' || request.kind === 'BUDGET_SCALING';

  if (paid) {
    if (request.dualControlThresholdAud === null || request.dualControlThresholdAud === undefined) {
      return {
        ok: false,
        reason:
          'No dual-control budget threshold is configured. An administrator must set one in Settings before any paid action can be approved.',
      };
    }
    if (request.budgetAud === null || request.budgetAud === undefined) {
      return { ok: false, reason: 'A paid approval needs a budget amount.' };
    }
    if (request.budgetAud <= 0) {
      return { ok: false, reason: 'A paid budget must be greater than zero.' };
    }
    // Below the threshold a paid activation still needs a Campaign Manager, just not
    // two keys.
    if (request.budgetAud < request.dualControlThresholdAud) {
      return {
        ok: true,
        keys: 1,
        requirement: { ...KEY_REQUIREMENTS[request.kind], keys: 1, second: [] },
      };
    }
    return { ok: true, keys: 2, requirement: KEY_REQUIREMENTS[request.kind] };
  }

  if (request.hasComplianceException) {
    return { ok: true, keys: 2, requirement: KEY_REQUIREMENTS.COMPLIANCE_EXCEPTION };
  }
  if (request.kind === 'ORGANIC_PUBLICATION' && request.isHighRisk) {
    return { ok: true, keys: 2, requirement: KEY_REQUIREMENTS.HIGH_RISK_CONTENT };
  }

  const requirement = KEY_REQUIREMENTS[request.kind];
  return { ok: true, keys: requirement.keys, requirement };
}

export type KeyEligibility =
  { eligible: true; role: RoleKey } | { eligible: false; reason: string };

/**
 * Whether this person may hold this key. Checked before the insert so the refusal
 * explains itself; the database refuses it too (unique on approvalId+userId), which is
 * what makes one person signing twice impossible rather than merely discouraged.
 */
export function canHoldKey(input: {
  requirement: KeyRequirement;
  keyIndex: 1 | 2;
  roles: readonly RoleKey[];
  userId: string;
  alreadySignedBy: readonly string[];
}): KeyEligibility {
  if (input.keyIndex > input.requirement.keys) {
    return {
      eligible: false,
      reason: `This approval needs ${input.requirement.keys} key(s), so there is no key ${input.keyIndex}.`,
    };
  }

  if (input.alreadySignedBy.includes(input.userId)) {
    return {
      eligible: false,
      reason:
        'This account has already signed this approval. Dual control requires two distinct people.',
    };
  }

  const permitted = input.keyIndex === 1 ? input.requirement.first : input.requirement.second;
  const held = input.roles.find((role) => permitted.includes(role));
  if (!held) {
    return {
      eligible: false,
      reason: `Key ${input.keyIndex} must be held by one of: ${permitted.join(', ')}.`,
    };
  }

  return { eligible: true, role: held };
}
