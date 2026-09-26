-- The audit trail is append-only, enforced by the database rather than by the
-- convention that nobody calls update. A feature written later cannot rewrite
-- history by reaching past the service layer.
--
-- Consequence, and it is deliberate: a shop cannot be hard-deleted while it has
-- audit rows, because the cascade would be a DELETE. Shops are closed by setting
-- uninstalledAt, which is what the uninstall webhook already does. Test cleanup
-- uses TRUNCATE, which fires a TRUNCATE trigger rather than a row DELETE trigger.

CREATE OR REPLACE FUNCTION audit_event_append_only() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_event is append-only: % is rejected', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER audit_event_no_rewrite
  BEFORE UPDATE OR DELETE ON "audit_event"
  FOR EACH ROW EXECUTE FUNCTION audit_event_append_only();
