-- A sync that never reached Shopify is not a failed sync.
--
-- Two conditions produce it and neither is a bug: no offline session has been stored because
-- OAuth has not been completed, or the Admin host is refused by the container's egress policy.
-- FAILED would send someone looking for a fault in the sync, and drive BullMQ to retry work
-- that cannot succeed. This state says what happened and stops.
ALTER TYPE "SyncStatus" ADD VALUE IF NOT EXISTS 'UNREACHABLE';
