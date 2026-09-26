import IORedis from 'ioredis';
import { logger } from '@spirithaus/observability';

/**
 * One Redis connection for this process, shared with the readiness probe.
 *
 * Separate from the BullMQ queue's own connection only in that it is reused rather than created
 * per call: a probe that opens a connection each time exhausts the server's limit at exactly the
 * moment it is already under strain.
 *
 * `lazyConnect` so importing this never blocks startup, with the connection opened on first use.
 * The offline queue stays on: with it off, the very first command fails because the connection
 * has not finished opening yet, and the readiness probe reported "not ready" on a perfectly
 * healthy Redis — observed, not theorised. The probe's own timeout is what bounds a command
 * during a real outage, which is the right place for that limit.
 */
let instance: IORedis | null = null;

export function redis(): IORedis {
  if (instance) return instance;

  const url = process.env.REDIS_URL;
  if (!url) {
    // Surfaced as a failing readiness check rather than a crash: the app runs without Redis on a
    // developer machine, and says so elsewhere.
    throw new Error('REDIS_URL is not set');
  }

  const client = new IORedis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
  client.on('error', (error: Error) => {
    logger.warn({ err: error.message }, 'redis connection error');
  });
  // Opened now rather than on the first command, so a probe measures Redis rather than the
  // connection handshake. A failure here surfaces through the error handler above.
  void client.connect().catch(() => {});
  instance = client;
  return instance;
}
