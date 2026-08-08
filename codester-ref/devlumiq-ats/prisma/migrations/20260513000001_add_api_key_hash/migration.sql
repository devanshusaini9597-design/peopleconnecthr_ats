-- Add keyHash column to ApiKey for secure hashed key lookup
ALTER TABLE "ApiKey" ADD COLUMN IF NOT EXISTS "keyHash" TEXT;

-- Create unique index on keyHash
CREATE UNIQUE INDEX IF NOT EXISTS "ApiKey_keyHash_key" ON "ApiKey"("keyHash");
