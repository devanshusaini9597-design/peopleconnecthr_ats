-- ============================================================
-- Migration: auth_tokens
-- Add email verification, password reset, and invite token
-- fields to the User model for Phase A onboarding flow.
-- All existing users are marked verified so live accounts
-- are not locked out.
-- ============================================================

-- New columns
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isEmailVerified"         BOOLEAN       NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "verificationToken"       TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "verificationTokenExpiry" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "resetToken"              TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "resetTokenExpiry"        TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "inviteToken"             TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "inviteTokenExpiry"       TIMESTAMP(3);

-- Unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS "User_verificationToken_key" ON "User"("verificationToken");
CREATE UNIQUE INDEX IF NOT EXISTS "User_resetToken_key"        ON "User"("resetToken");
CREATE UNIQUE INDEX IF NOT EXISTS "User_inviteToken_key"       ON "User"("inviteToken");

-- Mark every pre-existing user as verified so they are not locked out
UPDATE "User" SET "isEmailVerified" = true;
