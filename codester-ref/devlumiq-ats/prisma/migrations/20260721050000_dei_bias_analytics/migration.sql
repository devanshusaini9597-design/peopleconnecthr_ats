CREATE TABLE IF NOT EXISTS "CandidateSelfId" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT,
    "applicationId" TEXT,
    "organizationId" TEXT NOT NULL,
    "gender" TEXT,
    "ethnicity" TEXT,
    "veteranStatus" TEXT,
    "disability" TEXT,
    "declinedToSelfId" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CandidateSelfId_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CandidateSelfId_organizationId_idx" ON "CandidateSelfId"("organizationId");
CREATE INDEX IF NOT EXISTS "CandidateSelfId_candidateId_idx" ON "CandidateSelfId"("candidateId");
CREATE INDEX IF NOT EXISTS "CandidateSelfId_applicationId_idx" ON "CandidateSelfId"("applicationId");

CREATE TABLE IF NOT EXISTS "DiversityMetric" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobId" TEXT,
    "stage" TEXT NOT NULL,
    "period" TEXT NOT NULL DEFAULT 'monthly',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "breakdown" JSONB NOT NULL,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiversityMetric_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DiversityMetric_organizationId_stage_idx" ON "DiversityMetric"("organizationId", "stage");
CREATE INDEX IF NOT EXISTS "DiversityMetric_jobId_idx" ON "DiversityMetric"("jobId");

CREATE TABLE IF NOT EXISTS "OrgDeiSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "blindScreeningEnabled" BOOLEAN NOT NULL DEFAULT false,
    "diverseSlateAlerts" BOOLEAN NOT NULL DEFAULT false,
    "selfIdFormEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrgDeiSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrgDeiSettings_organizationId_key" ON "OrgDeiSettings"("organizationId");
