# 0002 — BullMQ, behind a port

**Status:** accepted, 2026-09-26

## Context

Section 36 requires that scheduled publication not depend on an open browser, and
section 22 that a retry never republish a job that already succeeded. Section 5 prefers
BullMQ on Redis, and says to prefer SQS, EventBridge and Step Functions if the
deployment turns out to be AWS-based. That question is open
(`docs/social-studio/README.md`, blocking question 3).

## Decision

BullMQ on Redis, reached only through a `JobQueue` port in `packages/jobs`:

```
enqueue(queue, payload, { jobId, runAt, maxAttempts, backoffMs })
get(queue, jobId)   cancel(queue, jobId)   setProgress(queue, jobId, pct)
```

`enqueue` returns `{ created: false, reason: 'duplicate' | 'already_completed' }` rather
than throwing, because the caller usually wants to carry on. Two adapters implement it
identically: `BullMqQueue` and `MemoryQueue`, so a test exercises the rule rather than
the transport.

## Consequences

- An AWS answer to blocking question 3 costs one adapter, not a rewrite of publishing.
- `jobId` carries the idempotency: a duplicate enqueue is a no-op that returns the
  existing job, and a completed job cannot be re-enqueued at all. This is what makes
  "never republish a success" structural rather than a check someone must remember.
- Without `REDIS_URL` the app falls back to `MemoryQueue` and logs a warning saying jobs
  will be lost on restart. The worker refuses to start at all, because a worker with no
  queue would look healthy while doing nothing.
