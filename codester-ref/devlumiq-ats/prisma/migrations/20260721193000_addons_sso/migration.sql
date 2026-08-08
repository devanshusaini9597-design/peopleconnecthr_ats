-- Additive: Subscription add-ons + Org SSO config (existing buyers unaffected)

ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "addOns" JSONB NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS "OrgSsoConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "entryPoint" TEXT,
    "issuer" TEXT,
    "cert" TEXT,
    "emailAttribute" TEXT NOT NULL DEFAULT 'email',
    "wantAssertionsSigned" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgSsoConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrgSsoConfig_organizationId_key" ON "OrgSsoConfig"("organizationId");

DO $$ BEGIN
  ALTER TABLE "OrgSsoConfig" ADD CONSTRAINT "OrgSsoConfig_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
