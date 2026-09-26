import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from './client.js';
import { recordAudit } from './audit.js';

/**
 * The two rules Phase 1 enforces in the database rather than in a service, tested
 * against the real schema. A service can be bypassed by the next feature; a constraint
 * cannot.
 */
const DOMAIN = 'constraints.myshopify.com';
let shopId: string;

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE webhook_event, audit_event, shop CASCADE');
  const shop = await prisma.shop.create({ data: { domain: DOMAIN } });
  shopId = shop.id;
});

afterAll(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE webhook_event, audit_event, shop CASCADE');
  await prisma.$disconnect();
});

describe('webhook replay', () => {
  const event = {
    shopDomain: DOMAIN,
    topic: 'products/update',
    shopifyEventId: 'evt-1',
    payload: { id: 1 },
  };

  it('accepts the first delivery', async () => {
    const row = await prisma.webhookEvent.create({ data: event });
    expect(row.status).toBe('RECEIVED');
  });

  it('refuses a second delivery of the same event', async () => {
    await prisma.webhookEvent.create({ data: event });
    await expect(prisma.webhookEvent.create({ data: event })).rejects.toThrow(/Unique constraint/i);
  });

  it('allows the same event id on a different topic', async () => {
    await prisma.webhookEvent.create({ data: event });
    const other = await prisma.webhookEvent.create({
      data: { ...event, topic: 'products/delete' },
    });
    expect(other.id).not.toBe('');
  });

  it('allows the same event id from a different shop', async () => {
    await prisma.webhookEvent.create({ data: event });
    const other = await prisma.webhookEvent.create({
      data: { ...event, shopDomain: 'elsewhere.myshopify.com' },
    });
    expect(other.shopDomain).toBe('elsewhere.myshopify.com');
  });
});

describe('the audit trail is append-only', () => {
  it('accepts an insert', async () => {
    await recordAudit(prisma, {
      shopId,
      action: 'product.synced',
      targetType: 'SyncRun',
      targetId: 'run-1',
      after: { productsSeen: 5 },
    });
    expect(await prisma.auditEvent.count({ where: { shopId } })).toBe(1);
  });

  it('refuses an update', async () => {
    await recordAudit(prisma, { shopId, action: 'app.installed', targetType: 'Shop' });
    const row = await prisma.auditEvent.findFirstOrThrow({ where: { shopId } });

    await expect(
      prisma.auditEvent.update({ where: { id: row.id }, data: { action: 'app.uninstalled' } }),
    ).rejects.toThrow(/append-only/i);

    const unchanged = await prisma.auditEvent.findFirstOrThrow({ where: { id: row.id } });
    expect(unchanged.action).toBe('app.installed');
  });

  it('refuses a delete', async () => {
    await recordAudit(prisma, { shopId, action: 'app.installed', targetType: 'Shop' });
    const row = await prisma.auditEvent.findFirstOrThrow({ where: { shopId } });

    await expect(prisma.auditEvent.delete({ where: { id: row.id } })).rejects.toThrow(
      /append-only/i,
    );
    expect(await prisma.auditEvent.count({ where: { shopId } })).toBe(1);
  });

  it('refuses a bulk delete, which is the tempting way round it', async () => {
    await recordAudit(prisma, { shopId, action: 'app.installed', targetType: 'Shop' });
    await expect(prisma.auditEvent.deleteMany({ where: { shopId } })).rejects.toThrow(
      /append-only/i,
    );
    expect(await prisma.auditEvent.count({ where: { shopId } })).toBe(1);
  });

  it('therefore refuses to hard-delete a shop that has audit history', async () => {
    // Stated as a test because it is a consequence, not an accident: shops are closed
    // by setting uninstalledAt, which is what the uninstall webhook does.
    await recordAudit(prisma, { shopId, action: 'app.installed', targetType: 'Shop' });
    await expect(prisma.shop.delete({ where: { id: shopId } })).rejects.toThrow(/append-only/i);
  });

  it('records the actor and the payload it was given', async () => {
    const user = await prisma.user.create({
      data: { shopId, email: 'manager@example.invalid', name: 'Manager' },
    });
    await recordAudit(prisma, {
      shopId,
      action: 'user.role_granted',
      targetType: 'User',
      targetId: user.id,
      actorUserId: user.id,
      actorRole: 'administrator',
      before: { roles: [] },
      after: { roles: ['campaign_manager'] },
      ip: '203.0.113.1',
      requestId: 'req-1',
    });

    const row = await prisma.auditEvent.findFirstOrThrow({
      where: { action: 'user.role_granted' },
    });
    expect(row.actorUserId).toBe(user.id);
    expect(row.actorRole).toBe('administrator');
    expect(row.after).toEqual({ roles: ['campaign_manager'] });
    expect(row.ip).toBe('203.0.113.1');
  });
});
