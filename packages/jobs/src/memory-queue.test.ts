import { describe, expect, it } from 'vitest';
import { MemoryQueue } from './memory-queue.js';
import { QUEUES } from './definitions.js';

const queue = QUEUES.shopifySync;

describe('MemoryQueue', () => {
  it('creates a job', async () => {
    const q = new MemoryQueue();
    const outcome = await q.enqueue(queue, { shopId: 's' }, { jobId: 'j1' });
    expect(outcome.created).toBe(true);
    expect(outcome.job.state).toBe('waiting');
  });

  it('refuses a duplicate id and returns the existing job', async () => {
    const q = new MemoryQueue();
    await q.enqueue(queue, { n: 1 }, { jobId: 'j1' });
    const second = await q.enqueue(queue, { n: 2 }, { jobId: 'j1' });
    expect(second.created).toBe(false);
    if (second.created) return;
    expect(second.reason).toBe('duplicate');
    // The payload of the first enqueue wins; the second is not silently applied.
    expect(second.job.payload).toEqual({ n: 1 });
  });

  it('refuses to re-enqueue a completed job — a retry must not republish a success', async () => {
    const q = new MemoryQueue();
    await q.enqueue(queue, {}, { jobId: 'j1' });
    q.markState(queue, 'j1', 'completed');
    const again = await q.enqueue(queue, {}, { jobId: 'j1' });
    expect(again.created).toBe(false);
    if (again.created) return;
    expect(again.reason).toBe('already_completed');
  });

  it('allows the same id on a different queue', async () => {
    const q = new MemoryQueue();
    await q.enqueue(QUEUES.shopifySync, {}, { jobId: 'j1' });
    const other = await q.enqueue(QUEUES.webhook, {}, { jobId: 'j1' });
    expect(other.created).toBe(true);
  });

  it('marks a future job delayed', async () => {
    const q = new MemoryQueue();
    const outcome = await q.enqueue(
      queue,
      {},
      { jobId: 'j1', runAt: new Date(Date.now() + 60_000) },
    );
    expect(outcome.job.state).toBe('delayed');
  });

  it('cancels a job that has not been dispatched', async () => {
    const q = new MemoryQueue();
    await q.enqueue(queue, {}, { jobId: 'j1' });
    expect(await q.cancel(queue, 'j1')).toBe(true);
    expect((await q.get(queue, 'j1'))?.state).toBe('cancelled');
  });

  it('will not cancel an active or completed job', async () => {
    const q = new MemoryQueue();
    await q.enqueue(queue, {}, { jobId: 'active' });
    q.markState(queue, 'active', 'active');
    expect(await q.cancel(queue, 'active')).toBe(false);

    await q.enqueue(queue, {}, { jobId: 'done' });
    q.markState(queue, 'done', 'completed');
    expect(await q.cancel(queue, 'done')).toBe(false);
  });

  it('returns false cancelling something that does not exist', async () => {
    expect(await new MemoryQueue().cancel(queue, 'nope')).toBe(false);
  });

  it('clamps progress to 0..100', async () => {
    const q = new MemoryQueue();
    await q.enqueue(queue, {}, { jobId: 'j1' });
    await q.setProgress(queue, 'j1', 150);
    expect((await q.get(queue, 'j1'))?.progress).toBe(100);
    await q.setProgress(queue, 'j1', -5);
    expect((await q.get(queue, 'j1'))?.progress).toBe(0);
  });

  it('returns null for an unknown job', async () => {
    expect(await new MemoryQueue().get(queue, 'nope')).toBeNull();
  });
});
