# Devlumiq ATS — Documentation

This document will help you install, configure, and customize Devlumiq ATS. Follow the steps in order — no prior coding experience required.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Requirements](#2-requirements)
3. [Installation](#3-installation)
4. [First Run & Demo Login](#4-first-run--demo-login)
5. [Customization](#5-customization)
6. [Project Structure](#6-project-structure)
7. [Database & Production](#7-database--production)
8. [Upgrading from v1](#8-upgrading-from-v1)
8b. [Updating to a newer release (existing buyers)](#8b-updating-to-a-newer-release-existing-buyers)
8c. [Data backup & recovery](#8c-data-backup--recovery)
9. [AI Features](#9-ai-features)
10. [File Storage](#10-file-storage)
11. [Integrations](#11-integrations)
12. [Security](#12-security)
13. [Translations](#13-translations)
14. [Browser Support](#14-browser-support)
15. [Asset Credits & Licenses](#15-asset-credits--licenses)
16. [Troubleshooting](#16-troubleshooting)

---

## 1. Introduction

Devlumiq ATS is a **full-stack** Applicant Tracking System built with:

- **Next.js 15** (App Router)
- **React 19**
- **TypeScript**
- **Prisma** (database ORM)
- **Tailwind CSS**, **Framer Motion**, **Lucide Icons**

It includes a real PostgreSQL database, REST API routes, a full recruitment dashboard, candidates, jobs, Kanban pipeline, calendar, analytics, reports, and a public marketing website. Every screen is wired to the database — no mock-only pages.

---

## 2. Requirements

- **Node.js** 18 or higher — Download: [https://nodejs.org](https://nodejs.org)
- **npm** (bundled with Node.js) or **yarn**
- A code editor such as **VS Code** (recommended)

---

## 3. Installation

### Step 1: Extract the project

Unzip the downloaded archive to a folder, e.g. `devlumiq-ats`.

### Step 2: Open a terminal in the project folder

- **Windows**: Right-click the folder and select "Open in Terminal", or open Command Prompt / PowerShell and navigate to the folder.
- **Mac / Linux**: Open Terminal and `cd` into the project folder.

### Step 3: Copy the environment file

**Windows (Command Prompt):**

```bash
copy .env.example .env
```

**Windows (PowerShell) / Mac / Linux:**

```bash
cp .env.example .env
```

This creates a `.env` file with default settings. Set `DATABASE_URL` to your PostgreSQL connection string (Neon, Supabase, and Railway all offer free tiers).

### Step 4: Install dependencies

```bash
npm install
```

Wait until all packages are downloaded and installed.

### Step 5: Create the database tables

```bash
npx prisma db push
```

This creates all tables from the schema (safe on both fresh and existing databases).

### Step 6: Record migration history

```bash
npx prisma migrate deploy
```

This records all committed migrations so future upgrades run smoothly.

### Step 7: Seed sample data (recommended)

```bash
npm run seed
```

This creates sample user accounts (all roles), jobs, candidates, applications, and messages so you can explore the app immediately.

> **Note:** The seed script **refuses to run** if it detects real (non-demo) data. Use `npm run db:reset` only when you intentionally want to wipe and re-seed a dev database.

### Step 8: Start the development server

```bash
npm run dev
```

Open your browser and go to: **http://localhost:3000**

---

## 4. Logging In

- **Default accounts** (all passwords: `Demo@1234`):
  - `admin@devlumiq.com` → Admin
  - `recruiter@devlumiq.com` → Recruiter
  - `hiring@devlumiq.com` → Hiring Manager
  - `interviewer@devlumiq.com` → Interviewer
  - `viewer@devlumiq.com` → Viewer
  - `demo@devlumiq.com` → Recruiter
- New accounts require email verification and must be created via the registration page or invited by an admin.
- After signing in you will see the **Dashboard**. Use the sidebar to navigate to Candidates, Jobs, Kanban, Calendar, Analytics, Reports, Settings, and more.

---

## 5. Customization

### Brand Colors

Edit **`tailwind.config.ts`**. Find `theme.extend.colors` and update the `brand` palette:

```ts
brand: {
  50:  '#f0fdfa',
  100: '#ccfbf1',
  600: '#0d9488',  // primary buttons
  700: '#0f766e',
  800: '#115e59',
  900: '#134e4a',
}
```

Save the file; the development server will reload automatically.

### Logo

Replace **`src/components/Logo.tsx`** with your own SVG or image component. Keep the same default export so the header and sidebar continue to render it correctly.

### Site Name and SEO Metadata

Edit **`src/app/layout.tsx`** and update the `metadata` object:

- `title.default` and `description`
- `openGraph` and `twitter` fields
- `metadataBase` — set this to your live domain

### Favicon and Social Image

- **Favicon**: Replace **`public/logo.png`** with your icon (32x32 or 192x192 PNG recommended).
- **Open Graph image**: Replace **`public/og-image.svg`** with your own 1200x630 image for social sharing previews.

---

## 6. Project Structure

| Folder / File | Purpose |
|---------------|---------|
| `prisma/` | Database schema, migrations, and seed script |
| `src/app/` | Next.js pages and API routes |
| `src/app/api/` | Backend REST API (auth, candidates, jobs, etc.) |
| `src/app/(marketing)/` | Public marketing website pages |
| `src/app/dashboard/` | Dashboard pages |
| `src/app/careers/` | Public careers portal |
| `src/components/` | Reusable UI components |
| `src/lib/` | Prisma client, translations, API helpers |
| `public/` | Static assets (logo, OG image, robots.txt, sitemap) |

---

## 7. Database & Production

### Local Development

The project requires **PostgreSQL**. For local development, use a free cloud PostgreSQL database (Neon, Supabase, or Railway) or install PostgreSQL locally.

### Production Deployment

For a live site, use **PostgreSQL**:

1. Create a PostgreSQL database with a provider such as Neon, Supabase, Railway, or Vercel Postgres.
2. In **`prisma/schema.prisma`**, confirm `provider = "postgresql"`.
3. In **`.env`** (or your host's environment variables panel), set `DATABASE_URL` to your connection string.
4. Sync schema and run migrations:

   ```bash
   npx prisma db push
   npx prisma migrate deploy
   ```

5. Build and start:

   ```bash
   npm run build
   npm start
   ```

> Do **not** run `prisma migrate dev` in production — always use `prisma migrate deploy`.

### Database Compatibility

Devlumiq ATS requires **PostgreSQL**. The schema uses PostgreSQL-specific features (`@db.Decimal` precision types, `Int[]` arrays) that are not compatible with MySQL or SQLite.

---

## 8. Upgrading from v1

If you are updating from a v1 installation that already contains real candidates, jobs, or applications:

### One-Command Upgrade (Recommended)

1. **Back up your database** before doing anything.
2. Run the upgrade helper:
   ```bash
   node scripts/upgrade-v1-to-v2.js
   ```

This script:
- Generates the Prisma client with new v2 models
- Runs `db push` to safely create all missing tables and columns
- Runs `migrate deploy` to record migration history
- Creates a default Company and backfills `organizationId` on all users, candidates, and jobs
- Creates a FREE subscription for the company
- Marks all existing users as email-verified

**This script NEVER deletes data.**

3. **Do NOT run `npm run seed`** after upgrading. The seed script will refuse to run if real data is detected. If you want to wipe everything and start fresh, use `npm run db:reset`.
4. After the upgrade, existing v1 users must use **Forgot Password** to set a new password.
5. Log in as an admin and review company settings at **Settings → Organization**.

---

## 8b. Updating to a newer release (existing buyers)

You already run Devlumiq ATS with **real hiring data**. New releases are designed to be **safe for existing installations** when you follow this checklist.

### Will an update break my data?

| Situation | Result |
|-----------|--------|
| Replace source code + run DB migrate / upgrade script | **Safe** — new tables/columns only; candidates, jobs, applications stay |
| Skip migrate and only drop new files in | App may error on new features; data is usually still in Postgres |
| Run `npm run seed` on a live DB | Seed **refuses** if real (non-demo) data is detected |
| Run `npm run db:reset` / `prisma migrate reset` | **Destroys all data** — never do this on production |
| New optional features (SMS, SSO, Judge0, white-label) | **Off until configured** — previous workflow stays the same |

**Bottom line:** A normal update does **not** wipe hiring data. Issues come from skipping backups or running reset/seed on production.

### Recommended update steps

1. **Back up the database** (see [§8c](#8c-data-backup--recovery)).
2. Optional: export candidates (Excel/PDF) and take a GDPR export for critical records.
3. Deploy / merge the new source code (keep your `.env`; do not overwrite secrets).
4. Install dependencies:
   ```bash
   npm install
   ```
5. Sync the schema (pick one path):
   - **From v1 → v2:** `node scripts/upgrade-v1-to-v2.js` (never deletes data)
   - **Already on v2, smaller update:**
     ```bash
     npx prisma generate
     npx prisma db push
     npx prisma migrate deploy
     ```
6. Build and restart:
   ```bash
   npm run build
   npm start
   ```
   (Or redeploy on Vercel after push.)
7. **Do not** run `npm run seed` or `npm run db:reset` on a live database.
8. Smoke-test: login, open Candidates / Jobs / Kanban, confirm counts look right.

### If you customized the code

Merging a new zip over a heavily edited fork can overwrite your changes. Prefer git merge / cherry-pick, or re-apply customizations after update. Database data is separate from source files — code overwrite ≠ data wipe.

---

## 8c. Data backup & recovery

Devlumiq ATS is **self-hosted**. The app stores hiring data in **your PostgreSQL database**. Recovery depends on **your host’s backups** — the product does not ship a built-in “undelete everything” button.

### Before every update (required)

Take a database snapshot or dump:

**Neon / Supabase / Railway / Vercel Postgres**

- Use the provider’s **Backup / Point-in-time restore / Branch** UI (recommended).

**Any Postgres (including local)**

```bash
pg_dump "$DATABASE_URL" -Fc -f backup-$(date +%Y%m%d).dump
```

Restore later with:

```bash
pg_restore -d "$DATABASE_URL" --clean --if-exists backup-YYYYMMDD.dump
```

(Exact flags vary by host; follow your provider’s restore docs.)

### What the product can export (partial recovery aids)

These help you keep copies, but they are **not** a full database restore:

| Export | Where | Use |
|--------|-------|-----|
| Candidates Excel / PDF | Dashboard → Candidates | Spreadsheet / printable copy |
| Reports PDF / CSV | Dashboard → Reports / Analytics | Pipeline metrics |
| Staff GDPR export | Admin GDPR API / settings | User-related data package |
| Candidate GDPR export | Admin or `/portal/privacy` | Per-candidate package |

### Soft delete vs hard delete

- Some rows (e.g. inbox messages) use soft-delete flags (`isDeleted`) and can be recovered in code/DB if you know SQL.
- Most deletes (candidates, jobs, `db:reset`) are **hard deletes**. Without a DB backup, they are **not recoverable** from the app alone.

### If data was deleted by mistake

1. **Stop writing** to the database (pause the app if possible).
2. Restore from the **latest Postgres backup / PITR** on your host.
3. If you have no DB backup: rebuild from exports (Excel/CSV/GDPR) where possible — expect incomplete recovery (notes, scores, threads may be missing).
4. Contact your hosting provider’s support for snapshot restore windows.

### Honest summary for buyers

| Question | Answer |
|----------|--------|
| Can the upgrade script recover deleted data? | **No** — it only adds schema; it never undeletes |
| Can Devlumiq restore data without a DB backup? | **No** — host backups / `pg_dump` are the recovery path |
| Is there automatic cloud backup inside the app? | **No** — you control hosting and backups |
| Best practice? | Backup before every update; enable provider backups; optional periodic Excel/GDPR exports |

---

## 9. AI Features

Devlumiq ATS includes optional AI-powered features via OpenAI. All features work **without** an API key using rule-based fallbacks.

### Setup

1. Get an API key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Add to your `.env`: `OPENAI_API_KEY="sk-..."`
3. AI features activate automatically

### Available AI Features

| Feature | Without API Key | With API Key |
|---------|----------------|---------------|
| Resume Parsing | Regex keyword extraction | GPT-powered semantic extraction |
| Candidate Ranking | Simple skill-match scoring | AI scoring with reasoning |
| Candidate Screening | Rule-based verdict | AI assessment with recommendation |
| Job Description | Template output | AI-written inclusive JD |
| Email Drafting | Pre-built templates | AI-composed personalized emails |

### API Endpoints

- `POST /api/resume-parse` — Upload and parse resume
- `POST /api/ai/rank` — Rank candidates against a job
- `POST /api/ai/screen` — Screen candidate fit
- `POST /api/ai/generate-jd` — Generate job description
- `POST /api/ai/draft-email` — Draft professional email
- `GET /api/ai/status` — Check if AI is configured

**Cost:** ~$0.15 per 1M tokens with `gpt-4o-mini`. Typical usage: $1–5/month.

---

## 10. File Storage

Resumes and uploaded files can be stored using three providers:

| Provider | Config | Best For |
|----------|--------|----------|
| Local (default) | No config needed | Development |
| AWS S3 | `FILE_STORAGE_PROVIDER=s3` + AWS credentials | Production |
| Cloudflare R2 | `FILE_STORAGE_PROVIDER=r2` + R2 credentials | Production (cheaper egress) |

See `.env.example` for the full list of environment variables for each provider.

The file storage utility is at `src/lib/file-storage.ts`.

---

## 11. Integrations

| Integration | Status | Configuration |
|-------------|--------|---------------|
| Email/SMTP | ✅ Working | Set SMTP_* vars in .env |
| Twilio SMS | ✅ Working | Set TWILIO_* vars in .env |
| Checkr (background checks) | ✅ Working | Set CHECKR_API_KEY in .env |
| Zapier | ✅ Working | Set ZAPIER_WEBHOOK_URL in .env |
| Chrome Extension (LinkedIn) | ✅ Working | Settings → Chrome Extension (domain + token); load unpacked `chrome-extension/` |
| WhatsApp | ✅ Working | Set WHATSAPP_TOKEN in .env |
| AI (OpenAI) | ✅ Working (optional) | Set OPENAI_API_KEY in .env |
| DocuSign | 🔧 Stub | Workflow works, real DocuSign SDK not integrated |
| Job Boards (LinkedIn, Indeed, Glassdoor) | ✅ Live | Save encrypted credentials via `/api/jobboards/credentials`; live HTTP post + unpublish when present, else draft |
| SSO / SAML | ✅ Opt-in (Enterprise) | Settings → Security → SSO; `/api/auth/sso/login?slug=` |
| White-Label Kit | ✅ Add-on SKU | `docs/white-label-kit.md`; Enterprise or `addOns.whiteLabelKit` |
| Google Calendar | 🔧 Local only | Events in DB, external sync needs OAuth |
| Slack | ❌ Not connected | Planned |
| Outlook | ❌ Not connected | Planned |

---

## 12. Security

- **Authentication:** JWT stored in httpOnly cookie (`ats_session`); optional SAML SSO (Enterprise) without removing password login
- **Passwords:** bcrypt hashed (12 rounds)
- **RBAC:** 5 roles (Admin, Recruiter, Hiring Manager, Interviewer, Viewer) with 30+ granular permissions
- **Rate Limiting:** Per-IP rate limiting on auth and upload endpoints (in-memory by default; optional Redis when `REDIS_URL` is set and `ioredis` is installed)
- **CSRF:** Origin-based validation on mutating requests (production)
- **Headers:** X-Frame-Options, CSP, HSTS, X-Content-Type-Options, Permissions-Policy
- **Webhooks:** HMAC signature verification (Checkr, DocuSign)
- **API Keys:** Hashed storage for integration keys
- **Data Isolation:** Organization-scoped queries (fail-closed — missing org context returns 403)
- **GDPR:** Staff export/erase at `/api/admin/gdpr/*`; candidate export/erase at `/api/admin/gdpr/candidates/*`; **candidate self-service** at `/api/portal/gdpr/*` + UI `/portal/privacy`
- **Trusted proxy:** Set `TRUSTED_PROXY=true` behind Vercel/nginx so rate limits use real client IPs

---

## 12b. Product add-ons (existing buyers unaffected)

All of the following are **additive / opt-in**. Missing plan, add-on, or credentials = previous behavior.

| SKU / Feature | Gate | Notes |
|---------------|------|-------|
| Chrome LinkedIn Import | Always available | Fix-and-flip differentiator |
| Candidate GDPR portal | Always available | Art. 20 / Art. 17 self-service |
| White-Label Kit | `whiteLabel` or `addOns.whiteLabelKit` | Colors/logo grandfathered for all plans |
| Job board live post | Org `JobBoardCredential` | Else draft records |
| SSO / SAML | `sso` or `addOns.sso` | Password login stays default |
| Analytics Plus | `advancedAnalytics` or `addOns.analyticsPlus` | Summary dashboard stays for all |

Stripe optional price env vars: `STRIPE_PRICE_WHITELABEL_KIT`, `STRIPE_PRICE_ANALYTICS_PLUS`, `STRIPE_PRICE_SSO`.

---

## 13. Translations

Devlumiq ATS supports 10 languages: English, Spanish, Arabic, French, German, Portuguese, Hindi, Chinese, Japanese, and Russian.

- All translation strings are in **`src/lib/translations.ts`**.
- **English (`en`) is the source of truth** for marketing and product claims. Other locales may still contain older marketing wording until they are synced.
- Edit or add keys in that file. The active locale is picked up automatically. Missing keys fall back to English.
- Users can switch language via the locale switcher in the header or dashboard sidebar.

---

## 14. Browser Support

Devlumiq ATS targets modern evergreen browsers:

- Chrome, Firefox, Safari, Edge (current versions)
- Mobile: iOS Safari, Chrome for Android

Internet Explorer is not supported.

---

## 15. Asset Credits & Licenses

- **Fonts**: Plus Jakarta Sans and JetBrains Mono via Google Fonts — [Google Fonts License](https://fonts.google.com/license)
- **Icons**: Lucide Icons — [MIT License](https://github.com/lucide-icons/lucide/blob/main/LICENSE)
- **Libraries**: See `package.json` for all dependencies. Each package carries its own license (MIT, Apache-2.0, etc.).

If you incorporate your own images, fonts, or third-party assets, ensure you hold the appropriate rights to use and distribute them.

---

## 16. Troubleshooting

**"Module not found" or install errors**

- Delete `node_modules` and run `npm install` again.
- Verify Node.js is version 18 or higher: `node -v`.

**2. Database / Prisma errors**

- Confirm `.env` exists and `DATABASE_URL` is set.
- Run `npx prisma generate` then `npx prisma db push` followed by `npx prisma migrate deploy`.
- If the database is corrupted, reset it with `npx prisma migrate reset` followed by `npm run seed`.
- **Warning:** `npm run db:reset` / `migrate reset` deletes all data. The seed script itself **refuses** to run when real (non-demo) data is detected — only use reset on a dev database you intend to wipe.

**3. Port 3000 already in use**

- Stop the conflicting process or start on a different port: `npm run dev -- -p 3001`.

**Login not working**

- Confirm you ran `npm run seed`. The default login is `demo@devlumiq.com` / `Demo@1234`. If you skipped seeding, you must register via the signup page or be invited by an admin.

**Build fails**

- Run `npm run build` and review the error output. It is typically a TypeScript error or a missing import in a file you edited. Fix the reported file and build again.

---

For technical details on API routes, database schema, and scripts, refer to **README.md** and **docs/API.md**.

**Thank you for choosing Devlumiq ATS.**
