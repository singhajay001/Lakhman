-- Section 20's approval invariants, in the database rather than in a service.
--
-- Three things a service could be persuaded to skip, and cannot be here:
--   1. a material edit invalidates approval, and cascades to the Approval rows;
--   2. a key cannot be added to an approval that is closed, that already has its
--      keys, or whose content has moved since the approver read it;
--   3. an approval is granted the moment its last key lands, atomically, so two
--      keys arriving together cannot leave it PENDING with two signatures.

-- 1 ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION content_variant_material_edit() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.content         IS DISTINCT FROM OLD.content
  OR NEW."primaryCopy"   IS DISTINCT FROM OLD."primaryCopy"
  OR NEW."callToAction"  IS DISTINCT FROM OLD."callToAction"
  OR NEW.hashtags        IS DISTINCT FROM OLD.hashtags
  OR NEW."altText"       IS DISTINCT FROM OLD."altText"
  OR NEW."destinationUrl" IS DISTINCT FROM OLD."destinationUrl"
  THEN
    NEW.revision := OLD.revision + 1;

    -- A hash the caller did not refresh is stale, and a stale hash must not be able
    -- to match an approval.
    IF NEW."contentHash" IS NOT DISTINCT FROM OLD."contentHash" THEN
      NEW."contentHash" := NULL;
    END IF;

    IF OLD."approvalState" IN ('APPROVED', 'PENDING') THEN
      NEW."approvalState" := 'INVALIDATED';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER content_variant_material_edit
  BEFORE UPDATE ON "content_variant"
  FOR EACH ROW EXECUTE FUNCTION content_variant_material_edit();

CREATE OR REPLACE FUNCTION content_variant_cascade_invalidation() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."approvalState" = 'INVALIDATED' AND OLD."approvalState" <> 'INVALIDATED' THEN
    UPDATE "approval"
       SET outcome = 'INVALIDATED', "updatedAt" = now()
     WHERE "variantId" = NEW.id
       AND outcome IN ('PENDING', 'GRANTED');
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER content_variant_cascade_invalidation
  AFTER UPDATE ON "content_variant"
  FOR EACH ROW EXECUTE FUNCTION content_variant_cascade_invalidation();

-- 2 ---------------------------------------------------------------------------

ALTER TABLE "approval_key"
  ADD CONSTRAINT approval_key_index_range CHECK ("keyIndex" IN (1, 2));

ALTER TABLE "approval"
  ADD CONSTRAINT approval_required_keys_range CHECK ("requiredKeys" IN (1, 2));

CREATE OR REPLACE FUNCTION approval_key_guard() RETURNS trigger
  LANGUAGE plpgsql AS $$
DECLARE
  target "approval";
  held   integer;
BEGIN
  SELECT * INTO target FROM "approval" WHERE id = NEW."approvalId" FOR UPDATE;

  IF target.outcome <> 'PENDING' THEN
    RAISE EXCEPTION 'approval % is % and cannot take another key', target.id, target.outcome
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- The approver signs what they read. If the content moved in between, the
  -- signature is for something that no longer exists.
  IF NEW."signedHash" <> target."contentHash" THEN
    RAISE EXCEPTION 'key signs content % but approval % is for %: the content changed after it was read',
      left(NEW."signedHash", 12), target.id, left(target."contentHash", 12)
      USING ERRCODE = 'restrict_violation';
  END IF;

  SELECT count(*) INTO held FROM "approval_key" WHERE "approvalId" = NEW."approvalId";
  IF held >= target."requiredKeys" THEN
    RAISE EXCEPTION 'approval % already holds its % key(s)', target.id, target."requiredKeys"
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF NEW."keyIndex" > target."requiredKeys" THEN
    RAISE EXCEPTION 'approval % needs % key(s), so there is no key %', target.id, target."requiredKeys", NEW."keyIndex"
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER approval_key_guard
  BEFORE INSERT ON "approval_key"
  FOR EACH ROW EXECUTE FUNCTION approval_key_guard();

-- 3 ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION approval_grant_when_complete() RETURNS trigger
  LANGUAGE plpgsql AS $$
DECLARE
  target "approval";
  held   integer;
BEGIN
  SELECT * INTO target FROM "approval" WHERE id = NEW."approvalId";
  SELECT count(*) INTO held FROM "approval_key" WHERE "approvalId" = NEW."approvalId";

  IF held >= target."requiredKeys" THEN
    UPDATE "approval"
       SET outcome = 'GRANTED', "decidedAt" = now(), "updatedAt" = now()
     WHERE id = target.id;

    -- The variant becomes approved only if it still is what was signed.
    IF target."variantId" IS NOT NULL THEN
      UPDATE "content_variant"
         SET "approvalState" = 'APPROVED'
       WHERE id = target."variantId"
         AND "contentHash" = target."contentHash";
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER approval_grant_when_complete
  AFTER INSERT ON "approval_key"
  FOR EACH ROW EXECUTE FUNCTION approval_grant_when_complete();
