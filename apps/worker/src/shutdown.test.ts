import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createShutdown, type Closable } from './shutdown.js';

/**
 * The bug this file exists for: `shutdown()` closed the sync and render workers and silently
 * omitted the composite one. Every Fly deploy sends SIGTERM, so every deploy abandoned an
 * in-flight composite and let BullMQ re-run it after the five-minute lock expired — the exact
 * duplicate work the graceful close was written to prevent.
 */
const closable = (name: string, behaviour: 'ok' | 'throw' = 'ok'): Closable & { calls: number } => {
  const it_ = {
    name,
    calls: 0,
    close: async () => {
      it_.calls += 1;
      if (behaviour === 'throw') throw new Error(`${name} would not close`);
      return undefined;
    },
  };
  return it_;
};

describe('shutdown', () => {
  it('closes every registered worker', async () => {
    const workers = [closable('sync'), closable('render'), closable('composite')];
    const result = await createShutdown({ closables: workers, after: [] })('SIGTERM');

    expect(workers.map((w) => w.calls)).toEqual([1, 1, 1]);
    expect(result.closed).toEqual(['sync', 'render', 'composite']);
    expect(result.failed).toEqual([]);
  });

  it('closes shared resources after the workers, not before', async () => {
    const order: string[] = [];
    const track = (name: string): Closable => ({
      name,
      close: async () => {
        order.push(name);
      },
    });

    await createShutdown({
      closables: [track('composite')],
      after: [track('redis'), track('prisma')],
    })('SIGTERM');

    // Closing Redis before the workers drain would pull the connection out from under a job that
    // is still finishing.
    expect(order).toEqual(['composite', 'redis', 'prisma']);
  });

  it('still closes the rest when one worker fails', async () => {
    const good = closable('render');
    const bad = closable('composite', 'throw');
    const redis = closable('redis');

    const result = await createShutdown({ closables: [bad, good], after: [redis] })('SIGTERM');

    // `Promise.all` would have skipped Redis entirely and leaked the connection.
    expect(good.calls).toBe(1);
    expect(redis.calls).toBe(1);
    expect(result.failed).toEqual([{ name: 'composite', error: 'composite would not close' }]);
    expect(result.closed).toContain('render');
    expect(result.closed).toContain('redis');
  });

  it('ignores a repeat signal rather than closing twice', async () => {
    const worker = closable('composite');
    const shutdown = createShutdown({ closables: [worker], after: [] });

    const [first, second] = await Promise.all([shutdown('SIGTERM'), shutdown('SIGTERM')]);

    expect(worker.calls).toBe(1);
    // Exactly one caller owns the exit.
    expect([first.ran, second.ran].filter(Boolean)).toHaveLength(1);
  });

  it('reports failure so the caller can exit non-zero', async () => {
    const result = await createShutdown({
      closables: [closable('composite', 'throw')],
      after: [],
    })('SIGTERM');
    expect(result.failed.length).toBeGreaterThan(0);
  });
});

/**
 * A structural guard, not a behavioural one.
 *
 * The defect was a worker that existed but was never registered, which no amount of testing
 * `createShutdown` in isolation would catch. This reads the worker entrypoint and asserts that
 * every `new Worker(...)` it constructs also appears in the shutdown registration — so adding a
 * fourth queue and forgetting to drain it fails here rather than in production.
 */
describe('the worker entrypoint', () => {
  const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');

  it('registers every BullMQ worker it creates for shutdown', () => {
    const created = [...source.matchAll(/const (\w+) = new Worker</g)].map((m) => m[1]!);
    expect(created.length).toBeGreaterThanOrEqual(3);

    const registration = source.slice(source.indexOf('createShutdown('));
    const missing = created.filter((name) => !registration.includes(`${name}.close()`));

    expect(missing, `workers created but never closed on shutdown: ${missing.join(', ')}`).toEqual(
      [],
    );
  });

  it('closes Redis and Prisma after the workers', () => {
    const registration = source.slice(source.indexOf('createShutdown('));
    const after = registration.slice(registration.indexOf('after:'));
    expect(after).toContain('connection.quit()');
    expect(after).toContain('prisma.$disconnect()');
  });
});
