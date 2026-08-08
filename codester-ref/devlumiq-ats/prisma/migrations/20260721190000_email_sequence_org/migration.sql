-- Add organization scoping to EmailSequence (fail-closed tenant filters)
ALTER TABLE "EmailSequence" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
CREATE INDEX IF NOT EXISTS "EmailSequence_organizationId_idx" ON "EmailSequence"("organizationId");
