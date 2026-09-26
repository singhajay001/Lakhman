# 0007 — Online tokens, and who gets the first role

**Status:** accepted, 2026-09-26

## Context

Section 20 requires that a verified human approve every external publication, with
distinct people holding the two keys where dual control applies. An offline Shopify
session has no user attached, so an app built only on offline tokens cannot say who did
anything.

Background jobs have the opposite problem: online tokens expire within a day, so a worker
cannot run on one.

## Decision

**Both.** `useOnlineTokens: true` makes the request path carry the staff member who is
looking at the screen; OAuth stores an offline session alongside, and the worker runs as
that. A job therefore acts as the app rather than as a person, which is the reason
anything needing human authority stays in the request path and never moves into a queue.

**A user seen for the first time gets no roles.** The exception is the Shopify account
owner at first sign-in, who gets Administrator, because otherwise nobody could grant the
first role. Everyone else sees a banner saying an administrator must assign one, and the
navigation shows only the sections their permissions open.

**The Administrator role cannot approve.** It holds integrations, security, users,
settings and emergency controls, and deliberately not `campaign:approve`, `budget:approve`
or `campaign:publish`: an account that can grant itself a role must not also be an
approval key. A test asserts that only Compliance Reviewer holds `compliance:review` and
only Finance Approver holds `budget:approve`.

## Consequences

- One person may hold several roles — a six-person business is not six people per
  campaign — but the two _keys_ of a dual-control action must be two distinct accounts,
  which Phase 2 enforces with a unique constraint.
- Least privilege by default is occasionally inconvenient. That is the intended trade, and
  section 20 asks for it.
- The role catalogue lives in `packages/domain` and is authoritative: the seed replaces
  each role's permission set rather than merging it, so a permission removed in code is
  removed from the database.
