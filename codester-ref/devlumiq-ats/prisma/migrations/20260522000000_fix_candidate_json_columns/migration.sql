-- Fix Candidate.skills and Candidate.tags if they were created as TEXT instead of JSONB
DO $$
DECLARE
    skills_udt TEXT;
    tags_udt   TEXT;
BEGIN
    SELECT udt_name INTO skills_udt
    FROM information_schema.columns
    WHERE table_name = 'Candidate' AND column_name = 'skills';

    SELECT udt_name INTO tags_udt
    FROM information_schema.columns
    WHERE table_name = 'Candidate' AND column_name = 'tags';

    -- Convert skills to JSONB if it's not already (handles text[], text, varchar)
    IF skills_udt IS DISTINCT FROM 'jsonb' THEN
        ALTER TABLE "Candidate" ALTER COLUMN "skills" TYPE JSONB USING to_jsonb("skills");
    END IF;

    -- Convert tags to JSONB if it's not already (handles text[], text, varchar)
    IF tags_udt IS DISTINCT FROM 'jsonb' THEN
        ALTER TABLE "Candidate" ALTER COLUMN "tags" TYPE JSONB USING to_jsonb("tags");
    END IF;
END $$;
