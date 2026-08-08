-- ============================================================
-- Migration: v2_schema_complete
-- Creates ALL tables introduced in v2 that are NOT created by
-- earlier migrations (20260406133749_init through 20260519170000).
--
-- This makes `prisma migrate deploy` work standalone on BOTH:
--   - Fresh databases (after `db push`)
--   - v1 -> v2 upgrades (missing tables get created)
--
-- Every statement uses IF NOT EXISTS / IF NOT EXISTS checks.
-- ============================================================

-- ============================================================
-- ENUMS (v2 additions)
-- ============================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CalendarProvider') THEN
        CREATE TYPE "CalendarProvider" AS ENUM ('GOOGLE', 'OUTLOOK', 'CALENDLY');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BgCheckProvider') THEN
        CREATE TYPE "BgCheckProvider" AS ENUM ('CHECKR', 'ONFIDO', 'GOODHIRE', 'STERLING', 'ACCURATE');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ESignatureProviderType') THEN
        CREATE TYPE "ESignatureProviderType" AS ENUM ('DOCUSIGN', 'HELLOSIGN', 'SIGNNOW', 'ADOBE_SIGN');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'JobBoard') THEN
        CREATE TYPE "JobBoard" AS ENUM ('LINKEDIN', 'INDEED', 'GLASSDOOR', 'ZIPRECRUITER', 'MONSTER', 'CAREERBUILDER', 'SIMPLYHIRED', 'STACKOVERFLOW', 'ANGELLIST', 'Weworkremotely');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AssessmentType') THEN
        CREATE TYPE "AssessmentType" AS ENUM ('CODING', 'MULTIPLE_CHOICE', 'OPEN_ENDED', 'PERSONALITY', 'LOGICAL_REASONING', 'LANGUAGE', 'CUSTOM');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Plan') THEN
        CREATE TYPE "Plan" AS ENUM ('FREE', 'STARTER', 'PRO', 'ENTERPRISE');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubStatus') THEN
        CREATE TYPE "SubStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'TRIALING');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EmailTrigger') THEN
        CREATE TYPE "EmailTrigger" AS ENUM ('STAGE_CHANGE', 'INTERVIEW_SCHEDULED', 'OFFER_SENT', 'APPLICATION_RECEIVED', 'CANDIDATE_REJECTED', 'INTERVIEW_REMINDER', 'NO_RESPONSE_7_DAYS', 'NO_RESPONSE_14_DAYS');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FormFieldType') THEN
        CREATE TYPE "FormFieldType" AS ENUM ('TEXT', 'TEXTAREA', 'EMAIL', 'PHONE', 'NUMBER', 'DATE', 'SELECT', 'MULTISELECT', 'CHECKBOX', 'RADIO', 'FILE', 'URL', 'RATING', 'YES_NO');
    END IF;
END $$;

-- ============================================================
-- 1. COMPANY / CAREER PAGE BUILDER
-- ============================================================

CREATE TABLE IF NOT EXISTS "Company" (
    "id"              TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "slug"            TEXT NOT NULL,
    "description"     TEXT,
    "website"         TEXT,
    "logoUrl"         TEXT,
    "faviconUrl"      TEXT,
    "primaryColor"    TEXT NOT NULL DEFAULT '#0d9488',
    "secondaryColor"  TEXT NOT NULL DEFAULT '#14b8a6',
    "accentColor"     TEXT NOT NULL DEFAULT '#5eead4',
    "fontFamily"      TEXT NOT NULL DEFAULT 'inter',
    "customCss"       TEXT,
    "metaTitle"       TEXT,
    "metaDescription" TEXT,
    "ogImageUrl"      TEXT,
    "twitterHandle"   TEXT,
    "linkedinUrl"     TEXT,
    "heroTitle"       TEXT NOT NULL DEFAULT 'Join Our Team',
    "heroSubtitle"    TEXT,
    "heroBackground"  TEXT,
    "showBenefits"    BOOLEAN NOT NULL DEFAULT true,
    "showTeamPhotos"  BOOLEAN NOT NULL DEFAULT false,
    "customDomain"    TEXT,
    "enableLinkedInShare" BOOLEAN NOT NULL DEFAULT true,
    "enableTwitterShare"  BOOLEAN NOT NULL DEFAULT true,
    "enableFacebookShare" BOOLEAN NOT NULL DEFAULT false,
    "enableEmailShare"    BOOLEAN NOT NULL DEFAULT true,
    "isPublished"     BOOLEAN NOT NULL DEFAULT false,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Company_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Company_slug_key" UNIQUE ("slug"),
    CONSTRAINT "Company_customDomain_key" UNIQUE ("customDomain")
);

