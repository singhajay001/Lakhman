import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from '@spirithaus/db';
import { logger } from '@spirithaus/observability';
import { QUEUES, type ShopifySyncPayload } from '@spirithaus/jobs';
import { handleShopifySync } from './handlers/shopify-sync.js';

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  // A worker without a queue has nothing to do, and pretending otherwise would hide a
  // misconfiguration until a sync silently never ran.
  logger.error('REDIS_URL is not set. The worker cannot run.');
  process.exit(1);
}

const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

const syncWorker = new Worker<ShopifySyncPayload>(
  QUEUES.shopifySync,
  async (job) => {
    await handleShopifySync(job.data);
  },
  {
    connection,
    prefix: process.env.QUEUE_PREFIX ?? 'spirithaus',
    concurrency: Number(process.env.SYNC_CONCURRENCY ?? 2),
  },
);

syncWorker.on('failed', (job, error) => {
  logger.error(
    { jobId: job?.id, attempts: job?.attemptsMade, err: error.message },
    'sync job failed',
  );
});

syncWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'sync job completed');
});

logger.info({ queues: [QUEUES.shopifySync] }, 'worker started');

/**
 * Graceful shutdown. A worker killed mid-job leaves a stalled job that BullMQ will
 * re-run; closing first lets the current job finish, which is the difference between
 * at-least-once and twice.
 */
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'worker shutting down');
  await syncWorker.close();
  await connection.quit();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
