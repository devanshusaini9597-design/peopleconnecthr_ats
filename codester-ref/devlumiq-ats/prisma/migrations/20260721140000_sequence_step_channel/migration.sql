-- CreateEnum value already exists as MessageChannel; add channel column to EmailSequenceStep
ALTER TABLE "EmailSequenceStep" ADD COLUMN IF NOT EXISTS "channel" "MessageChannel" NOT NULL DEFAULT 'EMAIL';
