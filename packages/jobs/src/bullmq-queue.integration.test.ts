import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import IORedis from 'ioredis';
import { BullMqQueue } from './bullmq-queue.js';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
const PREFIX = `spirithaus-test-${process.pid}`;
const QUEUE = 'integration-queue';

let queue: BullMqQueue;

beforeAll(async () => {
  const probe = new IORedis(REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true });
  await probe.connect();
  await probe.quit();
  queue = new BullMqQueue({ redisUrl: REDIS_URL, prefix: PREFIX });
});

afterAll(async () => {
  await queue?.close();
  const cleanup = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
  const keys = await cleanup.keys(`${PREFIX}*`);
  if (keys.length > 0) await cleanup.del(...keys);
  await cleanup.quit();
});

describe('BullMqQueue against a real Redis', () => {
  it('enqueues and reads back the payload', async () => {
    const outcome = await queue.enqueue(QUEUE, { shopId: 's1' }, { jobId: 'job-basic' });
    expect(outcome.created).toBe(true);

    const job = await queue.get<{ shopId: string }>(QUEUE, 'job-basic');
    expect(job?.payload).toEqual({ shopId: 's1' });
    expect(job?.state).toBe('waiting');
  });

  it('refuses a duplicate job id, which is the idempotency guarantee', async () => {
    await queue.enqueue(QUEUE, { n: 1 }, { jobId: 'job-dup' });
    const second = await queue.enqueue(QUEUE, { n: 2 }, { jobId: 'job-dup' });
    expect(second.created).toBe(false);
    if (second.created) return;
    expect(second.reason).toBe('duplicate');
    expect(second.job.payload).toEqual({ n: 1 });
  });

  it('holds a future job as delayed, without an open browser', async () => {
    const runAt = new Date(Date.now() + 3_600_000);
    const outcome = await queue.enqueue(QUEUE, {}, { jobId: 'job-delayed', runAt });
    expect(outcome.job.state).toBe('delayed');
    expect(outcome.job.runAt.getTime()).toBeGreaterThan(Date.now() + 3_000_000);
  });

  it('cancels an undispatched job and forgets it', async () => {
    await queue.enqueue(QUEUE, {}, { jobId: 'job-cancel' });
    expect(await queue.cancel(QUEUE, 'job-cancel')).toBe(true);
    expect(await queue.get(QUEUE, 'job-cancel')).toBeNull();
  });

  it('reports progress', async () => {
    await queue.enqueue(QUEUE, {}, { jobId: 'job-progress' });
    await queue.setProgress(QUEUE, 'job-progress', 42);
    expect((await queue.get(QUEUE, 'job-progress'))?.progress).toBe(42);
  });

  it('returns null for an unknown job and false cancelling one', async () => {
    expect(await queue.get(QUEUE, 'absent')).toBeNull();
    expect(await queue.cancel(QUEUE, 'absent')).toBe(false);
  });
});
