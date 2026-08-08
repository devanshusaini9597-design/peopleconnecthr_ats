-- Assessment taking + proctoring (additive; proctoring off by default)

ALTER TABLE "AssessmentTemplate" ADD COLUMN IF NOT EXISTS "proctoringEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AssessmentTemplate" ADD COLUMN IF NOT EXISTS "proctoringStrictness" TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE "AssessmentTemplate" ADD COLUMN IF NOT EXISTS "requireFullscreen" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AssessmentTemplate" ADD COLUMN IF NOT EXISTS "snapshotIntervalSec" INTEGER NOT NULL DEFAULT 30;

ALTER TABLE "AssessmentAssignment" ADD COLUMN IF NOT EXISTS "accessToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "AssessmentAssignment_accessToken_key" ON "AssessmentAssignment"("accessToken");
CREATE INDEX IF NOT EXISTS "AssessmentAssignment_accessToken_idx" ON "AssessmentAssignment"("accessToken");

CREATE TABLE IF NOT EXISTS "ProctoringSession" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "webcamSnapshots" JSONB NOT NULL DEFAULT '[]',
    "tabSwitchCount" INTEGER NOT NULL DEFAULT 0,
    "copyPasteEvents" JSONB NOT NULL DEFAULT '[]',
    "blurEvents" JSONB NOT NULL DEFAULT '[]',
    "timeline" JSONB NOT NULL DEFAULT '[]',
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "plagiarismScore" DOUBLE PRECISION,
    "plagiarismNotes" TEXT,
    "fullscreenExits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProctoringSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProctoringSession_assignmentId_key" ON "ProctoringSession"("assignmentId");

ALTER TABLE "ProctoringSession" ADD CONSTRAINT "ProctoringSession_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "AssessmentAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
