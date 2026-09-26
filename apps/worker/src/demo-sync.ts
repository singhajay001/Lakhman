/**
 * Fills the product mirror from the fixture catalogue, without Shopify.
 *
 * A development script, not a runtime path: it refuses to run in production, and the
 * mock is imported here rather than reachable from the worker, so no environment
 * variable can make the real sync serve fixture data. It exists because MVP criterion 2
 * is "synchronise real or mocked products", and this environment cannot reach Shopify.
 *
 *   pnpm --filter @spirithaus/worker demo:sync
 */
import { prisma, recordAudit } from '@spirithaus/db';
import {
  AdminClient,
  PrismaProductStore,
  syncCollections,
  syncProducts,
} from '@spirithaus/shopify';
import { MockShopify } from '@spirithaus/testing';

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('demo:sync writes fixture data and will not run in production.');
  }

  const domain = process.env.SEED_SHOP_DOMAIN ?? 'spirithaus-dev.myshopify.com';
  const shop = await prisma.shop.findUnique({ where: { domain } });
  if (!shop) throw new Error(`No shop ${domain}. Run pnpm db:seed first.`);

  const shopify = new MockShopify();
  const client = new AdminClient({
    shopDomain: domain,
    accessToken: 'mock-token',
    apiVersion: '2025-07',
    fetchImpl: shopify.fetch,
  });
  const store = new PrismaProductStore(shop.id);

  const run = await prisma.syncRun.create({
    data: { shopId: shop.id, kind: 'FULL', trigger: 'manual', status: 'RUNNING' },
  });

  const products = await syncProducts({ client, store, pageSize: 2 });
  if (!products.ok) throw new Error(`${products.error.class}: ${products.error.message}`);

  const collections = await syncCollections({ client, store });
  if (!collections.ok) throw new Error(`${collections.error.class}: ${collections.error.message}`);

  const counts = { ...products.value, ...collections.value };
  await prisma.syncRun.update({
    where: { id: run.id },
    data: { status: 'SUCCEEDED', finishedAt: new Date(), counts },
  });
  await recordAudit(prisma, {
    shopId: shop.id,
    action: 'product.synced',
    targetType: 'SyncRun',
    targetId: run.id,
    after: { source: 'fixture catalogue (demo:sync)', counts },
  });

  console.log('demo sync complete', counts);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
