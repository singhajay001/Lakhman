import { BullMqQueue, MemoryQueue, type JobQueue } from '@spirithaus/jobs';
import { logger } from '@spirithaus/observability';

let instance: JobQueue | undefined;

/**
 * One queue per process.
 *
 * Without REDIS_URL it falls back to the in-memory queue and says so loudly — an in-memory queue
 * loses work on restart and no worker will pick it up, which is fine for a first look at the app
 * and not fine for anything else. That matters more now that compositing is queued rather than
 * done inline: without Redis the request returns a job id for work nothing will ever run.
 */
export function queue(): JobQueue {
  if (instance) return instance;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    logger.warn(
      'REDIS_URL is not set. Using the in-memory queue: jobs are lost on restart and no worker will pick them up.',
    );
    instance = new MemoryQueue();
    return instance;
  }

  instance = new BullMqQueue({ redisUrl });
  return instance;
}
