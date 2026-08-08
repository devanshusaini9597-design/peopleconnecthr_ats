-- Phase B: Session Security Migration
-- Adds tokenVersion to User and creates UserSession table

-- Add tokenVersion column to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- Create UserSession table if it doesn't exist
CREATE TABLE IF NOT EXISTS "UserSession" (
    "id"           TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "tokenVersion" INTEGER NOT NULL,
    "ipAddress"    TEXT,
    "userAgent"    TEXT,
    "expiresAt"    TIMESTAMP(3) NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- Index for fast session lookups by user
CREATE INDEX IF NOT EXISTS "UserSession_userId_idx" ON "UserSession"("userId");

-- Foreign key with cascade delete (sessions removed when user deleted)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'UserSession_userId_fkey'
    ) THEN
        ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
