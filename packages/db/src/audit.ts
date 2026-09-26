import type { AuditEntry } from '@spirithaus/domain';
import type { PrismaClient } from '@prisma/client';

/**
 * The only way to write the audit trail. There is deliberately no update and no
 * delete: the table rejects both at the database level (migration
 * 20260926031700_audit_append_only), so this module having no such function is a
 * statement of intent rather than the enforcement.
 */
export async function recordAudit(prisma: PrismaClient, entry: AuditEntry): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      shopId: entry.shopId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId ?? null,
      actorUserId: entry.actorUserId ?? null,
      actorRole: entry.actorRole ?? null,
      before: entry.before === undefined ? undefined : JSON.parse(JSON.stringify(entry.before)),
      after: entry.after === undefined ? undefined : JSON.parse(JSON.stringify(entry.after)),
      ip: entry.ip ?? null,
      requestId: entry.requestId ?? null,
    },
  });
}
