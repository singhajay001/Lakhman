# 0013 — Compositing is queued work, not request work

**Status:** accepted, 2026-09-26

## Context

ADR 0012 closed with an outstanding item: compositing ran inside an HTTP handler. It decodes a
master, builds masks, runs a deterministic alpha-over, reads the label twice with OCR and
measures colour in Lab. Measured on a 700×1400 packshot in this container, the work takes about
a second; on a real 1366×1932 master with a large label it is several times that, and OCR is the
slow part.

A loader holding a response open for that is a gateway timeout waiting to happen — and the
timeout would happen at the proxy, after the work had already been done, so the user would see a
failure for a composite that actually succeeded.

## Decision

The request enqueues and ends. `queueComposite` writes a job row, stores the environment image,
enqueues, and returns a job id; the worker does the work.

**It shares `RenderJob` with video rendering.** The lifecycle is identical — queued, running,
progress, cancellable, ending in a `MediaAsset` — so a `kind` discriminator is honest where a
second near-identical table would not be. Existing rows are all video renders, which is what the
column's default records.

**The environment goes to storage, not into the payload.** A job payload travels through Redis,
and a megabyte of PNG does not belong in it. The worker rebuilds from the key, and refuses with a
clear reason if the bytes are not there.

**Idempotency covers the environment too.** The key is a digest over shop, asset, platform,
format and the environment bytes, so requesting the same composite twice returns the same job,
and a different backdrop is correctly different work.

**A refusal is not a retry.** A composite declined because the stored master no longer matches
the digest recorded at ingestion is the pipeline working as designed. The job ends `FAILED` with
that reason rather than being retried into refusing again. A genuine exception is re-thrown so
BullMQ applies its backoff.

**The pipeline moved out of the app.** `packages/media-pipeline` now holds the compositing,
ingestion and storage code that lived in `apps/social-studio/app/lib`. The worker cannot import
from the app, and having two copies of a verification pipeline would be worse than any amount of
moving.

## Consequences

- Without `REDIS_URL` the app falls back to an in-memory queue and warns. That warning matters
  more now: previously it affected background work, and now a composite request returns a job id
  for work nothing will ever run. Noted in the deployment configuration.
- The composite worker runs at concurrency 2 by default (`COMPOSITE_CONCURRENCY`), against 1 for
  renders. Image work is CPU-bound and sharp already uses several threads per operation, so this
  is a starting point rather than a measurement of any production host.
- Verified end to end: a request returns `QUEUED` in under a second having composited nothing,
  and the worker handler then produces a `COMPOSITE_STILL` at 1080×1920 with
  `verification: PASSED` in 1064ms.
- The UI shows composites and renders in one queue, distinguished by kind. It does not yet poll
  or stream: the page reports state when it is loaded. Server-sent events would be the next
  improvement and are not needed to make the work safe.
