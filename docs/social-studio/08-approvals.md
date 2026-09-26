# 8 — Approval and dual control

§20. Nothing reaches the public or spends money without a recorded human decision, and the
record has to be strong enough to answer "who approved exactly what" months later.

## Roles

Six roles, as §20 specifies, expressed as permission sets rather than hardcoded checks.

| Role | May | May not |
| --- | --- | --- |
| Administrator | integrations, security, users, global settings, provider enablement, emergency controls | approve a campaign as one of the two dual-control keys unless separately assigned Campaign Manager — an administrator who can grant themselves a role should not also be a key |
| Campaign Manager | own, approve, schedule and publish campaigns | manage credentials |
| Creator | research, drafts, media generation | publish, approve, schedule |
| Compliance Reviewer | decide facts, brand and alcohol compliance | manage credentials, publish |
| Analyst | read analytics and export | change anything |
| Finance Approver | approve budget commitments above threshold | create or edit content |

One person may hold several roles — a six-person business is not six people per campaign —
but the **keys** for a dual-control action must be two distinct user accounts, enforced by a
unique constraint rather than a service check ([03](03-data-model.md)). Where one person holds
both required roles, the action is blocked with an explanation instead of silently approved.
That is the honest behaviour, and it is also the one that will occasionally be inconvenient;
§20 asks for it explicitly.

## What one key buys, and what needs two

| Action | Keys |
| --- | --- |
| Ordinary organic publication | 1 — Campaign Manager |
| High-risk content, per the compliance engine | 1 Campaign Manager + 1 Compliance Reviewer |
| Paid budget activation above the threshold | 2 — Campaign Manager + Finance Approver |
| Budget scaling above the threshold | 2 |
| Competitions and giveaways | 2, including Compliance Reviewer — terms, permits and platform rules all apply |
| Any compliance exception | 2, and the exception is recorded with its justification |
| Enabling a provider, or raising a budget ceiling | 1 Administrator, recorded as an `AuditEvent` |

The threshold is a configured AUD amount with no default — blocking question 6. Until an
administrator sets it, paid features stay disabled rather than defaulting to a number I chose.

## The approval record

Per §20, one `Approval` row carrying:

approver(s) and role(s) · timestamp · **exact content hash** · content version · destination
set · audience segment id and version · scheduled window · budget · compliance result id ·
product snapshot (title, price, compare-at, availability, URL, at the moment of approval) ·
Brand Kit version · prompt and model versions for every generated component.

The content hash is sha256 over the canonicalised variant: every copy field, the digest of
every media asset, the destination set, the schedule window, the budget, the product snapshot,
the Brand Kit version, the segment version. Canonicalisation is a tested function — key order
and whitespace must not change the hash, and a changed caption must.

**Invalidation is a database trigger, not a code path.** Any write to a `ContentVariant`
recomputes the hash in the same transaction and flips `approvalState` to `INVALIDATED` on a
mismatch. §20's "any material edit invalidates approval" then holds for edits made by a
feature nobody has written yet.

What counts as material: any copy field, any media asset, destinations, audience, schedule
outside the approved window, budget, landing URL, offer terms. What does not: internal notes,
assignee, tags, comments. The list is a tested constant, not a judgement call at runtime.

## Preflight, at the moment of dispatch

§7 and §22 both require revalidation immediately before publication, because an approval
given yesterday describes a store that may have changed. Refusals, not warnings:

product still active · inventory still safe · price and compare-at unchanged since the
snapshot · destination URL resolves · promotion terms still valid · campaign not expired ·
media present and of valid dimensions for each destination · required disclosures present ·
platform rules still satisfied for the current capability version · token healthy and
unexpired · approval still valid and its hash still matches.

A price that changed after approval is the interesting case: the post may advertise a price
the store no longer charges, which is an Australian Consumer Law problem rather than an
inconvenience. It blocks and returns to the approver with a diff.

## Emergency stop

Two levels, per §30: global and per-campaign. A stop halts undispatched jobs, prevents new
publication, and **corrupts no history** — already-dispatched jobs are recorded with their
true outcome, and a stop is itself an `AuditEvent` with actor, time and reason.

Per §31, a stop does not delete published posts. Deletion is a separate, explicit, authorised
action available only where the platform supports it.

## Audit

Every state transition, approval, key, provider enablement, budget change, emergency stop,
token refresh, mask edit, Brand Kit publication and publication attempt writes an
`AuditEvent` with actor, role, action, target, before/after, IP and request id. Append-only:
no update, no delete, revoked permissions included. The audit log is a read-only surface in
the app (§8) with filters and export, because an audit trail nobody can read is a compliance
artefact rather than a control.
