-- Section 15: once a protected product asset is approved, the bytes it points at and the
-- regions drawn on it are fixed. A mask change creates a new version rather than editing one,
-- so every derivative can still name the mask it was built against.
--
-- The same argument as the audit trail: a service can be persuaded to skip this, a trigger
-- cannot.

CREATE OR REPLACE FUNCTION protected_asset_write_once() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'APPROVED' THEN
    IF NEW."masterKey" IS DISTINCT FROM OLD."masterKey"
    OR NEW."masterDigest" IS DISTINCT FROM OLD."masterDigest"
    OR NEW."widthPx" IS DISTINCT FROM OLD."widthPx"
    OR NEW."heightPx" IS DISTINCT FROM OLD."heightPx"
    THEN
      RAISE EXCEPTION 'protected_product_asset % is approved: its master is write-once', OLD.id
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER protected_asset_write_once
  BEFORE UPDATE ON "protected_product_asset"
  FOR EACH ROW EXECUTE FUNCTION protected_asset_write_once();

CREATE OR REPLACE FUNCTION asset_mask_write_once() RETURNS trigger
  LANGUAGE plpgsql AS $$
DECLARE
  parent_status text;
BEGIN
  SELECT status INTO parent_status FROM "protected_product_asset" WHERE id = OLD."assetId";
  IF parent_status = 'APPROVED'
     AND (NEW."maskKey" IS DISTINCT FROM OLD."maskKey"
          OR NEW."regionDigest" IS DISTINCT FROM OLD."regionDigest"
          OR NEW.bounds IS DISTINCT FROM OLD.bounds) THEN
    RAISE EXCEPTION 'asset_mask % belongs to an approved asset: draw a new version instead', OLD.id
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER asset_mask_write_once
  BEFORE UPDATE ON "asset_mask"
  FOR EACH ROW EXECUTE FUNCTION asset_mask_write_once();

-- A dilation buffer outside 2–4 pixels is not a judgement call: below two the generator's
-- feathering bleeds across the silhouette, and above four the environment stops meeting the
-- product.
ALTER TABLE "asset_mask"
  ADD CONSTRAINT asset_mask_dilate_range CHECK ("dilatePx" BETWEEN 2 AND 4);
