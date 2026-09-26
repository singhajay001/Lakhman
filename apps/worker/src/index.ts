import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from '@spirithaus/db';
import { logger } from '@spirithaus/observability';
import { assertStorage } from '@spirithaus/media-pipeline';
import { createShutdown } from './shutdown.js';
import {
  QUEUES,
  type CompositePayload,
  type RenderPayload,
  type ShopifySyncPayload,
} from '@spirithaus/jobs';
import { handleRender } from './handlers/render.js';
import { handleComposite } from './handlers/composite.js';
import { handleShopifySync } from './handlers/shopify-sync.js';

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  // A worker without a queue has nothing to do, and pretending otherwise would hide a
  // misconfiguration until a sync silently never ran.
  logger.error('REDIS_URL is not set. The worker cannot run.');
  process.exit(1);
}

/**
 * Object storage, before any queue is consumed.
 *
 * The worker is the half of the pair that *reads* what the web process wrote, so a missing bucket
 * here does not degrade anything — it makes every composite fail on a plate it cannot find, and
 * `handleComposite` records that as a terminal refusal naming the artwork rather than the
 * configuration. Refusing to start says the true thing instead.
 *
 * Checked after Redis so the first thing a misconfigured deployment is told about is the queue it
 * has no connection to; both are fatal, and the order only decides which message arrives first.
 */
try {
  assertStorage('worker');
} catch {
  // assertStorage has already logged the reason, without the credentials.
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

/**
 * Renders get their own worker with a concurrency of one by default.
 *
 * A render drives a headless browser through every frame; two at once on a small machine make
 * both slower and neither cancellable in reasonable time. Scale by adding workers, not
 * concurrency.
 */
const renderWorker = new Worker<RenderPayload>(
  QUEUES.render,
  async (job) => {
    await handleRender(job.data);
  },
  {
    connection,
    prefix: process.env.QUEUE_PREFIX ?? 'spirithaus',
    concurrency: Number(process.env.RENDER_CONCURRENCY ?? 1),
    // A render can take minutes; the default lock would expire mid-job and the queue would
    // hand the same work to a second worker.
    lockDuration: 10 * 60 * 1000,
  },
);

/**
 * Composites, on their own worker.
 *
 * Lighter than a render — seconds rather than minutes, and no browser — but heavy enough that it
 * had no business in a web request (ADR 0012). Two at a time by default: image work is CPU-bound
 * and sharp already uses several threads per operation.
 */
const compositeWorker = new Worker<CompositePayload>(
  QUEUES.composite,
  async (job) => {
    await handleComposite(job.data);
  },
  {
    connection,
    prefix: process.env.QUEUE_PREFIX ?? 'spirithaus',
    concurrency: Number(process.env.COMPOSITE_CONCURRENCY ?? 2),
    // OCR on a large packshot is the slow part; the default 30s lock expires under it.
    lockDuration: 5 * 60 * 1000,
  },
);

compositeWorker.on('failed', (job, error) => {
  logger.error(
    { jobId: job?.id, attempts: job?.attemptsMade, err: error.message },
    'composite job failed',
  );
});

renderWorker.on('failed', (job, error) => {
  logger.error(
    { jobId: job?.id, attempts: job?.attemptsMade, err: error.message },
    'render job failed',
  );
});

syncWorker.on('failed', (job, error) => {
  logger.error(
    { jobId: job?.id, attempts: job?.attemptsMade, err: error.message },
    'sync job failed',
  );
});

syncWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'sync job completed');
});

logger.info({ queues: [QUEUES.shopifySync, QUEUES.render, QUEUES.composite] }, 'worker started');

/**
 * Graceful shutdown. A worker killed mid-job leaves a stalled job that BullMQ will
 * re-run; closing first lets the current job finish, which is the difference between
 * at-least-once and twice.
 *
 * Every worker is registered here by name. The previous version listed two of the three and
 * omitted the composite worker, so each SIGTERM — which is every deploy — abandoned an in-flight
 * composite and had BullMQ re-run it once the five-minute lock expired.
 */
const shutdown = createShutdown({
  closables: [
    { name: 'sync-worker', close: () => syncWorker.close() },
    { name: 'render-worker', close: () => renderWorker.close() },
    { name: 'composite-worker', close: () => compositeWorker.close() },
  ],
  // After the workers have drained, never before: closing Redis first would strip the connection
  // out from under a job that is still finishing.
  after: [
    { name: 'redis', close: () => connection.quit() },
    { name: 'prisma', close: () => prisma.$disconnect() },
  ],
});

async function onSignal(signal: string): Promise<void> {
  const result = await shutdown(signal);
  if (!result.ran) return; // a repeat signal; the first shutdown owns the exit
  // Non-zero when something would not close, so the platform's logs show an unclean stop rather
  // than reporting success for a worker that leaked a connection.
  process.exit(result.failed.length === 0 ? 0 : 1);
}

process.on('SIGTERM', () => void onSignal('SIGTERM'));
process.on('SIGINT', () => void onSignal('SIGINT'));
