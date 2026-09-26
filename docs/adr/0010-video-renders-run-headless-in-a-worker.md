# 0010 — Video renders run headless in a worker, against a browser we pin

**Status:** accepted, 2026-09-26

## Context

Section 16 asks for programmatic video assemblies — 9:16 and 1:1, dynamic copy, kinetic captions,
audio sync. Remotion composes them in a browser, which makes the render a browser dependency in a
container with no display, and a long-running one: a 15-second 1080×1920 composition is minutes,
not milliseconds, so it cannot live in a request.

Three things had to be settled by trying them rather than by reading about them.

**The browser.** Pointing Remotion at the bundled `chromium-1194/chrome-linux/chrome` fails with
"Old Headless mode has been removed from the Chrome binary". The standalone
`chromium_headless_shell-1194/chrome-linux/headless_shell` works, and is what this container
pre-installs.

**The bundle.** Remotion's webpack override does not map `.js` specifiers onto `.tsx` sources, so
the NodeNext-style relative imports used everywhere else in this repo fail with
`Can't resolve './Root.js'`. Inside `apps/render/src`, and only there, relative imports carry no
extension.

**Assets.** The headless browser refuses `file://` URLs from an http-served bundle
("Error loading image with src: file://…"). Assets are served over local HTTP instead — which is
also what production will do with a signed URL, so the development path and the real one agree.

## Decision

`apps/render` is a Remotion workspace of its own: compositions, fonts vendored locally as woff2
with their OFL texts, a `render()` that caches the served bundle, and a `remotion.config.ts` whose
browser executable defaults to the headless shell. Nothing in it imports the app.

Renders run in the worker, on a second BullMQ `Worker` with concurrency 1 and a ten-minute lock,
queued idempotently on a sha256 of the canonicalised props. Cancellation is cooperative: the
handler polls the job row and aborts the render when the state becomes `CANCELLED`, because a
render already in flight cannot be pulled back by deleting a queue entry.

## Consequences

- Rendering is verified by rendering: real MP4s are produced headlessly in the integration tests
  and frames were inspected by eye. That caught two defects no assertion did — a caption track
  drawn straight through a wrapped headline, and geometry profile type metrics that understated
  the real headline, which had the Reel safe zone reading 41% when it is 28%.
- Output is inspected with `@remotion/media-parser` rather than trusted. Note for whoever owns
  this commercially: that package prints "Some companies are required to obtain a license to use
  @remotion/media-parser". No licence has been bought and none may be without separate
  authorisation.
- Concurrency 1 is a placeholder set by this container's memory, not a measurement of the
  production host.
- A render produces a `MediaAsset` with `verification: 'NOT_APPLICABLE'`. The four protected-asset
  checks are defined over a still composite; a video carrying a protected layer is not yet
  verifiable, and the record says so rather than implying it passed.
