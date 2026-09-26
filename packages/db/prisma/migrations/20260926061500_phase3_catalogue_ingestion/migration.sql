-- Ingesting real product artwork from the Shopify catalogue.
--
-- What is recorded here is what was measured at ingestion: where the bytes came from, what the
-- subject looked like, what the cutout did, and what OCR read off the label. None of it is
-- inferred later, because a master is immutable once approved and these are the facts a reviewer
-- needs in order to approve it.

ALTER TABLE "protected_product_asset"
  ADD COLUMN "sourceUrl"      TEXT,
  ADD COLUMN "sourceKind"     TEXT,
  ADD COLUMN "subjectProfile" JSONB,
  ADD COLUMN "cutout"         JSONB,
  ADD COLUMN "groundTruth"    JSONB,
  ADD COLUMN "needsReview"    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reviewReasons"  TEXT[]  NOT NULL DEFAULT '{}';

-- The same artwork ingests once. Re-running the sync finds this row instead of making a second
-- master for bytes that already have a digest, a colour reference and masks.
CREATE UNIQUE INDEX "protected_product_asset_shopId_masterDigest_key"
  ON "protected_product_asset" ("shopId", "masterDigest");
