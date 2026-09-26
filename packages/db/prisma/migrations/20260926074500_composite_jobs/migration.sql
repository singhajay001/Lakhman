-- Compositing moves off the HTTP request path.
--
-- Running OCR and image compositing inside a loader is seconds of work holding a response open,
-- which is a gateway timeout waiting to happen (ADR 0012). It becomes a queued job instead, and
-- it shares RenderJob with video rendering because the lifecycle is identical: queued, running,
-- progress, cancellable, ending in a MediaAsset.
--
-- Existing rows are all video renders, which is what the default records.
CREATE TYPE "MediaJobKind" AS ENUM ('VIDEO_RENDER', 'COMPOSITE');

ALTER TABLE "render_job"
  ADD COLUMN "kind" "MediaJobKind" NOT NULL DEFAULT 'VIDEO_RENDER';

CREATE INDEX "render_job_shopId_kind_state_idx" ON "render_job" ("shopId", "kind", "state");
