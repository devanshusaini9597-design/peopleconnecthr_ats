-- ============================================================
-- Migration: migrate_premium_columns
-- Preserves data from v1 premium-feature tables that underwent
-- column renames or schema changes before db push reconciles them.
-- Safe on v1 databases (old columns exist) and v2/fresh databases
-- (old columns already gone, skipped).
-- ============================================================

-- 1. InterviewScore: preserve legacy "criteria" text into "criteriaName"
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'InterviewScore' AND column_name = 'criteria'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'InterviewScore' AND column_name = 'criteriaName'
        ) THEN
            ALTER TABLE "InterviewScore" ADD COLUMN "criteriaName" TEXT;
        END IF;
        UPDATE "InterviewScore" SET "criteriaName" = "criteria" WHERE "criteriaName" IS NULL;
    END IF;
END $$;

-- 2. InterviewScore: preserve legacy "scoredBy" text into "scoredById"
--    (best-effort match against User.name or User.email)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'InterviewScore' AND column_name = 'scoredBy'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'InterviewScore' AND column_name = 'scoredById'
        ) THEN
            ALTER TABLE "InterviewScore" ADD COLUMN "scoredById" TEXT;
        END IF;
        UPDATE "InterviewScore" i
        SET "scoredById" = u.id
        FROM "User" u
        WHERE i."scoredById" IS NULL
          AND (i."scoredBy" = u.name OR i."scoredBy" = u.email);
    END IF;
END $$;

-- 3. EmailTemplate: convert legacy "variables" TEXT to JSONB if needed
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'EmailTemplate' AND column_name = 'variables' AND data_type = 'text'
    ) THEN
        ALTER TABLE "EmailTemplate" ALTER COLUMN "variables" TYPE JSONB USING "variables"::JSONB;
    END IF;
END $$;

-- 4. Comment: convert legacy "mentions" TEXT to JSONB if needed
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Comment' AND column_name = 'mentions' AND data_type = 'text'
    ) THEN
        ALTER TABLE "Comment" ALTER COLUMN "mentions" TYPE JSONB USING "mentions"::JSONB;
    END IF;
END $$;
