import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const pkg = (name: string) =>
  fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@spirithaus/db': pkg('db'),
      '@spirithaus/domain': pkg('domain'),
      '@spirithaus/providers': pkg('providers'),
      '@spirithaus/jobs': pkg('jobs'),
      '@spirithaus/observability': pkg('observability'),
      '@spirithaus/shopify': pkg('shopify'),
      '@spirithaus/testing': pkg('testing'),
    },
  },
  test: {
    // Logs are asserted on in their own tests; elsewhere they are noise.
    env: { LOG_LEVEL: 'silent' },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts'],
          // `*.test.ts` also matches `*.integration.test.ts`, and the unit project must
          // stay runnable without Postgres or Redis.
          exclude: ['**/*.integration.test.ts', '**/node_modules/**'],
          environment: 'node',
        },
      },
      {
        // Integration tests need Postgres and Redis. They are a separate project so
        // `pnpm test` stays runnable with neither.
        extends: true,
        test: {
          name: 'integration',
          include: [
            'packages/*/src/**/*.integration.test.ts',
            'apps/*/src/**/*.integration.test.ts',
          ],
          environment: 'node',
          hookTimeout: 30_000,
          testTimeout: 30_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
