import { PrismaClient } from '@prisma/client';

export * from '@prisma/client';

declare global {
  var __spirithausPrisma: PrismaClient | undefined;
}

function create(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set. See .env.example.');
  return new PrismaClient({
    datasources: { db: { url } },
    log: process.env.PRISMA_LOG === 'query' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });
}

/**
 * One client per process. The dev server reloads modules, so it is cached on the
 * global to avoid exhausting the connection pool with every save.
 */
export const prisma: PrismaClient = globalThis.__spirithausPrisma ?? create();

if (process.env.NODE_ENV !== 'production') globalThis.__spirithausPrisma = prisma;
