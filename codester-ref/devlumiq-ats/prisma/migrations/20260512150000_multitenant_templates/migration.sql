-- ============================================================
-- Migration: multitenant_templates
-- Add organizationId (nullable) to all previously global-shared
-- models so each tenant gets their own isolated data.
-- Existing rows keep NULL which means "system-wide / legacy".
-- ============================================================

-- MessageThread
ALTER TABLE "MessageThread" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
CREATE INDEX IF NOT EXISTS "MessageThread_organizationId_idx" ON "MessageThread" ("organizationId");

-- EmailTemplate
ALTER TABLE "EmailTemplate" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
CREATE INDEX IF NOT EXISTS "EmailTemplate_organizationId_idx" ON "EmailTemplate" ("organizationId");

-- OfferLetterTemplate
ALTER TABLE "OfferLetterTemplate" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
CREATE INDEX IF NOT EXISTS "OfferLetterTemplate_organizationId_idx" ON "OfferLetterTemplate" ("organizationId");

-- ScorecardTemplate
ALTER TABLE "ScorecardTemplate" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
CREATE INDEX IF NOT EXISTS "ScorecardTemplate_organizationId_idx" ON "ScorecardTemplate" ("organizationId");

-- AssessmentTemplate
ALTER TABLE "AssessmentTemplate" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
CREATE INDEX IF NOT EXISTS "AssessmentTemplate_organizationId_idx" ON "AssessmentTemplate" ("organizationId");

-- ReferralProgram
ALTER TABLE "ReferralProgram" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
CREATE INDEX IF NOT EXISTS "ReferralProgram_organizationId_idx" ON "ReferralProgram" ("organizationId");

-- JobBoardCredential
ALTER TABLE "JobBoardCredential" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
CREATE INDEX IF NOT EXISTS "JobBoardCredential_organizationId_idx" ON "JobBoardCredential" ("organizationId");

-- Webhook
ALTER TABLE "Webhook" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
CREATE INDEX IF NOT EXISTS "Webhook_organizationId_idx" ON "Webhook" ("organizationId");

-- WebhookSubscription
ALTER TABLE "WebhookSubscription" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
CREATE INDEX IF NOT EXISTS "WebhookSubscription_organizationId_idx" ON "WebhookSubscription" ("organizationId");
