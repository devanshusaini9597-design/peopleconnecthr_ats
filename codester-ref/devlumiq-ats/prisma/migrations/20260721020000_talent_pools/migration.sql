-- Talent CRM / silver-medalist pools (additive)

ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "talentPoolConsent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "talentPoolConsentAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "TalentPool" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "poolType" TEXT NOT NULL DEFAULT 'general',
    "tags" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TalentPool_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TalentPool_organizationId_idx" ON "TalentPool"("organizationId");
CREATE INDEX IF NOT EXISTS "TalentPool_poolType_idx" ON "TalentPool"("poolType");

CREATE TABLE IF NOT EXISTS "TalentPoolMember" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "addedReason" TEXT,
    "addedById" TEXT,
    "lastContactedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TalentPoolMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TalentPoolMember_poolId_candidateId_key" ON "TalentPoolMember"("poolId", "candidateId");
CREATE INDEX IF NOT EXISTS "TalentPoolMember_candidateId_idx" ON "TalentPoolMember"("candidateId");
CREATE INDEX IF NOT EXISTS "TalentPoolMember_lastContactedAt_idx" ON "TalentPoolMember"("lastContactedAt");

ALTER TABLE "TalentPool" ADD CONSTRAINT "TalentPool_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TalentPoolMember" ADD CONSTRAINT "TalentPoolMember_poolId_fkey"
  FOREIGN KEY ("poolId") REFERENCES "TalentPool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TalentPoolMember" ADD CONSTRAINT "TalentPoolMember_candidateId_fkey"
  FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
