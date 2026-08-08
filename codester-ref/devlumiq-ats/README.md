# Devlumiq ATS — Full-Stack Applicant Tracking System

A modern, production-ready Applicant Tracking System (ATS) built with **Next.js 15**, **React 19**, **TypeScript**, and **Prisma ORM**. Designed for HR teams and recruitment agencies. Fully database-backed with PostgreSQL support, optimized for Vercel serverless deployment.

---

## Overview

Devlumiq ATS is a complete hiring platform that includes a public-facing marketing website, a full-featured recruitment dashboard, a careers portal, and a suite of premium tools — all in a single codebase.

---

## Core Features

| Feature | Description |
|---------|-------------|
| **Dashboard** | Live stats, pipeline counts, recent candidates — all from the database |
| **Candidates** | Full CRUD via API — list, filter, paginate, export to PDF/Excel |
| **Kanban Pipeline** | Drag-and-drop board; stage changes persist to the database in real time |
| **Jobs** | Create, edit, and manage job postings; data persisted |
| **Calendar** | FullCalendar integration; interview events stored locally in the database (external sync optional via OAuth) |
| **Analytics & Reports** | Visual charts with PDF export |
| **Inbox & Messages** | Full thread/message UI with API backend |
| **Authentication** | JWT session auth with bcrypt, email verification, and role-based access control (RBAC) |
| **Marketing Website** | Home, About, Features, Pricing, Contact, FAQ, Privacy, Terms, Careers |
| **i18n** | 10 locales: English, Spanish, Arabic, French, German, Portuguese, Hindi, Chinese, Japanese, Russian |

---

## Premium Features

All premium tools are integrated directly into the dashboard:

| Tool | Description |
|------|-------------|
| **Smart Search** | Advanced candidate search with filters for skills, experience, tags, source, and pipeline stage |
| **Email Studio** | Professional email templates with variable substitution (`{{candidateName}}`, `{{position}}`) and instant sending |
| **Interview Scoring** | Rate candidates on 5 criteria (technical, communication, problem-solving, cultural fit, experience) with 1–5 star ratings |
| **Offer Letters** | One-click professional offer letter generation with salary, benefits, and start date |
| **Team Collaboration** | Candidate comments with @mentions for team discussion |
| **Resume Parser** | AI-powered or rule-based PDF/DOCX text extraction for skills, experience, education, and contact info |
| **AI Candidate Ranking** | Score and rank candidates against job requirements — AI-powered or skill-matching fallback |
| **AI Candidate Screening** | Automated fit assessment with verdict, matching/missing skills, and recommendation |
| **AI Job Description Generator** | Generate complete, inclusive job descriptions from a title and department |
| **AI Email Drafting** | Draft professional outreach, rejection, offer, and follow-up emails |
| **Job Board Integrations** | Live posting to LinkedIn, Indeed, Glassdoor when org credentials are configured (AES-encrypted); drafts without credentials |
| **WhatsApp Messaging** | Send candidate communications via WhatsApp |

---

## AI Features (Optional)

All features work **without AI** using rule-based fallbacks. When you add an OpenAI API key, AI enhances these features automatically:

| Feature | Without API Key | With API Key |
|---------|----------------|---------------|
| **Resume Parsing** | Regex keyword extraction + confidence scoring | GPT-powered semantic extraction with richer field detection |
| **Candidate Ranking** | Simple skill-match scoring (0–100) | AI scores with reasoning, strengths, and gap analysis |
| **Candidate Screening** | Rule-based verdict from skill overlap | AI assessment with hiring recommendation |
| **Job Description** | Structured template output | AI-written inclusive, compelling JD |
| **Email Drafting** | Pre-built professional templates | AI-composed personalized emails |

### Setup

1. Get an API key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Add to your `.env`: `OPENAI_API_KEY="sk-..."`
3. That's it — AI features activate automatically

**Cost:** ~$0.15 per 1M tokens with `gpt-4o-mini`. Typical ATS usage costs $1–5/month.

**Model:** Default is `gpt-4o-mini` (cheapest, fastest). Override with `OPENAI_MODEL="gpt-4o"` for higher quality.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| UI | React 19, TypeScript, Tailwind CSS |
| Animations | Framer Motion |
| Icons | Lucide React |
| Database ORM | Prisma |
| Database | PostgreSQL (Neon / Supabase / Railway recommended) |
| Auth | Session cookie, bcrypt |
| Deployment | Vercel (optimized) |

