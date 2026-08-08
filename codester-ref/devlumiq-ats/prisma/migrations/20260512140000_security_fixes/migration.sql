-- ============================================================
-- Migration: security_fixes
-- 1. Replace global Candidate email unique with composite
--    (email, organizationId) so the same candidate can apply
--    to multiple companies without a DB error.
-- 2. Add an plain index on email for fast lookups.
-- ============================================================

-- Drop the old global unique constraint on Candidate.email
DROP INDEX IF EXISTS "Candidate_email_key";

-- Add composite unique: same email is allowed across orgs;
-- within one org it remains unique.
-- NOTE: PostgreSQL treats NULL as distinct, so two rows with
-- the same email + NULL organizationId are considered unique.
CREATE UNIQUE INDEX IF NOT EXISTS "Candidate_email_orgId_key"
  ON "Candidate" ("email", "organizationId");

-- Plain non-unique index for fast email lookups
CREATE INDEX IF NOT EXISTS "Candidate_email_idx"
  ON "Candidate" ("email");
