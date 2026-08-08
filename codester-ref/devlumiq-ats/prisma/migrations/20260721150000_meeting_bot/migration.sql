-- Meeting join bot fields (Recall.ai BYOK)
ALTER TABLE "InterviewEvent" ADD COLUMN IF NOT EXISTS "meetingBotId" TEXT;
ALTER TABLE "InterviewEvent" ADD COLUMN IF NOT EXISTS "meetingBotProvider" TEXT;
ALTER TABLE "InterviewEvent" ADD COLUMN IF NOT EXISTS "meetingBotStatus" TEXT;
