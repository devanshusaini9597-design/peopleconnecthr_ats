-- CreateTable
CREATE TABLE IF NOT EXISTS "JobBoardIntegration" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "board" TEXT NOT NULL,
    "externalId" TEXT,
    "postUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "applications" INTEGER NOT NULL DEFAULT 0,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobBoardIntegration_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'JobBoardIntegration_jobId_fkey') THEN ALTER TABLE "JobBoardIntegration" ADD CONSTRAINT "JobBoardIntegration_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
