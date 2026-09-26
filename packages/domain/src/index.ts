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
