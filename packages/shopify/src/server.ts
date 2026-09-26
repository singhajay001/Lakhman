/**
 * The parts of this package that touch the database.
 *
 * Split out for the same reason `@spirithaus/domain/server` was (ADR 0008): a barrel is one
 * module, so anything importing `@spirithaus/shopify` for a pure function was also importing
 * Prisma — which reads `DATABASE_URL` at module load and throws without it. That made a unit
 * test of HMAC verification depend on a database being configured, which is backwards.
 *
 * Pure things stay in the barrel. Anything needing a connection lives here.
 */
export { PrismaProductStore } from './prisma-store.js';
