ALTER TABLE "InterviewEvent" ADD COLUMN IF NOT EXISTS "recordingConsent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "InterviewEvent" ADD COLUMN IF NOT EXISTS "recordingConsentAt" TIMESTAMP(3);
ALTER TABLE "InterviewEvent" ADD COLUMN IF NOT EXISTS "transcriptRetentionDays" INTEGER NOT NULL DEFAULT 90;

CREATE TABLE IF NOT EXISTS "InterviewTranscript" (
    "id" TEXT NOT NULL,
    "interviewEventId" TEXT NOT NULL,
    "rawTranscript" TEXT NOT NULL,
    "speakers" JSONB NOT NULL DEFAULT '[]',
    "timestamps" JSONB NOT NULL DEFAULT '[]',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "aiSummary" TEXT,
    "suggestedScore" DOUBLE PRECISION,
    "suggestedRecommendation" TEXT,
    "scorecardSuggestions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewTranscript_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InterviewTranscript_interviewEventId_key" ON "InterviewTranscript"("interviewEventId");

ALTER TABLE "InterviewTranscript" ADD CONSTRAINT "InterviewTranscript_interviewEventId_fkey"
  FOREIGN KEY ("interviewEventId") REFERENCES "InterviewEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
