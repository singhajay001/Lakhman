# 0008 — Shared packages stay browser-safe

**Status:** accepted, 2026-09-26

## Context

`@spirithaus/domain` is imported by route modules, which both run a loader on the server
and render in the browser. In Phase 2 it gained content hashing, which needs
`node:crypto`.

The build then failed:

```
"createHash" is not exported by "__vite-browser-external",
  imported by "../../packages/domain/src/content/canonical.ts"
```

A barrel is one module. The moment anything from `@spirithaus/domain` is used in a
component rather than only in a loader, Rollup follows the barrel into the client graph,
and every import it makes comes with it — including a Node built-in that has no browser
equivalent. In this case the component using it was the platform checkbox list on the
Create screen.

The tempting fixes are both wrong: aliasing `node:crypto` to a shim would ship a hashing
implementation to the browser that must never disagree with the server's, and marking the
package external would move the failure to runtime.

## Decision

**A package imported by UI code contains no Node built-ins.** Crypto-dependent code moved
to a `./server` subpath:

```ts
import { formatInZone } from '@spirithaus/domain';          // browser-safe
import { variantHash } from '@spirithaus/domain/server';    // server only
```

Two supporting rules, both applied in this phase:

- **Route modules do not import shared constants for rendering.** The Create screen's
  platform list comes through its loader, so the component has no package import to drag
  anything in. A list that renders is data, not a module dependency.
- **Hashing lives in the service layer.** The campaign detail route no longer computes a
  content hash; it calls `editVariantCopy` in `campaign.server.ts`. One place decides what
  a variant hashes to, and `.server.ts` is a boundary React Router already enforces.

## Consequences

- `pnpm --filter @spirithaus/social-studio build` is part of the verification set, not an
  afterthought: this class of mistake is invisible to `tsc` and to the tests, and only the
  bundler finds it.
- `@spirithaus/content` and `@spirithaus/compliance` also use `node:crypto` and are
  server-only by nature. They are currently kept out of the client graph by tree-shaking
  alone, which is weaker than a subpath boundary. If either is ever needed in a component,
  it gets the same split rather than a shim.
- The client bundle was checked after the fix: its only `createHash` is React Router's own
  `createHashRouter` in an error message.
