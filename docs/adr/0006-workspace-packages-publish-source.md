# 0006 — Workspace packages publish source

**Status:** accepted, 2026-09-26

## Context

Seven internal packages, two applications. The usual monorepo arrangement compiles each
package to `dist` and has consumers import the output, which means seven build configs,
seven watch processes in development, and a stale `dist` as a recurring class of
confusion.

## Decision

Each package's `exports` points at `src/index.ts`. Vite transpiles them for the app
(`ssr.noExternal: [/^@spirithaus\//]`), `tsx` runs the worker, and Vitest reads TypeScript
directly. Typechecking is one pass over everything from the repository root, so a change
in `packages/domain` shows its consequences in `apps/social-studio` immediately rather
than after a rebuild.

One exception, which was found the hard way: **the generated Prisma client uses its
default output** (`node_modules/.prisma/client`) rather than a path inside
`packages/db/src`. Generated into the package source, Rollup bundles it and cannot read
named exports out of its CommonJS entry — the app build failed with `"PrismaClient" is not
exported by`. Left where Prisma puts it, it stays external and resolves at runtime.

## Consequences

- No build step for packages, and no stale `dist`.
- `pnpm typecheck` is the single source of truth for types, which is why CI runs it before
  anything else.
- Prisma 6 warns that a custom output path will be required in Prisma 7. That upgrade is
  already gated on `@shopify/shopify-app-session-storage-prisma`'s peer range (ADR 0001),
  and when it moves, the bundler question returns with it.