---

## Prerequisites

- **Node.js** 18 or higher
- **npm** (bundled with Node.js) or **yarn**
- A PostgreSQL database (Neon, Supabase, or Railway provide free tiers)

---

## Existing buyers — updates & data safety

Updates are designed **not** to wipe hiring data. Always **back up PostgreSQL** before updating. Do **not** run `npm run seed` or `npm run db:reset` on a live database. Full checklist and recovery notes: **Documentation.md → §8b / §8c**.

If data was deleted: restore from your host’s database backup (`pg_dump` / Neon / Supabase / Railway / Vercel Postgres). The app does not include automatic full-database undelete.

---

## Upgrading from v1

If you already have real candidate, job, or application data from v1:

### One-Command Upgrade (Recommended)

> **Back up your database first.**

```bash
node scripts/upgrade-v1-to-v2.js
```

This script:
1. Generates the Prisma client with new v2 models
2. Runs `db push` to safely create all missing tables and columns
3. Runs `migrate deploy` to record migration history
4. Creates a default Company and backfills `organizationId` on all users, candidates, and jobs
5. Creates a FREE subscription for the company
6. Marks all existing users as email-verified

**This script NEVER deletes data.**

### Manual Upgrade

1. **Back up your database first.**
2. Run `npx prisma db push` to sync new tables and columns.
3. Run `npx prisma migrate deploy` to record migration history.
4. Create a Company in the database and assign `organizationId` to existing users, candidates, and jobs.
5. **DO NOT run `npm run seed`** — it will refuse to run if real data is detected. If you really want to wipe everything and start fresh, use `npm run db:reset`.
6. After upgrading, log in as an admin and review company settings.

---

## Quick Start — Local Development

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env

# 3. Create all schema tables (safe on fresh & existing databases)
npx prisma db push

# 4. Record migration history for future upgrades
npx prisma migrate deploy

# 5. Seed sample data (fresh installs only — refuses if real data is detected)
npm run seed

# 6. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with `demo@devlumiq.com` / `Demo@1234`.

---

## Deploy to Vercel (Production)

