# 0003 — Providers are adapters, and mocks are a production shape

**Status:** accepted, 2026-09-26

## Context

Section 3 requires external vendors to be interchangeable adapters rather than permanent
architectural dependencies. Section 21 forbids simulating publication success. Section 43
lists fake integrations and silent failures as prohibited shortcuts. Section 6 names
sixteen provider contracts.

A development mock is usually a lie with good intentions: it returns what the real thing
would have returned, so the code above it cannot tell the difference — and neither can
the person looking at the screen.

## Decision

All sixteen contracts are TypeScript interfaces in `packages/providers/contracts`, and
every adapter, mock included, implements the same envelope:

```ts
capabilities(); // detected, and each capability carries verified: boolean
validateConfig(); // a missing key is a startup error, not a 500 later
health();
estimateCost(request, rateCard);
```

Calls return `Result<ProviderSuccess<T>, ProviderError>`. `ProviderSuccess` carries
`mock: boolean`, and nothing suppresses it.

**Mocks do not imitate success.** `MockSocialPublishingProvider.publish` returns
`{ published: false, state: 'not_published' }` with no external id and no public URL, on
every platform, and a unit test asserts exactly that for all six. A mock that returned a
plausible post URL would be the failure section 43 names.

**Every capability from a mock is `verified: false`**, because a mock has verified
nothing.

**A named adapter that this build does not implement is refused**, with a message saying
nothing was contacted — it does not silently fall back to a mock.

**Contracts with no provider are `UnconfiguredProvider`, not `undefined`**: trend
intelligence, avatar video, generative video and email each report unavailable with a
sentence explaining why. Absence is an object with an explanation.

## Consequences

- Phases 1 to 3 are fully buildable and testable without a single external credential.
- The `Settings` screen shows sixteen honest "mock, not configured" rows rather than an
  empty table.
- Retries, timeouts, error classification and usage recording live in one wrapper
  (`invokeProvider`), not in each adapter. Sixteen contracts is sixteen chances to forget.
- Every provider payload passes through `redactForProvider`, which strips known personal
  and credential fields and **fails closed** on a shape it cannot inspect — a class
  instance or a function is refused rather than forwarded.
