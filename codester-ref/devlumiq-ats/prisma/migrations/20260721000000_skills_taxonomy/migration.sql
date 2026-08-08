-- Skills taxonomy (additive — Candidate.skills JSON unchanged)

CREATE TABLE IF NOT EXISTS "Skill" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'General',
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Skill_slug_key" ON "Skill"("slug");
CREATE INDEX IF NOT EXISTS "Skill_name_idx" ON "Skill"("name");
CREATE INDEX IF NOT EXISTS "Skill_category_idx" ON "Skill"("category");
CREATE INDEX IF NOT EXISTS "Skill_organizationId_idx" ON "Skill"("organizationId");

CREATE TABLE IF NOT EXISTS "CandidateSkill" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "proficiency" INTEGER NOT NULL DEFAULT 3,
    "yearsUsed" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateSkill_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CandidateSkill_candidateId_skillId_key" ON "CandidateSkill"("candidateId", "skillId");
CREATE INDEX IF NOT EXISTS "CandidateSkill_skillId_idx" ON "CandidateSkill"("skillId");

CREATE TABLE IF NOT EXISTS "JobSkill" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "minProficiency" INTEGER NOT NULL DEFAULT 1,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobSkill_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "JobSkill_jobId_skillId_key" ON "JobSkill"("jobId", "skillId");
CREATE INDEX IF NOT EXISTS "JobSkill_skillId_idx" ON "JobSkill"("skillId");

ALTER TABLE "Skill" ADD CONSTRAINT "Skill_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CandidateSkill" ADD CONSTRAINT "CandidateSkill_candidateId_fkey"
  FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CandidateSkill" ADD CONSTRAINT "CandidateSkill_skillId_fkey"
  FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JobSkill" ADD CONSTRAINT "JobSkill_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JobSkill" ADD CONSTRAINT "JobSkill_skillId_fkey"
  FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
