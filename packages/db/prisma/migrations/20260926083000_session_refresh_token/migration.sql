-- The session table was missing two columns the session-storage library writes.
--
-- @shopify/shopify-app-session-storage-prisma 11 writes `refreshToken` and
-- `refreshTokenExpires` on every storeSession. Without them Prisma rejects the write with
-- "Unknown argument `refreshToken`", so OAuth could never have persisted a session — the app
-- would have completed the token exchange and then failed to save the result.
--
-- Found by exercising the real library against a real database rather than by reading it.
--
-- Both are nullable: a session without a refresh token is normal, and every existing row
-- predates the column.
ALTER TABLE "session"
  ADD COLUMN "refreshToken" TEXT,
  ADD COLUMN "refreshTokenExpires" TIMESTAMP(3);