CREATE TABLE IF NOT EXISTS "CompanyBenefit" (
    "id"          TEXT NOT NULL,
    "companyId"   TEXT NOT NULL,
    "icon"        TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sortOrder"   INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CompanyBenefit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TeamMember" (
    "id"        TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "role"      TEXT NOT NULL,
    "photoUrl"  TEXT,
    "bio"       TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CompanySocialLink" (
    "id"        TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "platform"  TEXT NOT NULL,
    "url"       TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CompanySocialLink_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- 2. CANDIDATE PORTAL
-- ============================================================

CREATE TABLE IF NOT EXISTS "CandidatePortalUser" (
    "id"                  TEXT NOT NULL,
    "email"               TEXT NOT NULL,
    "password"            TEXT NOT NULL,
    "name"                TEXT NOT NULL,
    "phone"               TEXT,
    "isVerified"          BOOLEAN NOT NULL DEFAULT false,
    "verificationToken"   TEXT,
    "resetToken"          TEXT,
    "resetTokenExpiry"    TIMESTAMP(3),
    "lastLoginAt"         TIMESTAMP(3),
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CandidatePortalUser_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CandidatePortalUser_email_key" UNIQUE ("email")
);

CREATE TABLE IF NOT EXISTS "CandidateActivityLog" (
    "id"          TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "type"        TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata"    JSONB,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CandidateActivityLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SavedJob" (
    "id"          TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "jobId"       TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedJob_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SavedJob_candidateId_jobId_key" UNIQUE ("candidateId", "jobId")
);

-- ============================================================
-- 3. CALENDAR INTEGRATION
-- ============================================================

CREATE TABLE IF NOT EXISTS "CalendarIntegration" (
    "id"           TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "provider"     "CalendarProvider" NOT NULL,
    "accessToken"  TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt"    TIMESTAMP(3),
    "calendarId"   TEXT,
    "isActive"     BOOLEAN NOT NULL DEFAULT true,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CalendarIntegration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CalendarSyncedEvent" (
    "id"              TEXT NOT NULL,
    "integrationId"   TEXT NOT NULL,
    "interviewId"     TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "syncStatus"      TEXT NOT NULL DEFAULT 'synced',
    "lastSyncedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CalendarSyncedEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InterviewAvailability" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "dayOfWeek"   INTEGER NOT NULL,
    "startTime"   TEXT NOT NULL,
    "endTime"     TEXT NOT NULL,
    "timezone"    TEXT NOT NULL DEFAULT 'UTC',
    "isRecurring" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "InterviewAvailability_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- 4. SAVED SEARCH
-- ============================================================

CREATE TABLE IF NOT EXISTS "SavedSearch" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "query"       TEXT,
    "filters"     JSONB,
    "isActive"    BOOLEAN NOT NULL DEFAULT true,
    "notifyNew"   BOOLEAN NOT NULL DEFAULT false,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SearchIndex" (
    "id"           TEXT NOT NULL,
    "candidateId"  TEXT NOT NULL,
    "searchVector" TEXT,
    "lastIndexed"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SearchIndex_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SearchIndex_candidateId_key" UNIQUE ("candidateId")
);

-- ============================================================
-- 5. CUSTOM APPLICATION FORMS
-- ============================================================

CREATE TABLE IF NOT EXISTS "JobApplicationForm" (
    "id"          TEXT NOT NULL,
    "jobId"       TEXT NOT NULL,
    "isEnabled"   BOOLEAN NOT NULL DEFAULT true,
    "title"       TEXT NOT NULL DEFAULT 'Application Form',
    "description" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "JobApplicationForm_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "JobApplicationForm_jobId_key" UNIQUE ("jobId")
);

CREATE TABLE IF NOT EXISTS "FormField" (
    "id"               TEXT NOT NULL,
    "formId"           TEXT NOT NULL,
    "label"            TEXT NOT NULL,
    "type"             "FormFieldType" NOT NULL,
    "isRequired"       BOOLEAN NOT NULL DEFAULT false,
    "placeholder"      TEXT,
    "helpText"         TEXT,
    "defaultValue"     TEXT,
    "sortOrder"        INTEGER NOT NULL DEFAULT 0,
    "isActive"         BOOLEAN NOT NULL DEFAULT true,
    "showWhenFieldId"  TEXT,
    "showWhenValue"    TEXT,
    CONSTRAINT "FormField_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FormFieldOption" (
    "id"        TEXT NOT NULL,
    "fieldId"   TEXT NOT NULL,
    "label"     TEXT NOT NULL,
    "value"     TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "FormFieldOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ApplicationResponse" (
    "id"            TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fieldId"       TEXT NOT NULL,
    "value"         TEXT,
    "fileUrl"       TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApplicationResponse_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- 6. CHROME EXTENSION / LINKEDIN IMPORT
-- ============================================================

CREATE TABLE IF NOT EXISTS "LinkedInImport" (
    "id"            TEXT NOT NULL,
    "linkedInUrl"   TEXT NOT NULL,
    "linkedInId"    TEXT,
    "rawData"       JSONB,
    "parsedData"    JSONB,
    "status"        TEXT NOT NULL DEFAULT 'pending',
    "errorMessage"  TEXT,
    "candidateId"   TEXT,
    "importedById"  TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt"   TIMESTAMP(3),
    CONSTRAINT "LinkedInImport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ChromeExtensionToken" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "token"       TEXT NOT NULL,
    "expiresAt"   TIMESTAMP(3) NOT NULL,
    "isActive"    BOOLEAN NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChromeExtensionToken_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ChromeExtensionToken_token_key" UNIQUE ("token")
);

-- ============================================================
-- 7. JOB BOARD CREDENTIALS
-- ============================================================

CREATE TABLE IF NOT EXISTS "JobBoardCredential" (
    "id"             TEXT NOT NULL,
    "board"          "JobBoard" NOT NULL,
    "accountName"    TEXT,
    "apiKey"         TEXT,
    "apiSecret"      TEXT,
    "accessToken"    TEXT,
    "refreshToken"   TEXT,
    "expiresAt"      TIMESTAMP(3),
    "isActive"       BOOLEAN NOT NULL DEFAULT true,
    "organizationId" TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "JobBoardCredential_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- 8. SCORECARDS
-- ============================================================

CREATE TABLE IF NOT EXISTS "ScorecardTemplate" (
    "id"             TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "description"    TEXT,
    "isDefault"      BOOLEAN NOT NULL DEFAULT false,
    "isActive"       BOOLEAN NOT NULL DEFAULT true,
    "organizationId" TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ScorecardTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ScorecardCriteria" (
    "id"               TEXT NOT NULL,
    "templateId"       TEXT NOT NULL,
    "name"             TEXT NOT NULL,
    "description"      TEXT,
    "maxScore"         INTEGER NOT NULL DEFAULT 5,
    "weight"           INTEGER NOT NULL DEFAULT 1,
    "isRequired"       BOOLEAN NOT NULL DEFAULT true,
    "sortOrder"        INTEGER NOT NULL DEFAULT 0,
    "evaluationGuide"  TEXT,
    "greenFlags"       TEXT,
    "redFlags"         TEXT,
    CONSTRAINT "ScorecardCriteria_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- 9. EMAIL SEQUENCES
-- ============================================================

CREATE TABLE IF NOT EXISTS "EmailSequence" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "trigger"     "EmailTrigger" NOT NULL,
    "isActive"    BOOLEAN NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmailSequence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EmailSequenceStep" (
    "id"          TEXT NOT NULL,
    "sequenceId"  TEXT NOT NULL,
    "templateId"  TEXT,
    "stepNumber"  INTEGER NOT NULL,
    "delayHours"  INTEGER NOT NULL DEFAULT 0,
    "subject"     TEXT,
    "body"        TEXT,
    "condition"   TEXT,
    CONSTRAINT "EmailSequenceStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EmailSequenceEnrollment" (
    "id"              TEXT NOT NULL,
    "sequenceId"      TEXT NOT NULL,
    "candidateId"     TEXT NOT NULL,
    "applicationId"   TEXT,
    "status"          TEXT NOT NULL DEFAULT 'active',
    "startedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt"     TIMESTAMP(3),
    "cancelledAt"     TIMESTAMP(3),
    "cancelReason"    TEXT,
    CONSTRAINT "EmailSequenceEnrollment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ScheduledEmail" (
    "id"           TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "stepId"       TEXT NOT NULL,
    "scheduledAt"  TIMESTAMP(3) NOT NULL,
    "sentAt"       TIMESTAMP(3),
    "status"       TEXT NOT NULL DEFAULT 'scheduled',
    "errorMessage" TEXT,
    CONSTRAINT "ScheduledEmail_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- 10. PIPELINE ANALYTICS
-- ============================================================

CREATE TABLE IF NOT EXISTS "PipelineMetric" (
    "id"             TEXT NOT NULL,
    "jobId"          TEXT,
    "date"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stage"          TEXT NOT NULL,
    "count"          INTEGER NOT NULL DEFAULT 0,
    "avgDaysInStage" INTEGER,
    "conversionRate" DECIMAL(5,2),
    "dropOffRate"    DECIMAL(5,2),
    CONSTRAINT "PipelineMetric_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TimeToHireMetric" (
    "id"              TEXT NOT NULL,
    "jobId"           TEXT,
    "candidateId"     TEXT,
    "applicationId"   TEXT,
    "daysToScreen"    INTEGER,
    "daysToInterview" INTEGER,
    "daysToOffer"     INTEGER,
    "daysToHire"      INTEGER,
    "timeToOffer"     INTEGER,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TimeToHireMetric_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SourceQualityMetric" (
    "id"            TEXT NOT NULL,
    "source"        TEXT NOT NULL,
    "date"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applications"  INTEGER NOT NULL DEFAULT 0,
    "interviews"    INTEGER NOT NULL DEFAULT 0,
    "offers"        INTEGER NOT NULL DEFAULT 0,
    "hires"         INTEGER NOT NULL DEFAULT 0,
    "avgTimeToHire" INTEGER,
    "costPerHire"   DECIMAL(10,2),
    CONSTRAINT "SourceQualityMetric_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AnalyticsDashboard" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "widgets"     JSONB,
    "isDefault"   BOOLEAN NOT NULL DEFAULT false,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AnalyticsDashboard_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- 11. ASSESSMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS "AssessmentTemplate" (
    "id"             TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "description"    TEXT,
    "category"       TEXT NOT NULL DEFAULT 'technical',
    "type"           "AssessmentType" NOT NULL,
    "duration"       INTEGER,
    "difficulty"     TEXT NOT NULL DEFAULT 'intermediate',
    "isActive"       BOOLEAN NOT NULL DEFAULT true,
    "passingScore"   INTEGER NOT NULL DEFAULT 70,
    "organizationId" TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AssessmentTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AssessmentQuestion" (
    "id"            TEXT NOT NULL,
    "templateId"    TEXT NOT NULL,
    "type"          TEXT NOT NULL DEFAULT 'multiple_choice',
    "question"      TEXT NOT NULL,
    "description"   TEXT,
    "codeSnippet"   TEXT,
    "options"       JSONB,
    "correctAnswer" TEXT,
    "points"        INTEGER NOT NULL DEFAULT 1,
    "sortOrder"     INTEGER NOT NULL DEFAULT 0,
    "testCases"     JSONB,
    "language"      TEXT,
    CONSTRAINT "AssessmentQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AssessmentAssignment" (
    "id"            TEXT NOT NULL,
    "templateId"    TEXT NOT NULL,
    "candidateId"   TEXT NOT NULL,
    "applicationId" TEXT,
    "assignedById"  TEXT NOT NULL,
    "status"        TEXT NOT NULL DEFAULT 'pending',
    "startedAt"     TIMESTAMP(3),
    "submittedAt"   TIMESTAMP(3),
    "expiresAt"     TIMESTAMP(3),
    "score"         INTEGER,
    "maxScore"      INTEGER,
    "percentage"    DECIMAL(5,2),
    "passed"        BOOLEAN,
    "feedback"      TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AssessmentAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AssessmentResponse" (
    "id"           TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "questionId"   TEXT NOT NULL,
    "answer"       TEXT,
    "codeSubmission" TEXT,
    "isCorrect"    BOOLEAN,
    "pointsEarned" INTEGER NOT NULL DEFAULT 0,
    "timeSpent"    INTEGER,
    "submittedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssessmentResponse_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- 12. E-SIGNATURE
-- ============================================================

CREATE TABLE IF NOT EXISTS "ESignatureProvider" (
    "id"             TEXT NOT NULL,
    "provider"       "ESignatureProviderType" NOT NULL,
    "isActive"       BOOLEAN NOT NULL DEFAULT true,
    "apiKey"         TEXT,
    "apiSecret"      TEXT,
    "webhookSecret"  TEXT,
    "settings"       JSONB,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ESignatureProvider_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ESignatureRequest" (
    "id"                  TEXT NOT NULL,
    "offerLetterId"       TEXT,
    "candidateId"         TEXT,
    "provider"            "ESignatureProviderType" NOT NULL,
    "externalId"          TEXT,
    "status"              TEXT NOT NULL DEFAULT 'draft',
    "signUrl"             TEXT,
    "signedDocumentUrl"   TEXT,
    "documentUrl"         TEXT,
    "signerName"          TEXT,
    "signerEmail"         TEXT,
    "signedAt"            TIMESTAMP(3),
    "ipAddress"           TEXT,
    "auditTrail"          JSONB,
    "metadata"            JSONB,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,
    "sentAt"              TIMESTAMP(3),
    "deliveredAt"         TIMESTAMP(3),
    "completedAt"         TIMESTAMP(3),
    "declinedAt"          TIMESTAMP(3),
    "voidedAt"            TIMESTAMP(3),
    "deletedAt"           TIMESTAMP(3),
    "expiresAt"           TIMESTAMP(3),
    "declineReason"       TEXT,
    "voidReason"          TEXT,
    "certificateUrl"      TEXT,
    CONSTRAINT "ESignatureRequest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ESignatureRequest_offerLetterId_key" UNIQUE ("offerLetterId")
);

CREATE TABLE IF NOT EXISTS "OfferLetterTemplate" (
    "id"             TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "description"    TEXT,
    "category"       TEXT NOT NULL DEFAULT 'full_time',
    "content"        TEXT NOT NULL,
    "variables"      JSONB NOT NULL,
    "isDefault"      BOOLEAN NOT NULL DEFAULT false,
    "isActive"       BOOLEAN NOT NULL DEFAULT true,
    "organizationId" TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OfferLetterTemplate_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- 13. REFERRAL PROGRAM
-- ============================================================

CREATE TABLE IF NOT EXISTS "ReferralProgram" (
    "id"                   TEXT NOT NULL,
    "name"                 TEXT NOT NULL,
    "description"          TEXT,
    "isActive"             BOOLEAN NOT NULL DEFAULT true,
    "organizationId"       TEXT,
    "rewardType"           TEXT NOT NULL DEFAULT 'cash',
    "rewardAmount"         DECIMAL(10,2) NOT NULL,
    "rewardCurrency"       TEXT NOT NULL DEFAULT 'USD',
    "rewardTiming"         TEXT NOT NULL DEFAULT 'hire',
    "minDaysEmployed"      INTEGER NOT NULL DEFAULT 90,
    "maxReferralsPerMonth" INTEGER,
    "eligibleJobIds"       JSONB NOT NULL,
    "excludedJobIds"       JSONB NOT NULL,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReferralProgram_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Referral" (
    "id"                    TEXT NOT NULL,
    "programId"             TEXT NOT NULL,
    "referrerId"            TEXT NOT NULL,
    "candidateName"         TEXT NOT NULL,
    "candidateEmail"        TEXT NOT NULL,
    "candidatePhone"        TEXT,
    "relationship"          TEXT,
    "notes"                 TEXT,
    "status"                TEXT NOT NULL DEFAULT 'submitted',
    "linkedCandidateId"     TEXT,
    "linkedApplicationId"   TEXT,
    "rewardStatus"          TEXT NOT NULL DEFAULT 'pending',
    "rewardPaidAt"          TIMESTAMP(3),
    "rewardAmount"          DECIMAL(10,2),
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- 14. BACKGROUND CHECK
-- ============================================================

CREATE TABLE IF NOT EXISTS "BackgroundCheckProvider" (
    "id"             TEXT NOT NULL,
    "provider"       "BgCheckProvider" NOT NULL,
    "isActive"       BOOLEAN NOT NULL DEFAULT true,
    "apiKey"         TEXT,
    "apiSecret"      TEXT,
    "webhookSecret"  TEXT,
    "settings"       JSONB,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BackgroundCheckProvider_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BackgroundCheck" (
    "id"                     TEXT NOT NULL,
    "provider"               "BgCheckProvider" NOT NULL,
    "candidateId"            TEXT NOT NULL,
    "applicationId"          TEXT,
    "requestedById"          TEXT,
    "checkTypes"             JSONB NOT NULL,
    "packageType"            TEXT,
    "externalId"             TEXT,
    "providerCandidateId"    TEXT,
    "providerInvitationId"   TEXT,
    "invitationUrl"          TEXT,
    "status"                 TEXT NOT NULL DEFAULT 'pending',
    "resultSummary"          TEXT,
    "completedAt"            TIMESTAMP(3),
    "reportUrl"              TEXT,
    "rawResults"             JSONB,
    "consentObtained"        BOOLEAN NOT NULL DEFAULT false,
    "consentDate"            TIMESTAMP(3),
    "adverseActionRequired"  BOOLEAN NOT NULL DEFAULT false,
    "adverseActionSentAt"    TIMESTAMP(3),
    "notes"                  TEXT,
    "expiresAt"              TIMESTAMP(3),
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"              TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BackgroundCheck_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- 15. API KEYS & WEBHOOKS
-- ============================================================

CREATE TABLE IF NOT EXISTS "ApiKey" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "key"         TEXT NOT NULL,
    "keyHash"     TEXT,
    "permissions" JSONB NOT NULL,
    "lastUsedAt"  TIMESTAMP(3),
    "expiresAt"   TIMESTAMP(3),
    "isActive"    BOOLEAN NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ApiKey_key_key" UNIQUE ("key")
);

CREATE TABLE IF NOT EXISTS "Webhook" (
    "id"             TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "url"            TEXT NOT NULL,
    "secret"         TEXT NOT NULL,
    "events"         JSONB NOT NULL,
    "isActive"       BOOLEAN NOT NULL DEFAULT true,
    "headers"        JSONB,
    "retryCount"     INTEGER NOT NULL DEFAULT 3,
    "timeout"        INTEGER NOT NULL DEFAULT 30,
    "organizationId" TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WebhookEvent" (
    "id"            TEXT NOT NULL,
    "webhookId"     TEXT NOT NULL,
    "eventType"     TEXT NOT NULL,
    "payload"       JSONB NOT NULL,
    "status"        TEXT NOT NULL DEFAULT 'pending',
    "responseStatus" INTEGER,
    "responseBody"  TEXT,
    "errorMessage"  TEXT,
    "attemptCount"  INTEGER NOT NULL DEFAULT 0,
    "deliveredAt"   TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedById" TEXT,
    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WebhookSubscription" (
    "id"              TEXT NOT NULL,
    "url"             TEXT NOT NULL,
    "events"          JSONB NOT NULL,
    "secret"          TEXT,
    "name"            TEXT,
    "description"     TEXT,
    "isActive"        BOOLEAN NOT NULL DEFAULT true,
    "organizationId"  TEXT,
    "lastTriggeredAt" TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WebhookSubscription_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- 16. SUBSCRIPTION BILLING
-- ============================================================

CREATE TABLE IF NOT EXISTS "Subscription" (
    "id"                 TEXT NOT NULL,
    "organizationId"     TEXT NOT NULL,
    "stripeCustomerId"   TEXT,
    "stripeSubId"        TEXT,
    "plan"               "Plan" NOT NULL DEFAULT 'FREE',
    "status"             "SubStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodEnd"   TIMESTAMP(3),
    "cancelAtPeriodEnd"  BOOLEAN NOT NULL DEFAULT false,
    "seats"              INTEGER NOT NULL DEFAULT 3,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Subscription_organizationId_key" UNIQUE ("organizationId"),
    CONSTRAINT "Subscription_stripeCustomerId_key" UNIQUE ("stripeCustomerId"),
    CONSTRAINT "Subscription_stripeSubId_key" UNIQUE ("stripeSubId")
);

CREATE TABLE IF NOT EXISTS "OrgApiKeyConfig" (
    "id"             TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider"       TEXT NOT NULL,
    "encryptedKey"   TEXT NOT NULL,
    "isActive"       BOOLEAN NOT NULL DEFAULT true,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrgApiKeyConfig_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OrgApiKeyConfig_organizationId_provider_key" UNIQUE ("organizationId", "provider")
);

-- ============================================================
-- 17. USER SETTINGS & INTEGRATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS "UserSettings" (
    "id"                    TEXT NOT NULL,
    "userId"                TEXT NOT NULL,
    "emailNotifications"    BOOLEAN NOT NULL DEFAULT true,
    "pushNotifications"     BOOLEAN NOT NULL DEFAULT true,
    "digestEmail"           TEXT NOT NULL DEFAULT 'daily',
    "defaultCalendarView"   TEXT NOT NULL DEFAULT 'week',
    "workingHoursStart"     TEXT NOT NULL DEFAULT '09:00',
    "workingHoursEnd"       TEXT NOT NULL DEFAULT '17:00',
    "timezone"              TEXT NOT NULL DEFAULT 'UTC',
    "theme"                 TEXT NOT NULL DEFAULT 'system',
    "language"              TEXT NOT NULL DEFAULT 'en',
    "dateFormat"            TEXT NOT NULL DEFAULT 'MM/DD/YYYY',
    "timeFormat"            TEXT NOT NULL DEFAULT '12h',
    "showOnlineStatus"      BOOLEAN NOT NULL DEFAULT true,
    "readReceipts"          BOOLEAN NOT NULL DEFAULT true,
    "updatedAt"             TIMESTAMP(3) NOT NULL,
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UserSettings_userId_key" UNIQUE ("userId")
);

CREATE TABLE IF NOT EXISTS "IntegrationAuth" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "provider"  TEXT NOT NULL,
    "state"     TEXT NOT NULL,
    "code"      TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntegrationAuth_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "IntegrationAuth_state_key" UNIQUE ("state")
);

CREATE TABLE IF NOT EXISTS "Integration" (
    "id"           TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "provider"     TEXT NOT NULL,
    "accessToken"  TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt"    TIMESTAMP(3),
    "accountId"    TEXT,
    "baseUrl"      TEXT,
    "email"        TEXT,
    "name"         TEXT,
    "isActive"     BOOLEAN NOT NULL DEFAULT true,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- INDEXES on new tables (performance)
-- ============================================================

CREATE INDEX IF NOT EXISTS "CompanyBenefit_companyId_idx"     ON "CompanyBenefit"("companyId");
CREATE INDEX IF NOT EXISTS "TeamMember_companyId_idx"          ON "TeamMember"("companyId");
CREATE INDEX IF NOT EXISTS "CompanySocialLink_companyId_idx"  ON "CompanySocialLink"("companyId");

CREATE INDEX IF NOT EXISTS "CandidateActivityLog_candidateId_idx" ON "CandidateActivityLog"("candidateId");
CREATE INDEX IF NOT EXISTS "SavedJob_candidateId_idx"         ON "SavedJob"("candidateId");
CREATE INDEX IF NOT EXISTS "SavedJob_jobId_idx"               ON "SavedJob"("jobId");

CREATE INDEX IF NOT EXISTS "CalendarIntegration_userId_idx"   ON "CalendarIntegration"("userId");
CREATE INDEX IF NOT EXISTS "CalendarSyncedEvent_integrationId_idx" ON "CalendarSyncedEvent"("integrationId");
CREATE INDEX IF NOT EXISTS "CalendarSyncedEvent_interviewId_idx" ON "CalendarSyncedEvent"("interviewId");
CREATE INDEX IF NOT EXISTS "InterviewAvailability_userId_idx" ON "InterviewAvailability"("userId");

CREATE INDEX IF NOT EXISTS "SavedSearch_userId_idx"           ON "SavedSearch"("userId");
CREATE INDEX IF NOT EXISTS "SearchIndex_candidateId_idx"      ON "SearchIndex"("candidateId");

CREATE INDEX IF NOT EXISTS "FormField_formId_idx"             ON "FormField"("formId");
CREATE INDEX IF NOT EXISTS "FormFieldOption_fieldId_idx"      ON "FormFieldOption"("fieldId");
CREATE INDEX IF NOT EXISTS "ApplicationResponse_applicationId_idx" ON "ApplicationResponse"("applicationId");

CREATE INDEX IF NOT EXISTS "LinkedInImport_candidateId_idx"   ON "LinkedInImport"("candidateId");
CREATE INDEX IF NOT EXISTS "LinkedInImport_processedById_idx" ON "LinkedInImport"("processedById");
CREATE INDEX IF NOT EXISTS "ChromeExtensionToken_userId_idx"  ON "ChromeExtensionToken"("userId");

CREATE INDEX IF NOT EXISTS "ScorecardCriteria_templateId_idx" ON "ScorecardCriteria"("templateId");
CREATE INDEX IF NOT EXISTS "ScorecardTemplate_organizationId_idx" ON "ScorecardTemplate"("organizationId");

CREATE INDEX IF NOT EXISTS "EmailSequenceStep_sequenceId_idx" ON "EmailSequenceStep"("sequenceId");
CREATE INDEX IF NOT EXISTS "EmailSequenceEnrollment_sequenceId_idx" ON "EmailSequenceEnrollment"("sequenceId");
CREATE INDEX IF NOT EXISTS "EmailSequenceEnrollment_candidateId_idx" ON "EmailSequenceEnrollment"("candidateId");
CREATE INDEX IF NOT EXISTS "ScheduledEmail_enrollmentId_idx" ON "ScheduledEmail"("enrollmentId");

CREATE INDEX IF NOT EXISTS "AssessmentTemplate_organizationId_idx" ON "AssessmentTemplate"("organizationId");
CREATE INDEX IF NOT EXISTS "AssessmentQuestion_templateId_idx" ON "AssessmentQuestion"("templateId");
CREATE INDEX IF NOT EXISTS "AssessmentAssignment_templateId_idx" ON "AssessmentAssignment"("templateId");
CREATE INDEX IF NOT EXISTS "AssessmentAssignment_candidateId_idx" ON "AssessmentAssignment"("candidateId");
CREATE INDEX IF NOT EXISTS "AssessmentResponse_assignmentId_idx" ON "AssessmentResponse"("assignmentId");

CREATE INDEX IF NOT EXISTS "ESignatureRequest_candidateId_idx" ON "ESignatureRequest"("candidateId");
CREATE INDEX IF NOT EXISTS "ESignatureRequest_externalId_idx"  ON "ESignatureRequest"("externalId");
CREATE INDEX IF NOT EXISTS "OfferLetterTemplate_organizationId_idx" ON "OfferLetterTemplate"("organizationId");

CREATE INDEX IF NOT EXISTS "ReferralProgram_organizationId_idx" ON "ReferralProgram"("organizationId");
CREATE INDEX IF NOT EXISTS "Referral_programId_idx"            ON "Referral"("programId");
CREATE INDEX IF NOT EXISTS "Referral_referrerId_idx"           ON "Referral"("referrerId");

CREATE INDEX IF NOT EXISTS "BackgroundCheck_candidateId_idx"   ON "BackgroundCheck"("candidateId");
CREATE INDEX IF NOT EXISTS "BackgroundCheck_providerCandidateId_idx" ON "BackgroundCheck"("providerCandidateId");
CREATE INDEX IF NOT EXISTS "BackgroundCheck_providerInvitationId_idx" ON "BackgroundCheck"("providerInvitationId");

CREATE INDEX IF NOT EXISTS "ApiKey_userId_idx"                 ON "ApiKey"("userId");
CREATE INDEX IF NOT EXISTS "Webhook_organizationId_idx"        ON "Webhook"("organizationId");
CREATE INDEX IF NOT EXISTS "WebhookEvent_webhookId_idx"        ON "WebhookEvent"("webhookId");
CREATE INDEX IF NOT EXISTS "WebhookEvent_processedById_idx"     ON "WebhookEvent"("processedById");
CREATE INDEX IF NOT EXISTS "WebhookSubscription_organizationId_idx" ON "WebhookSubscription"("organizationId");
CREATE INDEX IF NOT EXISTS "WebhookSubscription_isActive_idx"  ON "WebhookSubscription"("isActive");

CREATE INDEX IF NOT EXISTS "OrgApiKeyConfig_organizationId_idx" ON "OrgApiKeyConfig"("organizationId");
CREATE INDEX IF NOT EXISTS "IntegrationAuth_userId_provider_idx" ON "IntegrationAuth"("userId", "provider");
CREATE INDEX IF NOT EXISTS "IntegrationAuth_state_idx"           ON "IntegrationAuth"("state");
CREATE INDEX IF NOT EXISTS "Integration_userId_idx"              ON "Integration"("userId");
CREATE INDEX IF NOT EXISTS "Integration_provider_idx"            ON "Integration"("provider");

-- ============================================================
-- FOREIGN KEYS (safe add with IF NOT EXISTS checks)
-- ============================================================

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CompanyBenefit_companyId_fkey') THEN ALTER TABLE "CompanyBenefit" ADD CONSTRAINT "CompanyBenefit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeamMember_companyId_fkey') THEN ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CompanySocialLink_companyId_fkey') THEN ALTER TABLE "CompanySocialLink" ADD CONSTRAINT "CompanySocialLink_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CandidateActivityLog_candidateId_fkey') THEN ALTER TABLE "CandidateActivityLog" ADD CONSTRAINT "CandidateActivityLog_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidatePortalUser"("id") ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SavedJob_candidateId_fkey') THEN ALTER TABLE "SavedJob" ADD CONSTRAINT "SavedJob_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidatePortalUser"("id") ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SavedJob_jobId_fkey') THEN ALTER TABLE "SavedJob" ADD CONSTRAINT "SavedJob_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarSyncedEvent_integrationId_fkey') THEN ALTER TABLE "CalendarSyncedEvent" ADD CONSTRAINT "CalendarSyncedEvent_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "CalendarIntegration"("id") ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarSyncedEvent_interviewId_fkey') THEN ALTER TABLE "CalendarSyncedEvent" ADD CONSTRAINT "CalendarSyncedEvent_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "InterviewEvent"("id") ON DELETE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SavedSearch_userId_fkey') THEN ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SearchIndex_candidateId_fkey') THEN ALTER TABLE "SearchIndex" ADD CONSTRAINT "SearchIndex_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'JobApplicationForm_jobId_fkey') THEN ALTER TABLE "JobApplicationForm" ADD CONSTRAINT "JobApplicationForm_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FormField_formId_fkey') THEN ALTER TABLE "FormField" ADD CONSTRAINT "FormField_formId_fkey" FOREIGN KEY ("formId") REFERENCES "JobApplicationForm"("id") ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FormFieldOption_fieldId_fkey') THEN ALTER TABLE "FormFieldOption" ADD CONSTRAINT "FormFieldOption_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "FormField"("id") ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ApplicationResponse_applicationId_fkey') THEN ALTER TABLE "ApplicationResponse" ADD CONSTRAINT "ApplicationResponse_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ScorecardCriteria_templateId_fkey') THEN ALTER TABLE "ScorecardCriteria" ADD CONSTRAINT "ScorecardCriteria_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ScorecardTemplate"("id") ON DELETE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmailSequenceStep_sequenceId_fkey') THEN ALTER TABLE "EmailSequenceStep" ADD CONSTRAINT "EmailSequenceStep_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "EmailSequence"("id") ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmailSequenceEnrollment_sequenceId_fkey') THEN ALTER TABLE "EmailSequenceEnrollment" ADD CONSTRAINT "EmailSequenceEnrollment_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "EmailSequence"("id") ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ScheduledEmail_enrollmentId_fkey') THEN ALTER TABLE "ScheduledEmail" ADD CONSTRAINT "ScheduledEmail_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "EmailSequenceEnrollment"("id") ON DELETE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AssessmentQuestion_templateId_fkey') THEN ALTER TABLE "AssessmentQuestion" ADD CONSTRAINT "AssessmentQuestion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AssessmentTemplate"("id") ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AssessmentAssignment_templateId_fkey') THEN ALTER TABLE "AssessmentAssignment" ADD CONSTRAINT "AssessmentAssignment_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AssessmentTemplate"("id"); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AssessmentAssignment_candidateId_fkey') THEN ALTER TABLE "AssessmentAssignment" ADD CONSTRAINT "AssessmentAssignment_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AssessmentResponse_assignmentId_fkey') THEN ALTER TABLE "AssessmentResponse" ADD CONSTRAINT "AssessmentResponse_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "AssessmentAssignment"("id") ON DELETE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ESignatureRequest_candidateId_fkey') THEN ALTER TABLE "ESignatureRequest" ADD CONSTRAINT "ESignatureRequest_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OfferLetterTemplate_org_fkey') THEN ALTER TABLE "OfferLetterTemplate" ADD CONSTRAINT "OfferLetterTemplate_org_fkey" FOREIGN KEY ("organizationId") REFERENCES "Company"("id") ON DELETE SET NULL; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Referral_programId_fkey') THEN ALTER TABLE "Referral" ADD CONSTRAINT "Referral_programId_fkey" FOREIGN KEY ("programId") REFERENCES "ReferralProgram"("id"); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Referral_referrerId_fkey') THEN ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id"); END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BackgroundCheck_candidateId_fkey') THEN ALTER TABLE "BackgroundCheck" ADD CONSTRAINT "BackgroundCheck_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ApiKey_userId_fkey') THEN ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WebhookEvent_webhookId_fkey') THEN ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "Webhook"("id") ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WebhookEvent_processedById_fkey') THEN ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "User"("id") ON DELETE SET NULL; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Subscription_organizationId_fkey') THEN ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Company"("id") ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrgApiKeyConfig_organizationId_fkey') THEN ALTER TABLE "OrgApiKeyConfig" ADD CONSTRAINT "OrgApiKeyConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Company"("id") ON DELETE CASCADE; END IF; END $$;

-- Deferred from add_multi_tenancy (Company is created in this migration on fresh installs)
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_organizationId_fkey') THEN ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Candidate_organizationId_fkey') THEN ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;
