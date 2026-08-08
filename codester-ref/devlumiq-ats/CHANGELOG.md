# Changelog

Product updates for DevLumiq ATS — written for customers and hiring teams.
(Technical install notes for your IT team are at the bottom of each release.)

### Existing buyers — updates & data safety

New releases are **additive**. Your candidates, jobs, and applications stay in PostgreSQL when you update source code correctly.

1. **Back up the database first** (host snapshot or `pg_dump`).
2. Install / merge the new files; keep your `.env`.
3. Run `npm install`, then schema sync (`upgrade-v1-to-v2.js` for v1→v2, or `prisma generate` + `db push` + `migrate deploy`).
4. **Never** run `npm run seed` or `db:reset` on a live database.

The upgrade helper **never deletes data**. If data is already deleted, recovery is via **your Postgres backup** — the app has no built-in full undelete. See **Documentation.md → §8b / §8c**.

---

## Marketing accuracy pass — July 21, 2026

Landing and docs were updated so public claims match what the product actually ships. **No product modules were removed** — marketing layout stayed; inaccurate copy was edited in place.

### Landing website
- Hero, CTA, pricing teasers, and FAQ copy aligned with a **self-hosted source-code** product (not SaaS trial language)
- Removed/replaced inflated claims: fake “14-day trial”, “500+ companies”, “Beta User” labels, and ROI percentages that were not measured (pricing SEO metadata and Arabic enterprise testimonial labels were also corrected in a follow-up pass)
- Integration status on the home page matches the product docs (e.g. Zapier/Checkr available with config; Slack/Outlook planned; Google Calendar local unless OAuth is set)
- Stack badges updated to **Next.js 15**
- Testimonials, blog teaser, comparison, and social-proof UI **kept**; only wording/labels edited

### Documentation
- `docs/API.md` — job board post endpoint described as live-when-credentials / otherwise draft (not “stub only”)
- Changelog / README / Documentation integration notes kept consistent with the Integration Status table

### Still honest / unchanged product facts
- DocuSign remains a **stub** (workflow ready; bring your own SDK)
- Slack and Outlook remain **not connected** (planned)
- Optional OpenAI tools still work with **rule-based fallbacks** when no API key is set

---

## What’s new in 2.2 — July 2026

**If you already use DevLumiq:** this is an add-on update. Your current data and workflows stay the same. New tools only appear when you turn them on or connect an optional service.

### Assessments candidates can take themselves
Send a private link by email — candidates don’t need a login. They read the instructions, start a timer, answer questions, and submit. Answers save automatically as they go.

Supports multiple choice, coding tests, written answers, and personality-style questions.

You get automatic scoring where possible, a list of answers that need a human review, email reminders before a test expires, and scores on the candidate profile and pipeline board. You can also filter people by assessment score.

**Optional anti-cheat:** turn proctoring on per test. Watch for tab switching and copy/paste, require fullscreen, take webcam snapshots (with permission), and open a simple integrity report when something looks off.

**Coding tests:** off by default until you connect Judge0 (recommended sandbox) under Settings. For local/dev only, you can opt into an in-process JavaScript runner with `ASSESSMENT_CODE_RUNNER=true` — do not use that as a production substitute for Judge0.

### Text & WhatsApp
Talk to candidates by email, SMS, or WhatsApp in one inbox. Their replies land in the same thread.

Use short text versions of your email templates, send bulk reminders, and auto-text interview reminders (only if the candidate opted in). Consent tools are built in.

Email works as before. SMS and WhatsApp need your Twilio / WhatsApp Business account connected in Settings.

### Talent pools (keep strong “almost hires”)
When you pass on someone who still looks great for later, add them to a talent pool — with their permission.

When a matching job opens, DevLumiq can suggest people from your pools. Run a warm follow-up email or SMS campaign, and filter by skills, location, or last contact date.

### Clearer interview notes
Paste a transcript (or receive one from a meeting bot) and get an AI draft of feedback, a suggested score, and scorecard hints. **You always review and confirm** — hiring decisions stay with your team.

