# Runbook

Symptom to cause to fix, for the failure states this system produces on purpose. Every one of
these is a deliberate outcome with a diagnostic attached — if you are reading a stack trace
instead, that is a defect, not a configuration problem.

## "Shopify rejected the access token" — but the token is fine

It almost certainly is fine. Check the log line beside it. If it says `network_blocked`, the
container's egress policy refused the host and no token would have changed that.

The confusion has a specific cause: with `https_proxy` set but `NODE_USE_ENV_PROXY` unset, Node's
`fetch` ignores the proxy and goes direct, and the filtering gateway answers with its own `403`
carrying `x-deny-reason: host_not_allowed`. Before this was classified, that read as
authentication and sent people to the Partner Dashboard.

**Fix:** set `NODE_USE_ENV_PROXY=1` on the process, or add the host to the allowlist. The
diagnostic names whichever applies.

**How to tell them apart by hand:**

```sh
curl -sSI https://<store>.myshopify.com/admin | grep -i x-deny-reason
```

A header means the network refused you. No header and a `401`/`403` means Shopify did.

## A sync sits at `UNREACHABLE`

Not a failure. It means the sync never reached Shopify, and nothing was attempted:

- no offline session is stored (OAuth has not been completed for that shop), or
- the Admin host is refused by the egress policy.

The `SyncRun` row carries the reason. It is deliberately not `FAILED`, because `FAILED` sends
someone looking for a fault in the sync and has BullMQ retry work that cannot succeed.

**Fix:** complete the install, or open the egress. Then trigger a new sync; nothing needs
clearing.

## Mutations log `[SANDBOX] Outbound mutation bypassed`

The app could not reach Shopify and **did not write anything**. This is the designed behaviour,
not a degraded mode that partially worked.

The outcome type has no field called `success` — it is `applied`, `sandboxed` or `failed`, and
the compiler makes every caller handle `sandboxed`. If you are wondering whether the write landed
while seeing this line: it did not.

**Fix:** the reason is in the log line. It is one of the two causes above.

## The server will not start

If the log shows `ReferenceError: __dirname is not defined in ES module scope`, a CommonJS
dependency has been bundled into the ESM server output. `tesseract.js` did this for three phases
while every build passed, because a build that cannot boot still builds.

**Fix:** add the package to `ssr.external` in `apps/social-studio/vite.config.ts` *and* to the
app's own `dependencies` — under pnpm's strict layout it must be resolvable from the app to be
externalised.

**Prevention:** `pnpm smoke` spawns the built server and probes the callback route. It runs as
part of `pnpm verify`. If you are adding a native or CommonJS dependency, that check is the one
that will catch you.

## OAuth install fails at the last step

The callback answers with a JSON body naming the cause. Outside production it includes the
remedy; in production it gives the summary and the code, and the log has the rest.

| `error` | Cause |
| --- | --- |
| `missing_configuration` | An environment variable is unset. The response names which. |
| `missing_parameters` | Not an OAuth callback — usually someone opening the URL in a browser. |
| `invalid_shop_domain` | The `shop` parameter is not a `*.myshopify.com` domain. |
| `signature_mismatch` | Usually `SHOPIFY_API_SECRET` belongs to a different app than the install started from. Also what a replayed or hand-edited callback looks like. |
| `token_exchange_failed` | The callback was well formed and correctly signed, but the exchange did not complete. Check the redirect URI matches byte for byte, and that the host can reach `*.myshopify.com`. |

## A composite reports `verification: FAIL`

Read the report rather than retrying. Four checks run and they are complementary — a tint passes
OCR and fails colour.

| Check | What a failure means |
| --- | --- |
| `pixel_identity` | The product layer is not byte-identical to the master where it should be. |
| `label_text` | OCR read different text on the composite than on the master. |
| `structure` | The product's shape or structure moved. |
| `colour` | The label's colour drifted from the reference recorded at ingestion (ΔE2000). |

`UNAVAILABLE` is not a pass. A check that cannot decide says so.

## A composite is refused: "does not match the artwork approved at ingestion"

The bytes in storage are no longer the bytes that were hashed when the master was approved. The
composite is refused outright rather than produced carrying a failure, because an altered product
layer must never reach a reviewer at all.

**Fix:** re-ingest the artwork you intend to use. Do not overwrite the object in storage.

## Renders fail with no browser

Remotion needs a Chromium headless shell. It downloads its own on first use, which needs egress
to its CDN.

**Fix:** set `REMOTION_BROWSER_EXECUTABLE` to a shell baked into the image, or allow that egress.
Note that Remotion requires the *headless shell*, not the full Chrome binary — pointing at
`chrome-linux/chrome` fails with a message about old headless mode having been removed.

## Assets vanish after a restart

`MEDIA_STORE_DIR` defaults to a local directory, and the local store logs a warning that it will
not survive the machine. Only possible in development and test: a deployed process refuses to start
without a bucket (ADR 0015).

**Fix:** configure object storage before generating anything worth keeping.

## The process refuses to start, naming BUCKET_NAME

```
refusing to start: Object storage is not configured and NODE_ENV=production. …
Set AWS_ENDPOINT_URL_S3, BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY.
```

Working as intended, in both web and worker. A deployed deployment runs the two processes on
separate machines with separate filesystems, so a local directory is not shared storage — the web
process would write an environment plate to its own disk and the worker would not find it.

**Fix:** `fly storage create -n <bucket>`, which sets all four as app secrets. Do not work around it
by setting `NODE_ENV=development`; that turns a refusal into every composite failing.

A variant names a *partial* configuration — "`BUCKET_NAME` names a bucket, but
`AWS_SECRET_ACCESS_KEY` is not set". Same fix. It refuses in development too, deliberately: a named
bucket with a missing credential is a typo, and falling back to local storage would hide it until
the worker read failed.

## Every composite fails with "the environment image … is missing from storage"

The job row says the plate is missing, which reads like a problem with the artwork. It is almost
never that.

**Check first:** do web and worker resolve to the *same* bucket and endpoint? Both log
`object storage configured` at startup with `endpoint` and `bucket`. If those differ — or if one
says it is using a local directory — that is the fault. Set the storage variables at the app level
so both process groups inherit them, rather than per process group.

**Then check:** `AccessDenied` in the worker's log. A credential that can write but not read
produces exactly this symptom, because the web process's put succeeds and the worker's get fails.
The adapter surfaces a denial as a `StorageError` rather than as a missing object, precisely so this
is distinguishable — a missing plate is a terminal refusal with no retry, and a denial reported as
absence would be recorded as the pipeline working correctly.
