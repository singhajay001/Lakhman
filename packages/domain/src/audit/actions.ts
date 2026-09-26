/**
 * Audit action catalogue (section 20). Closed, like the permission list, so that
 * the audit log is queryable rather than a set of ad-hoc strings.
 */
export const AUDIT_ACTIONS = [
  'app.installed',
  'app.uninstalled',
  'app.scopes_changed',

  'user.created',
  'user.role_granted',
  'user.role_revoked',
  'user.suspended',

  'product.synced',
  'product.sync_started',
  'product.sync_failed',
  'product.reconciled',

  'provider.enabled',
  'provider.disabled',
  'provider.rate_card_set',
  'provider.budget_changed',

  'prompt.version_created',
  'prompt.version_activated',

  'webhook.received',
  'webhook.duplicate_skipped',
  'webhook.failed',

  'emergency.stop_engaged',
  'emergency.stop_released',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditEntry {
  shopId: string;
  action: AuditAction;
  targetType: string;
  targetId?: string;
  actorUserId?: string;
  actorRole?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
  requestId?: string;
}
