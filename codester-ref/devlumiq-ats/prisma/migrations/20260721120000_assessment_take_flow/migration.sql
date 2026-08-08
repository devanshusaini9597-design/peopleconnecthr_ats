-- Assessment take-flow: reminder tracking, manual review, response upsert uniqueness
ALTER TABLE "AssessmentAssignment" ADD COLUMN IF NOT EXISTS "reviewStatus" TEXT;
ALTER TABLE "AssessmentAssignment" ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "AssessmentAssignment_status_expiresAt_idx"
  ON "AssessmentAssignment"("status", "expiresAt");

ALTER TABLE "AssessmentResponse" ADD COLUMN IF NOT EXISTS "feedback" TEXT;
ALTER TABLE "AssessmentResponse" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Deduplicate before unique index (keep newest per assignment+question)
DELETE FROM "AssessmentResponse" a
USING "AssessmentResponse" b
WHERE a."assignmentId" = b."assignmentId"
  AND a."questionId" = b."questionId"
  AND a."id" < b."id";

CREATE UNIQUE INDEX IF NOT EXISTS "AssessmentResponse_assignmentId_questionId_key"
  ON "AssessmentResponse"("assignmentId", "questionId");
