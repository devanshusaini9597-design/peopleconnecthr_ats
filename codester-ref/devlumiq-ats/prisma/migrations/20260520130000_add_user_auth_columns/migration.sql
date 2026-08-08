-- ============================================================
-- Migration: add_user_auth_columns
-- Adds missing User columns and UserActivityLog table that
-- exist in schema.prisma but were never included in previous
-- migrations. Safe on fresh DBs and existing DBs.
-- ============================================================

-- Missing User columns (auth + profile fields)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "password"    TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatar"      TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isActive"     BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt"  TIMESTAMP(3);

-- Missing UserActivityLog table
CREATE TABLE IF NOT EXISTS "UserActivityLog" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "action"     TEXT NOT NULL,
    "entityType" TEXT,
    "entityId"   TEXT,
    "metadata"   JSONB,
    "ipAddress"  TEXT,
    "userAgent"  TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserActivityLog_pkey" PRIMARY KEY ("id")
);

-- Foreign key for UserActivityLog
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserActivityLog_userId_fkey') THEN
        ALTER TABLE "UserActivityLog" ADD CONSTRAINT "UserActivityLog_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
    END IF;
END $$;

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS "UserActivityLog_userId_idx"    ON "UserActivityLog"("userId");
CREATE INDEX IF NOT EXISTS "UserActivityLog_createdAt_idx" ON "UserActivityLog"("createdAt");
