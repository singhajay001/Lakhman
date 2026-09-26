# 0004 — Invariants live in the database

**Status:** accepted, 2026-09-26

## Context

Section 20 requires a recorded approval for every external publication, and section 30
requires that pausing a campaign not corrupt audit history. Section 7 requires webhook
idempotency. All of these can be implemented in a service — and a service can be
bypassed by the next feature written by someone who has not read it.

## Decision

Phase 1 puts two rules in Postgres. Later phases add the rest
(`docs/social-studio/03-data-model.md` lists eight).

**The audit trail is append-only.** A trigger on `audit_event` raises on UPDATE and
DELETE. `packages/db` exposes `recordAudit` and no update or delete function at all, so
the module's shape states the intent and the trigger enforces it.

**Webhook replay is free.** `@@unique([shopDomain, topic, shopifyEventId])`, checked
before any handler side effect.

## Consequences

- A shop with audit history cannot be hard-deleted, because the cascade would be a
  DELETE. This is deliberate and tested: shops are closed by setting `uninstalledAt`,
  which is what the uninstall webhook does.
- Test cleanup uses `TRUNCATE`, which fires a TRUNCATE trigger rather than a row DELETE
  trigger.
- `shop/redact` erases the catalogue mirror and leaves the audit trail, which records
  what this app did rather than anything about a customer.
