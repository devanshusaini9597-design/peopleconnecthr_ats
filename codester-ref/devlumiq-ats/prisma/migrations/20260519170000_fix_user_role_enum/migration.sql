-- ============================================================
-- Migration: fix_user_role_enum
-- Creates the UserRole enum type and converts User.role from
-- TEXT to the enum. This fixes fresh installs where the init
-- migration only created a TEXT column.
-- ============================================================

-- 1. Create UserRole enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
        CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER', 'VIEWER');
    END IF;
END $$;

-- 2. Convert User.role column to enum (only if still TEXT)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'User' AND column_name = 'role'
        AND data_type = 'character varying'
    ) THEN
        -- Map legacy text values to valid enum members
        UPDATE "User" SET "role" = 'RECRUITER' WHERE "role" = 'Recruitment Manager' OR "role" IS NULL OR "role" = '';
        -- Catch-all: any remaining unknown role becomes RECRUITER
        UPDATE "User" SET "role" = 'RECRUITER' WHERE "role" NOT IN ('ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER', 'VIEWER');
        -- Drop old text default before changing type
        ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
        -- Cast to enum
        ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole" USING "role"::"UserRole";
        -- Set enum default
        ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'RECRUITER'::"UserRole";
    END IF;
END $$;
