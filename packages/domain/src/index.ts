export { ok, err, unwrapOr, type Result } from './result.js';
export { DomainError, httpStatusFor, type DomainErrorCode } from './errors.js';
export { PERMISSIONS, isPermission, type Permission } from './rbac/permissions.js';
export { ROLES, ROLE_KEYS, isRoleKey, type RoleKey, type RoleDefinition } from './rbac/roles.js';
export {
  can,
  canAll,
  requirePermission,
  permissionsFor,
  type Principal,
} from './rbac/authorize.js';
export { AUDIT_ACTIONS, type AuditAction, type AuditEntry } from './audit/actions.js';
export {
  DEFAULT_TIMEZONE,
  formatInZone,
  offsetMinutes,
  zonedTimeToUtc,
  isWithin,
  type Window,
} from './time.js';
export {
  PLATFORMS,
  PLATFORM_SPECS,
  PLATFORM_SPEC_VERSION,
  specFor,
  validateAgainstSpec,
  type Platform,
  type PlatformSpec,
  type ValidationIssue,
} from './content/platform-specs.js';
export {
  APPROVAL_KINDS,
  KEY_REQUIREMENTS,
  requiredKeysFor,
  canHoldKey,
  type ApprovalKind,
  type ApprovalRequest,
  type KeyRequirement,
  type RequirementOutcome,
  type KeyEligibility,
} from './approvals/rules.js';
export {
  buildFactSheet,
  approvedValues,
  approvedPrices,
  hasApprovedField,
  promptFacts,
  conflicts,
  SINGLE_VALUED_FIELDS,
  type Fact,
  type FactSheet,
  type ClaimInput,
  type ProductTruth,
} from './research/facts.js';
export {
  buildBrandKit,
  brandKitReadiness,
  PLACEHOLDER,
  type BrandKitContent,
  type BuiltBrandKit,
  type BuildBrandKitInput,
  type ThemeProfileShape,
  type ThemeProfileTokens,
} from './brand/kit.js';