### Step 1 — Set up Vercel Postgres
1. Go to [vercel.com](https://vercel.com) → Your Project → Storage
2. Click **Create Database** → **Postgres**
3. Copy the connection string — Vercel auto-populates `DATABASE_URL` in your environment variables

### Step 2 — Deploy
```bash
vercel --prod
```
Or connect your GitHub repository in the Vercel dashboard and push to deploy.

The build automatically:
- Generates the Prisma client
- Runs `prisma migrate deploy` against `DATABASE_URL`
- Builds the Next.js application

### Step 3 — Seed Initial Data (one-time)

```bash
npx prisma db push
npx prisma migrate deploy
npm run seed
```

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run setup` | One-command setup: env + database + seed |
| `npm run seed` | Seed sample data (refuses if real data detected) |
| `node scripts/upgrade-v1-to-v2.js` | Safe v1 → v2 upgrade (creates tables, backfills data, never deletes) |
| `npm run db:reset` | Wipe the database and re-seed fresh |

---

## Database & API

**Database:** **80+ Prisma models** covering candidates, jobs, applications, assessments, talent pools, messaging, billing, DEI, and more — see `prisma/schema.prisma` for the full schema.

**Core API routes** (~146 handlers under `src/app/api/`):
- `/api/auth/*` — Authentication
- `/api/dashboard/summary` — Dashboard statistics
- `/api/candidates` — Candidate management
- `/api/jobs` — Job management
- `/api/applications` — Application pipeline
- `/api/calendar/events` — Interview scheduling
- `/api/messages/threads` — Inbox and messaging

**Premium API routes:**
- `/api/candidates/search` — Advanced search
- `/api/email-templates` — Email templates
- `/api/email/send` — Send emails
- `/api/interviews/[id]/scores` — Interview scoring
- `/api/offer-letters` — Offer letter generation
- `/api/candidates/[id]/comments` — Team comments
- `/api/candidates/[id]/resume/parse` — Resume parsing
- `/api/jobs/[id]/integrations` — Job board posting

**AI API routes (optional — work with or without OpenAI key):**
- `/api/resume-parse` — AI-enhanced or rule-based resume parsing
- `/api/ai/rank` — Candidate ranking against a job
- `/api/ai/screen` — Candidate screening with fit assessment
- `/api/ai/generate-jd` — Job description generation
- `/api/ai/draft-email` — Professional email drafting

---

## Customization

### Brand Colors
Edit `tailwind.config.ts` → `theme.extend.colors.brand` to match your brand palette.

### Logo
Replace `src/components/Logo.tsx` with your own SVG or image component.

### Site Name & SEO
Edit `src/app/layout.tsx` — update `metadata.title`, `description`, `openGraph`, and `metadataBase`.

### Translations
Edit `src/lib/translations.ts` to add, remove, or modify locale strings.

---

## Project Structure

```
prisma/
├── schema.prisma       # Database models
├── migrations/         # SQL migration history
└── seed.js             # Sample data seed script

src/
├── app/
│   ├── api/            # API route handlers
│   ├── (marketing)/    # Public marketing pages
│   ├── dashboard/      # Dashboard pages
│   ├── careers/        # Public careers portal
│   ├── login/          # Authentication pages
│   └── signup/
├── components/         # Reusable UI components
├── lib/                # Prisma client, translations, helpers
└── data/               # Static reference data
```

---

## Quality & Standards

- **Accessibility** — Skip-to-main link, semantic HTML landmarks, 44px minimum touch targets, reduced-motion support
- **SEO** — Metadata, Open Graph, Twitter cards, sitemap, robots.txt
- **Performance** — `font-display: swap`, responsive images, code splitting via App Router
- **Type Safety** — Strict TypeScript throughout the entire codebase
- **Full-stack** — Every major feature (candidates, jobs, kanban, analytics, reports, settings) reads from and writes to the database
- **Security** — JWT + httpOnly cookies, bcrypt password hashing, rate limiting (in-memory by default; optional Redis via `REDIS_URL` + `ioredis`), HMAC webhook verification (Checkr/Twilio fail-closed in production), API key hashing, CSP headers, origin-based CSRF protection, org-scoped nested API routes. Demo one-click login is **off in production** unless `ENABLE_DEMO_LOGIN=true`. Assessment coding runner is **off by default**; use Judge0 for production sandboxes (`ASSESSMENT_CODE_RUNNER=true` enables local `node:vm` for JS only — not a security boundary; sync timeout does not catch infinite microtask recursion).
- **File Storage** — Configurable: local (default), AWS S3, or Cloudflare R2

---

## Integration Status

| Integration | Status | Notes |
|-------------|--------|-------|
| **Email/SMTP** | ✅ Real | Nodemailer — configure SMTP in .env |
| **Twilio SMS** | ✅ Real | Outbound/inbound SMS when `TWILIO_*` vars are set |
| **Checkr** | ✅ Real | Background checks via Checkr API |
| **Zapier** | ✅ Real | Webhook-based integration |
| **Chrome Extension** | ✅ Real | LinkedIn one-click import — configure domain + token in Settings → Chrome Extension |
| **WhatsApp** | ✅ Real | Business API messaging |
| **AI (OpenAI)** | ✅ Real (optional) | Resume parsing, ranking, screening, JD gen, email drafting |
| **DocuSign** | 🔧 Stub | Workflow functional, SDK integration required |
| **Job Boards** | ✅ Live | Posts via LinkedIn / Indeed / Glassdoor APIs when credentials set; otherwise draft records |
| **SSO / SAML** | ✅ Opt-in | Enterprise / SSO add-on — Settings → Security; password login remains default |
| **White-Label Kit** | ✅ Add-on SKU | See `docs/white-label-kit.md` — colors/logo stay free; kit extras gated |
| **Candidate GDPR** | ✅ Real | Portal self-service export/erase at `/portal/privacy` |
| **Advanced Analytics** | ✅ Gated | Time-to-hire / sources / DEI funnel — PRO or Analytics Plus add-on |
| **Google Calendar** | 🔧 Local only | Events in DB, external sync requires OAuth setup |
| **Slack** | ❌ Not connected | Planned integration |
| **Outlook** | ❌ Not connected | Planned integration |

---

## Browser Support

Chrome, Firefox, Safari, and Edge (current versions). Mobile browsers fully supported.

---

## License

See the `LICENSE` file included in this project.
