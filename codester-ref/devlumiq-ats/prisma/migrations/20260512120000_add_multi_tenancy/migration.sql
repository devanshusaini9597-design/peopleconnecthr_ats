-- AddColumn: organizationId to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

-- AddColumn: organizationId to Candidate
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

-- FKs to Company only if Company already exists (fresh installs create Company later in v2_schema_complete).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Company'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_organizationId_fkey') THEN
      ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "Company"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Candidate_organizationId_fkey') THEN
      ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "Company"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;
