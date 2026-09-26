# 0005 — Webhook verification is ours, and happens before the parse

**Status:** accepted, 2026-09-26

## Context

`@shopify/shopify-app-react-router` offers `authenticate.webhook(request)`, which
verifies the HMAC and returns a parsed payload. Using it would be the conventional
choice.

Two things argued against it here. Section 33 makes the order of operations a
requirement, not a detail; and this environment cannot reach Shopify's documentation to
confirm what the library does about a topic with no stored session — which is exactly the
case for the three mandatory privacy webhooks.

## Decision

`receiveWebhook` in the app does it in this order, and the order is the point:

1. **Headers validated.** A malformed request is rejected before anything is read. A
   topic the app never subscribed to gets 202, not 401 — Shopify retries a 4xx, and
   retrying a topic that will never be handled is noise.
2. **Raw body read, HMAC verified against those bytes.** `JSON.parse` then re-stringify
   does not round-trip: Shopify sends `"19.99"` and `1.0`, and a signature checked
   against a re-serialised body can be forged around. A unit test asserts that a
   re-serialised body fails while the raw one passes.
3. **Recorded** under `(shopDomain, topic, eventId)`, so a redelivery is a duplicate
   rather than a second processing.
4. **Only then parsed** and handed to a handler.

Comparison is constant-time. A missing `SHOPIFY_API_SECRET` refuses every webhook rather
than accepting them unverified.

## Consequences

- The verification logic is unit-tested in `packages/shopify/src/hmac.test.ts` against
  wrong secrets, tampered bodies, wrong-length signatures and the re-serialisation case.
- Verified end to end against the running app: a wrong signature returns 401, a valid one
  200, a replay of the same event id 200 with no second row, and an unsubscribed topic 202.
- If a later phase wants the library's helper instead, the trade to weigh is this ordering
  guarantee, which would become someone else's to keep.
