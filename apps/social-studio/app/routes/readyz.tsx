import { prisma } from '@spirithaus/db';
import { childLogger } from '@spirithaus/observability';
import { redis } from '../lib/redis.server.js';

/**
 * Readiness: should this process be given traffic?
 *
 * Checks the two dependencies a request actually needs — Postgres and Redis — and answers with
 * nothing but a word. The detail goes to the log.
 *
 * Three rules this follows, each for a reason worth stating:
 *
 * **Nothing about the failure is public.** A readiness endpoint that reports which dependency is
 * down, on which host, with which error, is a free map of the deployment to anyone who curls it.
 * `{"status":"not_ready"}` is all a load balancer needs.
 *
 * **Every check is bounded.** Without a timeout, a hung connection makes the probe hang, the
 * platform treats the timeout as a failure anyway, and the process is killed while holding a
 * connection it never released. The budget is per-check and overall.
 *
 * **No connection is created here.** The probe uses the same Prisma client and the same Redis
 * connection the application uses. A probe that opens its own pool exhausts the database's
 * connection limit at exactly the moment the database is already struggling.
 */
const CHECK_TIMEOUT_MS = 1_500;
const TOTAL_TIMEOUT_MS = 2_500;

/**
 * Runs a check under a time limit, and treats any failure as "not ready".
 *
 * The work is a thunk, not a promise, because building the promise can itself throw — `redis()`
 * throws synchronously when REDIS_URL is unset, and evaluating it in the argument list escaped
 * this function entirely and surfaced as a 500. A readiness probe must answer 503, not fail.
 */
async function within<T>(label: string, work: () => Promise<T>, ms: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      work(),
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} did not answer within ${ms}ms`)), ms);
      }),
    ]);
    return true;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function loader(): Promise<Response> {
  const log = childLogger({ part: 'readyz' });
  const started = Date.now();

  const [database, queue] = await Promise.all([
    within('postgres', () => prisma.$queryRaw`SELECT 1`, CHECK_TIMEOUT_MS),
    within('redis', () => redis().ping(), CHECK_TIMEOUT_MS),
  ]);

  const elapsed = Date.now() - started;
  // The overall budget catches the case where both checks sit just under their own limit.
  const ready = database && queue && elapsed <= TOTAL_TIMEOUT_MS;

  if (!ready) {
    log.warn(
      { database, queue, elapsed },
      'not ready: a required dependency did not answer in time',
    );
  }

  return new Response(JSON.stringify({ status: ready ? 'ready' : 'not_ready' }), {
    status: ready ? 200 : 503,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