**Optional:** connect Recall.ai and send a notetaker bot into Zoom, Google Meet, or Teams. After the call, the transcript shows up in DevLumiq. You must capture recording consent first.

### Fairer hiring tools
- **Blind review** — hide names and similar details while screening (admins can still see full profiles).
- **Diversity overview** — aggregate funnel by stage using only voluntary self-ID answers.
- **Optional alerts** if an interview shortlist looks thin on disclosed diversity (group stats only — never tied to one person’s scorecard).
- **Compliance export** for aggregate US-style EEOC/OFCCP reporting.

Self-ID on applications is always optional and stored separately from hiring decisions.

### Careers chatbot
A chat helper on your careers site answers FAQs, helps people find the right job, and can start an application. For tricky questions, it can capture an email for a human reply. Edit your own FAQs in Settings.

### Skills matching
Import a large shared skills list (850+ common hiring skills) with one click. Tag candidates and jobs, see a match percentage, and search by skill.

### Import from a spreadsheet
Upload a CSV, map columns, preview, then import. Duplicate emails are skipped. Failed rows download as an error list.

### Work from your phone
Install DevLumiq like an app on your phone. Get optional alerts for new applications and interview reminders. On the pipeline board, swipe a card to move someone to the next stage.

### Optional connections (not required)
Without these, everything else still works.

| What you want | What to connect |
|---------------|-----------------|
| SMS | Twilio |
| WhatsApp | WhatsApp Business |
| Meeting notetaker bot | Recall.ai |
| Multi-language coding sandboxes | Judge0 |
| Live official O\*NET skills sync | O\*NET Web Services (optional — a full skills list is already included) |

Add keys in **Settings → API keys**, or ask IT to configure them on your server.

#### For IT (2.2)
After upgrade, run database migrations (`npx prisma migrate deploy`). Optional keys are listed in `.env.example`. New integrations stay off until configured.

**Assessment code runner:** disabled by default. Set `JUDGE0_API_URL` (+ key) for sandboxed multi-language grading. The local `node:vm` fallback only runs when `ASSESSMENT_CODE_RUNNER=true` — it is **not** a security boundary and must not be enabled on internet-facing production hosts. The `timeout` option only bounds synchronous execution; infinite Promise microtask recursion can still hang the Node process.

---

## 2.1 — earlier feature pack

First release of assessments, messaging, talent pools, chatbot, skills, CSV import, DEI tools, and mobile/PWA. **Version 2.2** finishes these for everyday recruiting and adds the optional connections above.

---

## v1 vs v2 — What's New

### v1 (Original Product)

v1 included everything you need to run recruitment operations:

**Marketing Website**
- Homepage, Features, Pricing, About, Contact, FAQ, Careers portal
- 10 language support (EN, ES, AR, FR, DE, PT, HI, ZH, JA, RU)
- SEO-ready with sitemap, robots.txt, Open Graph

**Dashboard**
- Live stats, candidate CRUD, Kanban pipeline, Jobs management
- Calendar, Analytics & Reports, Inbox & Messages
- Settings, Background Checks, Referrals, Assessments, E-Signature pages

**Premium Tools**
- Smart Search, Email Studio, Interview Scoring, Offer Letters
- Team Comments with @mentions, Resume Parser
- Job Board stubs, WhatsApp Messaging

**Tech Stack**
- Next.js 15, React 19, TypeScript, Prisma ORM, PostgreSQL
- JWT auth with bcrypt, 5 user roles
- 100+ API routes, Framer Motion, Tailwind CSS

---

### v2 (Upgraded Product)

v2 adds stronger security controls, multi-tenancy, and optional AI on top of everything in v1.

**Security Hardening**
- CSRF protection with origin validation
- Redis-backed rate limiting (falls back to memory)
- API key hashing for secure storage
- Session token versioning with `UserSession` table for instant invalidation
- Email verification, password reset, and invite token flows
- Security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options

**RBAC (Role-Based Access Control)**
- 5 roles: ADMIN, RECRUITER, HIRING_MANAGER, INTERVIEWER, VIEWER
- 30+ granular permissions enforced on 44+ API routes
- Permission guards via `withPermission()` middleware

