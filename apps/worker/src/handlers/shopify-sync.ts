import { prisma, recordAudit } from '@spirithaus/db';
import { childLogger } from '@spirithaus/observability';
import {
  ADMIN_API_VERSION,
  AdminClient,
  ShopifyGateway,
  syncCollections,
  syncProducts,
} from '@spirithaus/shopify';
import { PrismaProductStore } from '@spirithaus/shopify/server';
import type { ShopifySyncPayload } from '@spirithaus/jobs';
import { offlineAccessToken } from '../sessions.js';

export async function handleShopifySync(payload: ShopifySyncPayload): Promise<void> {
  const log = childLogger({ job: 'shopify-sync', shop: payload.shopDomain, kind: payload.kind });

  // The gateway resolves a session without throwing, and says why when it cannot. Both reasons
  // it cannot — OAuth never completed, or the Admin host refused by the container's egress
  // policy — are conditions no retry will change, so neither kills the worker.
  const gateway = new ShopifyGateway({
    shopDomain: payload.shopDomain,
    lookupOfflineToken: offlineAccessToken,
    apiVersion: ADMIN_API_VERSION,
  });
  const session = await gateway.resolveSession();

  if (session.isMock || !session.accessToken) {
    await unreachable(payload, session.reason ?? 'No offline session for this shop.', log);
    return;
  }

  const client = new AdminClient({
    shopDomain: payload.shopDomain,
    accessToken: session.accessToken,
    apiVersion: ADMIN_API_VERSION,
  });
  const store = new PrismaProductStore(payload.shopId);

  const products =
    payload.kind === 'COLLECTIONS'
      ? null
      : await syncProducts({
          client,
          store,
          onProgress: (counts) => {
            void prisma.syncRun
              .update({ where: { id: payload.syncRunId }, data: { counts } })
              .catch((error: unknown) => log.warn({ error }, 'could not record sync progress'));
          },
        });

  if (products && !products.ok) {
    if (products.error.class === 'network_blocked') {
      await unreachable(payload, products.error.message, log);
      return;
    }
    await fail(payload, `${products.error.class}: ${products.error.message}`);
    return;
  }

  // Collections are synchronised after products, because a collection's membership is
  // resolved against product rows that must already exist.
  const collections =
    payload.kind === 'PRODUCTS' || payload.kind === 'INVENTORY'
      ? null
      : await syncCollections({ client, store });

  if (collections && !collections.ok) {
    if (collections.error.class === 'network_blocked') {
      await unreachable(payload, collections.error.message, log);
      return;
    }
    await fail(payload, `${collections.error.class}: ${collections.error.message}`);
    return;
  }

  const counts = {
    ...(products?.ok ? products.value : {}),
    ...(collections?.ok ? collections.value : {}),
  };

  await prisma.syncRun.update({
    where: { id: payload.syncRunId },
    data: { status: 'SUCCEEDED', finishedAt: new Date(), counts },
  });

  await recordAudit(prisma, {
    shopId: payload.shopId,
    action: 'product.synced',
    targetType: 'SyncRun',
    targetId: payload.syncRunId,
    after: { kind: payload.kind, trigger: payload.trigger, counts },
  });

  log.info({ counts }, 'sync complete');
}

/**
 * The sync never reached Shopify.
 *
 * Recorded and *not* thrown: throwing would have BullMQ retry, with backoff, work that cannot
 * succeed until somebody completes OAuth or changes the egress policy — and a worker that dies
 * on a condition it will meet on every job is a worker that never runs anything else. The run
 * row carries the diagnostic, so the reason is visible in the app rather than only in a log.
 */
async function unreachable(
  payload: ShopifySyncPayload,
  reason: string,
  log: ReturnType<typeof childLogger>,
): Promise<void> {
  log.warn({ shop: payload.shopDomain }, `[SANDBOX] Sync not attempted: ${reason}`);
  await prisma.syncRun.update({
    where: { id: payload.syncRunId },
    data: { status: 'UNREACHABLE', finishedAt: new Date(), error: reason },
  });
  await recordAudit(prisma, {
    shopId: payload.shopId,
    action: 'product.sync_unreachable',
    targetType: 'SyncRun',
    targetId: payload.syncRunId,
    after: { reason, kind: payload.kind, trigger: payload.trigger },
  });
}

async function fail(payload: ShopifySyncPayload, error: string): Promise<void> {
  await prisma.syncRun.update({
    where: { id: payload.syncRunId },
    data: { status: 'FAILED', finishedAt: new Date(), error },
  });
  await recordAudit(prisma, {
    shopId: payload.shopId,
    action: 'product.sync_failed',
    targetType: 'SyncRun',
    targetId: payload.syncRunId,
    after: { error, kind: payload.kind },
  });
  // Thrown so BullMQ records the attempt and applies its backoff. The SyncRun row
  // already says what went wrong, so the failure is visible in the app either way.
  throw new Error(error);
}
