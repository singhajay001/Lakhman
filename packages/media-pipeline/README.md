# @spirithaus/media-pipeline

Ingestion, compositing and storage for protected product artwork. It is a package rather than part
of the web app because the worker cannot import from the app, and two copies of a verification
pipeline would be worse than any amount of moving (ADR 0012, ADR 0013).

## Object storage

Everything the pipeline produces is content-addressed and lives in object storage. The database
holds `objectKey` references; the bucket holds the bytes.

| Key                                          | Written by                            | Read by                                   |
| -------------------------------------------- | ------------------------------------- | ----------------------------------------- |
| `masters/<asset>.png`                        | ingestion (web or the sync script)    | compositing, on every job                 |
| `products/<asset>.png`, `labels/<asset>.png` | ingestion                             | compositing                               |
| `environments/<digest>.png`                  | `queueComposite`, on the request path | the worker, by key from the queue payload |
| `composites/<asset>/<platform>-<format>.png` | the worker                            | delivery                                  |

The environment plate is the one that matters architecturally. `queueComposite` writes it, puts
only its **key** on the queue, and returns; the worker reads it back. That works if and only if both
processes see the same store — which, on a deployment with separate web and worker machines, means
S3-compatible object storage and not a directory.

### Choosing a backend

`resolveStorageConfig` runs once at startup, in both processes, against the same five variables:
`AWS_ENDPOINT_URL_S3`, `BUCKET_NAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and the optional
`AWS_REGION` (default `auto`). Fly's Tigris integration injects them under exactly those names.

Three outcomes, no fourth:

- **A bucket selected and fully configured** → `S3Storage`.
- **Nothing selected, `NODE_ENV` is `development` or `test`** → `LocalStorage`, with a warning.
- **Anything else** → `StorageConfigError`, and the process does not start.

Only `AWS_ENDPOINT_URL_S3` and `BUCKET_NAME` _select_ a store. The credentials are required once one
is selected but never select one on their own, because they are ambient on many machines — CI
runners, laptops with an AWS profile — and treating a credential as intent makes unrelated
environments refuse to start over a bucket nobody configured.

**Local storage is development and test only.** This is enforced, not advised. See ADR 0015 for
what it is enforcing against.

### Semantics worth knowing before you use it

- `get` returns `null` **only** for a genuinely absent object (`NoSuchKey`, `NotFound`), matched on
  the error code and never on the HTTP status — `NoSuchBucket` is a 404 too. Everything else, a
  denial or a network fault included, throws `StorageError`. This matters because `handleComposite`
  treats a missing environment plate as a _terminal_ refusal with no retry: a denial reported as
  absence would be recorded as the pipeline working correctly.
- `put` replaces. Keys are digests of content or of stable identifiers, so writing the same
  environment twice is idempotent rather than accumulating near-duplicates.
- `StorageError` carries an error name, an HTTP status and the key. It never carries the SDK error,
  which holds the signed request — its message reaches the log _and_ the `render_job.error` column.
- Buckets are private and no object is written with a public-read ACL.

### Testing against it

`@spirithaus/testing` exports `S3TestServer`, a local HTTP server that answers path-style S3
requests. The SDK is **not** mocked in the storage tests: the property worth proving is that a
client built in one process reads what a client built in another wrote, and only the wire can
answer that. `resetStorage()` exists to stand in for the process boundary — it forces the next
`storage()` to construct a fresh client, which is what a second process does.

The server deliberately answers path-style requests only. A client left on the SDK's default
virtual-host addressing would ask for `<bucket>.<host>/<key>`, which against a fixed endpoint
resolves to a hostname that does not exist; here it fails loudly in a test instead.