**Multi-Tenancy**
- `organizationId` added to User, Candidate, Job, and 8+ models
- Organization-scoped queries throughout the API
- Data isolation between companies

**AI Integration (Optional — works with AND without API key)**
- AI Resume Parsing (fallback: regex extraction)
- AI Candidate Ranking (fallback: skill-match scoring)
- AI Candidate Screening (fallback: rule-based verdict)
- AI Job Description Generator (fallback: structured template)
- AI Email Drafting (fallback: pre-built templates)

**Integrations**
- Checkr background checks with HMAC webhook verification
- Zapier webhook triggers
- Chrome Extension token auth for LinkedIn import
- WhatsApp Business API messaging
- DocuSign stub workflow (SDK integration required for live signing)
- Job board posting to LinkedIn / Indeed / Glassdoor when org credentials are configured; otherwise draft records are stored

**Infrastructure**
- S3 / Cloudflare R2 file storage with local fallback
- GitHub Actions CI/CD pipeline
- Complete API reference (`docs/API.md`)

**Marketing Fixes**
- Removed false AI claims ("AI screening" → "Smart screening")
- Removed false `connected: true` on unimplemented integrations
- Removed hardcoded sample data from all API routes

---

## Upgrade from v1 to v2

### Your Data Is Safe

**The upgrade script NEVER deletes data.** It only creates missing tables and backfills new fields. All your existing candidates, jobs, applications, users, and settings are preserved.

### One-Command Upgrade

```bash
# 1. Back up your database first (always)
# 2. Run the upgrade helper
node scripts/upgrade-v1-to-v2.js
```

This script does everything automatically:
1. Generates the Prisma client with new v2 models
2. Runs `db push` to safely create all missing tables and columns
3. Runs `migrate deploy` to record migration history
4. Creates a default Company
5. Backfills `organizationId` on all existing Users, Candidates, and Jobs
6. Creates a FREE subscription for your company
7. Marks all existing users as email-verified

### After Upgrade

- **All your data is still there.** Candidates, jobs, applications, messages — everything.
- **Users must reset passwords.** Existing v1 users need to click "Forgot Password" once to set a new password before logging in.
- **Do NOT run `npm run seed`.** The seed script detects real data and refuses to run to protect your data.
- Log in as admin and review company settings at `/dashboard/settings`.

### Manual Upgrade (if you prefer)

1. Back up your database.
2. Run `npx prisma db push` to sync new tables and columns.
3. Run `npx prisma migrate deploy` to record migration history.
4. Create a Company in the database.
5. Assign `organizationId` to existing users, candidates, and jobs.
6. Create a FREE subscription for the company.
7. Do NOT run `npm run seed` — it will refuse because real data exists.

---

## [2.0.1] — 2026-05-20

### Migration & Upgrade Safety

**Comprehensive Migration**
- Added `prisma/migrations/20260520000000_v2_schema_complete` — creates ALL v2 tables with `IF NOT EXISTS`
- Covers 49 tables: Company, Subscription, CandidatePortalUser, ScorecardTemplate, AssessmentTemplate, Webhook, CalendarIntegration, EmailSequence, PipelineMetric, and 40+ more
- Every `CREATE TABLE`, `CREATE INDEX`, and `ALTER TABLE ADD FOREIGN KEY` uses `IF NOT EXISTS` guards
- Combined with `db push`, migrations now cover both fresh DBs and v1 upgrades safely

**Seed Script Guard**
- `prisma/seed.js` detects real data before any destructive operations
- Refuses to run if non-demo users exist OR candidate/job counts exceed demo thresholds
- Prevents accidental data loss for existing buyers

**Upgrade Helper Script**
- Added `scripts/upgrade-v1-to-v2.js` — one-command safe upgrade
- Runs `generate` → `db push` → `migrate deploy` → backfills all `organizationId` fields
- Auto-creates default Company + FREE subscription
- Marks all existing users as email-verified
- **Never deletes data**

