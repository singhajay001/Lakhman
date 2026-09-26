# 15. Object storage is shared, or the process refuses to start

Date: 2026-09-26

## Status

Accepted. Implements the storage half of ADR 0013, which moved compositing to a worker and left
the two processes assuming a filesystem they do not share.

## Context

ADR 0013 moved compositing off the request path. The request writes the environment plate to
storage, puts the key on the queue, and returns a job id; the worker reads the plate back by that
key and does the work. That is the right shape, and it was built on a storage layer that could not
support it.

`storage()` had one implementation and no branch:

```ts
export function storage(): Storage {
  const root = process.env.MEDIA_STORE_DIR ?? '/tmp/spirithaus-media';
  logger.warn({ root }, 'No object storage provider is configured; media is written to a
    local directory and will not survive this machine.');
  instance = new LocalStorage(root);
}
```

No S3 client existed anywhere in the monorepo, and the only `ObjectStorageProvider` adapter was the
mock. The warning was not stale — it was accurate, and it described a defect rather than a
limitation.

On a single machine this works and every test passed. On the two-process-group Fly deployment the
staging plan calls for, it cannot: the web machine writes `environments/<digest>.png` to its own
`/tmp`, and the worker machine reads a different `/tmp` and finds nothing. **Every composite would
have failed**, and it would have failed as:

> The environment image environments/abc123.png is missing from storage, so this composite cannot
> be rebuilt.

which reads as a problem with the artwork. The handler treats a missing plate as a *terminal
refusal* — no retry — so the failure would have been recorded as the pipeline working correctly,
and nobody would have looked at the deployment.

This was found during staging preflight, before provisioning. Paying for a month of staging that
cannot complete its own verification plan is the cost of not finding it.

## Decision

**An S3-compatible adapter, and a resolver that refuses rather than falls back.**

`resolveStorageConfig` runs once at startup in both processes, against the same variables, and has
exactly three outcomes:

| Condition | Outcome |
| --- | --- |
| A store is selected and fully configured | `S3Storage` |
| No store selected, `NODE_ENV` is `development` or `test` | `LocalStorage`, with a warning |
| Anything else | `StorageConfigError`, and the process does not start |

The variables are the ones Fly's Tigris integration injects, under their own names:
`AWS_ENDPOINT_URL_S3`, `BUCKET_NAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and
`AWS_REGION` (optional, defaulting to `auto`, which is what Tigris uses).

### Selectors and credentials are not the same kind of variable

Only `AWS_ENDPOINT_URL_S3` and `BUCKET_NAME` are read as "use S3". The credentials are required
once a store is selected but never select one on their own.

This distinction is load-bearing and the first implementation got it wrong. `AWS_ACCESS_KEY_ID`,
`AWS_SECRET_ACCESS_KEY` and `AWS_REGION` are **ambient** on a great many machines — CI runners,
laptops with an AWS profile, and the very container this was developed in. Counting a credential as
intent made every pre-existing integration test refuse to start over a bucket nobody had
configured. A bucket name and a custom endpoint are never ambient; nothing sets those by accident.

### A half-set configuration is a refusal, not a fallback

If a bucket is named but a credential is missing, the process refuses. The alternative — quietly
using local storage — hides a typo in a variable name until the worker cannot read what the web
process wrote, which is the original defect with an extra step.

### Absence and denial are different answers

`get` returns `null` only for `NoSuchKey` and `NotFound`, matched on the error code and never on
the HTTP status. `NoSuchBucket` is also a 404, and an earlier version of the adapter treated any
404 as absence — a test caught it. That collapse would turn a wrong bucket name into "the object
does not exist", which the handler records as a terminal refusal naming the artwork. Every other
failure, including `AccessDenied` and any network fault, is thrown as a `StorageError`.

An unrecognised 404 is therefore a failure rather than absence. That is the conservative direction:
an unknown error stops the job instead of silently emptying the store.

### Errors carry a status, not a signed request

SDK errors carry `$metadata`, the signed request, and sometimes a URL with credentials in its query
string. `StorageError` keeps the error name, an HTTP status and the key, and nothing else — because
its message reaches both the log and the `render_job.error` column, which people read.

## Consequences

**A deployed deployment without a bucket does not come up.** That is the intended trade: a
deployment that refuses at startup is cheaper to diagnose than one that accepts work and fails
every job.

**Development is unchanged.** No variables, local directory, same warning.

**Object storage is deliberately not part of `/readyz`.** Misconfiguration is already fatal at
startup, so a probe would only catch an outage — and readiness gates the whole web process, so
taking the dashboard down because storage is briefly unavailable turns "composites fail" into
"nothing works". A negative-lookup probe also costs a cross-region existence check on a Global
Tigris bucket, against a 2.5s budget, for a dependency that is not gating the request. The reasoning
is recorded in `readyz.tsx`.

**The AWS SDK is external to the SSR bundle**, alongside `sharp` and `tesseract.js`, and declared in
both `media-pipeline` and the app. CI resolves it inside the built image, which is the check that
catches a missing declaration.

**Tigris placement is not settled by this ADR.** The adapter talks to whatever endpoint it is given.
Whether the bucket is single-region `syd` is a provisioning question with an unresolved answer:
`fly storage create` exposes no region flag, Tigris's documented mechanism is `LocationConstraint`
on the S3 `CreateBucket` call, and `syd` appears only in Tigris's "Fly.io available regions" list
and not in the direct `t3.storage.dev` list. It must be proven against a live bucket with
`get-bucket-location`, not assumed because the endpoint answers from Sydney.

## What this does not defend against

The bucket is shared mutable state and this adapter does not make it transactional. Two workers
compositing the same asset and format write the same key; the bytes are deterministic, so the
second write is identical, but nothing here would detect it if they were not.

Nor does it verify SigV4. The test server records that a request was signed and does not recompute
the signature, so the tests prove the client signs and addresses the bucket path-style — a real
endpoint proves the signature is correct.
