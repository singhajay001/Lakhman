import { logger } from '@spirithaus/observability';

/**
 * Closing everything the worker owns, once, on the way down.
 *
 * This exists because the hand-written version did not close all of it. `shutdown()` listed two of
 * the three BullMQ workers and omitted the composite one, so on every SIGTERM — which is every Fly
 * deploy — an in-flight composite was abandoned rather than drained. BullMQ then re-ran it once the
 * five-minute lock expired, which is precisely the "at-least-once becomes twice" the original
 * comment said the graceful close existed to prevent.
 *
 * A list is the fix rather than three more `await`s: adding a fourth worker later cannot forget to
 * shut it down, because it is registered in the same place it is created.
 */
export interface Closable {
  readonly name: string;
  close(): Promise<unknown>;
}

export interface ShutdownResult {
  closed: string[];
  failed: { name: string; error: string }[];
  /** False when a second signal arrived while the first shutdown was still running. */
  ran: boolean;
}

/**
 * Closes every closable, then the shared resources, tolerating individual failures.
 *
 * `allSettled` rather than `all`: with `all`, one worker failing to close skipped the Redis
 * connection and the Prisma disconnect entirely, leaking both. A close that fails is logged and
 * the rest still happen — a stuck worker should not keep a connection open.
 */
export function createShutdown(input: {
  closables: readonly Closable[];
  /** Shared resources closed after the workers have drained, in this order. */
  after: readonly Closable[];
}): (signal: string) => Promise<ShutdownResult> {
  // Signals arrive more than once in practice: a platform sends SIGTERM and then SIGKILL-adjacent
  // follow-ups, and a second entry here would close an already-closing worker.
  let running: Promise<ShutdownResult> | undefined;

  return function shutdown(signal: string): Promise<ShutdownResult> {
    if (running) {
      logger.info({ signal }, 'shutdown already in progress; ignoring repeat signal');
      return running.then((result) => ({ ...result, ran: false }));
    }

    running = (async () => {
      logger.info({ signal, closing: input.closables.map((c) => c.name) }, 'worker shutting down');
      const result: ShutdownResult = { closed: [], failed: [], ran: true };

      for (const group of [input.closables, input.after]) {
        const outcomes = await Promise.allSettled(
          group.map(async (c) => {
            await c.close();
            return c.name;
          }),
        );
        outcomes.forEach((outcome, index) => {
          const name = group[index]?.name ?? 'unknown';
          if (outcome.status === 'fulfilled') {
            result.closed.push(name);
          } else {
            const error =
              outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
            result.failed.push({ name, error });
            logger.error({ name, err: error }, 'failed to close cleanly during shutdown');
          }
        });
      }

      logger.info({ closed: result.closed, failed: result.failed.length }, 'worker shutdown done');
      return result;
    })();

    return running;
  };
}