---

## [2.0.0] — 2026-05-19

### Major Release — v1 to v2 Upgrade

See "v1 vs v2" and "Upgrade from v1 to v2" sections above for full details.

---

## [1.1.0] — 2026-05-14

### Audit & Hardening Release

**Security**
- Removed `unsafe-eval` from Content Security Policy
- Added origin-based CSRF protection utility (`src/lib/csrf.ts`)
- Redis-backed rate limiting with automatic in-memory fallback (`src/lib/rate-limit.ts`)

**Integrations**
- DocuSign clearly labeled as stub with integration instructions
- Job board posting labeled as stub (DB records only, no live board APIs)
- LinkedIn import labeled as passthrough mapper (no AI processing)
- Google Calendar labeled as local-only (no external sync)
- Slack and Outlook marked as "Coming Soon" on marketing pages

**Infrastructure**
- S3 / Cloudflare R2 file storage utility with local fallback (`src/lib/file-storage.ts`)
- GitHub Actions CI/CD pipeline (lint, type check, build, test)
- API reference documentation (`docs/API.md`)

**Marketing**
- Fixed testimonial "AI screening" → "smart screening"
- Fixed false `connected: true` on Slack, Outlook, and other unimplemented integrations

**Documentation**
- README: Added Integration Status table, security & file storage notes
- Documentation.md: Added AI Features, File Storage, Integrations, Security sections
- CREDITS.md: Added all missing dependency attributions
- API.md: Complete endpoint reference with permissions and error codes

**Testing**
- Added rate limiter unit tests
- Added CSRF protection unit tests
- Added file storage unit tests

---

## [1.0.0] — 2026-04-13

### Initial Release

**Marketing Website**
- Homepage with hero, feature bento grid, testimonials, pricing preview, and CTA sections
- Features page with categorized feature cards and comparison table
- Pricing page with three plans, FAQ, and annual/monthly toggle
- About page with company story, values, and team timeline
- Careers portal with job listings, search, filters, benefits section, and application form
- Contact page with form, topics dropdown, and sidebar links
- FAQ page with categorized questions and search
- Enterprise, Integrations, AI Automation, Customers, Security pages
- Privacy Policy and Terms of Service pages
- Announcement bar, cookie consent, mega-menu navigation, responsive mobile menu
- 10 locale support (EN, ES, AR, FR, DE, PT, HI, ZH, JA, RU)

**Dashboard**
- Overview with live stats (candidates, jobs, pipeline), recent activity, upcoming interviews
- Candidates — full CRUD, table with filters, pagination, export to PDF/Excel
- Kanban pipeline — drag-and-drop board, stage changes persist to database
- Jobs — create, edit, manage postings
- Calendar — FullCalendar integration, interview events from database
- Analytics — charts (pipeline funnel, source breakdown, hire rate)
- Reports — PDF export
- Inbox & Messages — threads and messages with API backend
- Settings — profile, notifications, branding preferences
- Background Checks, Referrals, Assessments, E-Signature pages

**Premium Tools**
- Smart Search — Advanced candidate search with 5+ filters
- Email Studio — templates with variable substitution and instant send
- Interview Scoring — 5-criteria star rating system
- Offer Letter Generator — one-click professional offer creation
- Team Collaboration — candidate comments with @mentions
- Resume Parser — Rule-based PDF/DOCX text extraction for skills, experience, education, and contact info
- Job Board Integrations — post to LinkedIn, Indeed, Glassdoor
- WhatsApp Messaging — candidate communication via WhatsApp

**Technical**
- Next.js 15 App Router, React 19, TypeScript
- Prisma ORM with PostgreSQL (default)
- JWT-based authentication with bcrypt, token versioning, and session invalidation
- REST API with 100+ route handlers across 37 endpoint directories
- Framer Motion animations throughout
- Fully responsive — mobile, tablet, desktop
- SEO: metadata, Open Graph, Twitter cards, sitemap.xml, robots.txt
- Accessibility: skip-to-main, semantic landmarks, 44px touch targets, reduced-motion support

