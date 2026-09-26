import { prisma, recordAudit } from '@spirithaus/db';
import { childLogger } from '@spirithaus/observability';
import {
  ADMIN_API_VERSION,
  AdminClient,
  PrismaProductStore,
  syncCollections,
  syncProducts,
} from '@spirithaus/shopify';
import type { ShopifySyncPayload } from '@spirithaus/jobs';
import { offlineAccessToken } from '../sessions.js';

export async function handleShopifySync(payload: ShopifySyncPayload): Promise<void> {
  const log = childLogger({ job: 'shopify-sync', shop: payload.shopDomain, kind: payload.kind });
  const accessToken = await offlineAccessToken(payload.shopDomain);

  if (!accessToken) {
    await fail(payload, 'No offline session for this shop. The app needs reinstalling.');
    return;
  }

  const client = new AdminClient({
    shopDomain: payload.shopDomain,
    accessToken,
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
