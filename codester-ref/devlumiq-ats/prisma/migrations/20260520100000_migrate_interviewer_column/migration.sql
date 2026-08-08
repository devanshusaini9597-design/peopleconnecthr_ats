-- ============================================================
-- Migration: migrate_interviewer_column
-- Preserves legacy InterviewEvent.interviewer text data by
-- converting it to the new interviewers JSON array format.
-- Safe on v1 databases (column exists) and v2/fresh databases
-- (column already gone, skipped).
-- ============================================================

DO $$
BEGIN
    -- Only run if the old v1 "interviewer" text column still exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'InterviewEvent' AND column_name = 'interviewer'
    ) THEN
        -- Add the new "interviewers" JSONB column if not already present
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'InterviewEvent' AND column_name = 'interviewers'
        ) THEN
            ALTER TABLE "InterviewEvent" ADD COLUMN "interviewers" JSONB;
        END IF;

        -- Migrate existing interviewer names into JSON array [{"name": "..."}]
        UPDATE "InterviewEvent"
        SET "interviewers" = jsonb_build_array(jsonb_build_object('name', "interviewer"))
        WHERE "interviewer" IS NOT NULL AND "interviewer" <> '';

        -- Drop the obsolete text column
        ALTER TABLE "InterviewEvent" DROP COLUMN IF EXISTS "interviewer";
    END IF;
END $$;
