ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

CREATE INDEX IF NOT EXISTS "Announcement_organizationId_idx" ON "Announcement"("organizationId");

ALTER TABLE "SourceQualityMetric" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

CREATE INDEX IF NOT EXISTS "SourceQualityMetric_organizationId_idx" ON "SourceQualityMetric"("organizationId");
