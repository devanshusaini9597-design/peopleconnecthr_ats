-- Multi-channel messaging (additive — existing messages default to EMAIL)

CREATE TYPE "MessageChannel" AS ENUM ('EMAIL', 'SMS', 'WHATSAPP');

ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "channel" "MessageChannel" NOT NULL DEFAULT 'EMAIL';
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "toPhone" TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "fromPhone" TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "externalId" TEXT;

-- fromEmail was required; keep it but allow empty for SMS/WhatsApp
ALTER TABLE "Message" ALTER COLUMN "fromEmail" SET DEFAULT '';

ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "smsOptIn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "whatsappOptIn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "phoneVerifiedAt" TIMESTAMP(3);
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "messagingConsentAt" TIMESTAMP(3);
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "messagingConsentIp" TEXT;

CREATE INDEX IF NOT EXISTS "Message_channel_idx" ON "Message"("channel");
CREATE INDEX IF NOT EXISTS "Message_toPhone_idx" ON "Message"("toPhone");
CREATE INDEX IF NOT EXISTS "Message_externalId_idx" ON "Message"("externalId");
