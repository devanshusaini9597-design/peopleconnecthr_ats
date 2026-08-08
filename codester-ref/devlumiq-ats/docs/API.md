# Devlumiq ATS — API Reference

> **Partial reference** — documents the main v2.2 routes. The codebase has **~146** handlers under `src/app/api/`; see that folder and `prisma/schema.prisma` for the complete surface.

All endpoints require authentication (JWT cookie `ats_session`) unless noted as **Public**.

Base URL: `{NEXT_PUBLIC_APP_URL}/api`

---

## Authentication

| Method | Path | Public | Description |
|--------|------|--------|-------------|
| POST | `/auth/login` | ✅ | Email + password login → sets session cookie |
| POST | `/auth/register` | ✅ | Create new user account |
| POST | `/auth/logout` | ✅ | Clear session cookie |
| POST | `/auth/demo` | ✅ | Quick demo login (disabled in production unless `ENABLE_DEMO_LOGIN=true` or staging host) |
| POST | `/auth/forgot-password` | ✅ | Send password reset email |
| POST | `/auth/reset-password` | ✅ | Reset password with token |
| POST | `/auth/verify-email` | ✅ | Verify email address |
| GET | `/auth/session` | ❌ | Get current session info |
| GET | `/auth/sso/login` | ✅ | SAML SSO redirect (Enterprise add-on) |
| POST | `/auth/sso/acs` | ✅ | SAML assertion consumer |

---

## Dashboard

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/dashboard/summary` | Any authenticated | Dashboard stats (candidates, jobs, pipeline counts) |

---

## Candidates

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/candidates` | VIEW_CANDIDATES | List candidates (paginated, filterable) |
| POST | `/candidates` | CREATE_CANDIDATE | Create a new candidate |
| GET | `/candidates/[id]` | VIEW_CANDIDATES | Get candidate details |
| PUT | `/candidates/[id]` | EDIT_CANDIDATE | Update candidate |
| DELETE | `/candidates/[id]` | DELETE_CANDIDATE | Delete candidate |
| GET | `/candidates/search` | USE_SMART_SEARCH | Advanced search with filters |
| POST | `/candidates/bulk` | DELETE_CANDIDATE / MOVE_APPLICATION | Bulk delete or stage-update candidates |
| POST | `/candidates/bulk-import` | CREATE_CANDIDATE | CSV import (preview or import; dedupe by email) |
| GET | `/candidates/bulk-import` | CREATE_CANDIDATE | Download CSV import template |
| GET | `/skills` | auth | List system + org skills taxonomy |
| POST | `/skills` | MANAGE_SETTINGS | Create org-custom skill |
| PUT | `/skills` | MANAGE_SETTINGS | Seed system skills (idempotent) |
| GET | `/skills/match` | VIEW_CANDIDATES | Skills match % for job↔candidate |
| GET/PUT | `/candidates/[id]/skills` | VIEW/EDIT_CANDIDATE | Candidate taxonomy skills |
| GET/PUT | `/jobs/[id]/skills` | VIEW/EDIT_JOB | Job required skills |
| POST | `/messages/sms/send` | USE_EMAIL_TEMPLATES | Send SMS (Twilio; requires smsOptIn) |
| POST | `/messages/sms/bulk` | USE_EMAIL_TEMPLATES | Bulk SMS reminders/nudges |
| POST | `/messages/whatsapp/send` | USE_EMAIL_TEMPLATES | WhatsApp + thread persist (opt-in) |
| GET/PATCH | `/candidates/[id]/messaging-consent` | VIEW/EDIT | SMS/WhatsApp TCPA consent |
| POST | `/webhooks/twilio` | Public | Inbound SMS → MessageThread |
| GET/POST | `/webhooks/whatsapp` | Public | WhatsApp verify + inbound |
| GET | `/candidates/[id]/comments` | VIEW_CANDIDATES | Get candidate comments |
| POST | `/candidates/[id]/comments` | ADD_COMMENT | Add comment to candidate |
| POST | `/candidates/[id]/resume/parse` | USE_RESUME_PARSER | Parse uploaded resume |
| GET/POST/DELETE | `/candidates/[id]/scores` | SCORE_INTERVIEW | Interview scores (org-scoped) |

---

## Jobs

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/jobs` | VIEW_JOBS | List jobs (paginated) |
| POST | `/jobs` | CREATE_JOB | Create a new job |
| GET | `/jobs/[id]` | VIEW_JOBS | Get job details |
| PUT | `/jobs/[id]` | EDIT_JOB | Update job |
| DELETE | `/jobs/[id]` | DELETE_JOB | Delete job |
| GET/POST/PATCH | `/jobs/[id]/integrations` | MANAGE_INTEGRATIONS | Job board postings (org-scoped) |
| GET/POST | `/forms/[jobId]` | VIEW_JOBS / EDIT_JOB | Custom application form (org-scoped) |

---

## Applications

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/applications` | VIEW_CANDIDATES | List applications (filterable by stage) |
| POST | `/applications` | CREATE_CANDIDATE | Create application |
| PATCH | `/applications/[id]` | MOVE_PIPELINE_STAGE | Update application stage |

---

## Calendar

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/calendar/events` | Any authenticated | Get interview events (date range filter) |
| POST | `/calendar/events` | SCHEDULE_INTERVIEW | Create interview event |
| GET | `/calendar/integrations` | Any authenticated | List calendar integrations |
| POST | `/calendar/integrations` | Any authenticated | Connect calendar provider |

> **Note:** Calendar events are stored locally. External calendar sync (Google, Outlook) requires OAuth setup via `/api/auth/google`.

---

## Messages

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/messages/threads` | Any authenticated | List message threads |
| POST | `/messages/threads` | Any authenticated | Create thread |
| GET/DELETE | `/messages/threads/[id]` | Any authenticated | Get or delete thread (org-scoped) |
| POST | `/messages/threads/[id]` | Any authenticated | Send message in thread |

---

## Email & Sequences

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/email-templates` | USE_EMAIL_TEMPLATES | List email templates |
| POST | `/email-templates` | USE_EMAIL_TEMPLATES | Create template |
| POST | `/email/send` | USE_EMAIL_TEMPLATES | Send email (requires SMTP config) |
| GET/POST/PATCH | `/email/sequences` | MANAGE_EMAIL_SEQUENCES | List, create, or enroll in sequences (org-scoped) |

---

## Assessments

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET/POST | `/assessments/templates` | VIEW_ASSESSMENTS / MANAGE_SETTINGS | Assessment templates |
| POST | `/assessments/assign` | VIEW_ASSESSMENTS | Assign assessment to candidate |
| GET/PATCH | `/assessments/assignments/[id]` | VIEW_ASSESSMENTS | Assignment status / integrity |
| GET/POST | `/assessments/take/[id]` | Public (token) | Candidate take flow |
| POST | `/assessments/[id]/submit` | Public (token) | Submit answers |
| POST | `/assessments/[id]/run` | Public (token) | Run coding test (Judge0 or opt-in local runner) |

---

## Talent Pools

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET/POST | `/talent-pools` | VIEW_CANDIDATES / CREATE_CANDIDATE | List or create pools (org-scoped) |
| GET/PATCH/DELETE | `/talent-pools/[id]` | org-scoped | Pool CRUD |
| POST | `/talent-pools/[id]/members` | CREATE_CANDIDATE | Add candidate to pool (consent required) |
| GET | `/talent-pools/suggest` | Suggest candidates for a job |

---

## AI Features (Optional)

All AI endpoints work **with or without** an OpenAI API key. Without a key, rule-based fallbacks are used.

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| POST | `/resume-parse` | Any authenticated | AI-enhanced or rule-based resume parsing |
| POST | `/ai/rank` | USE_SMART_SEARCH | Rank candidates against job requirements |
| POST | `/ai/screen` | VIEW_CANDIDATES | Screen candidate fit assessment |
| POST | `/ai/generate-jd` | CREATE_JOB | Generate job description from title + dept |
| POST | `/ai/draft-email` | USE_EMAIL_TEMPLATES | Draft professional email |
| GET | `/ai/status` | Any authenticated | Check AI configuration status |

---

## Integrations

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| POST | `/jobboards/post` | MANAGE_INTEGRATIONS | Post job to boards (live HTTP when credentials exist; otherwise draft DB record) |
| GET | `/jobboards/post?jobId=` | MANAGE_INTEGRATIONS | Get board postings for a job |
| GET | `/jobboards/credentials` | MANAGE_INTEGRATIONS | List org board credentials (secrets masked) |
| PUT | `/jobboards/credentials` | MANAGE_INTEGRATIONS | Save encrypted LinkedIn / Indeed / Glassdoor credentials |
| DELETE | `/jobboards/credentials` | MANAGE_INTEGRATIONS | Remove board credentials |
| POST | `/linkedin/import` | CREATE_CANDIDATE | Import LinkedIn profile (via Chrome extension) |
| POST | `/esignature/send` | USE_ESIGNATURE | Send e-signature request (DocuSign stub) |
| GET | `/esignature/send?candidateId=` | USE_ESIGNATURE | Get signature requests (org-scoped) |
| POST | `/checkr` | VIEW_BACKGROUND_CHECKS | Initiate background check (org-scoped) |
| PATCH | `/checkr` | RUN_BACKGROUND_CHECKS | Update check status (org-scoped) |
| GET/POST/DELETE | `/background-checks/request/[id]` | auth / RUN_BACKGROUND_CHECKS | Background check records (org-scoped) |
| POST | `/zapier/webhook` | Public | Zapier incoming webhook |
| GET/POST/DELETE | `/webhooks` | MANAGE_INTEGRATIONS | Org webhook subscriptions (org-scoped) |
| POST | `/webhooks/checkr` | Public (signed) | Checkr status webhook |
| POST | `/webhooks/twilio` | Public (signed) | Twilio inbound SMS |
| GET/POST | `/referrals` | VIEW/MANAGE_REFERRALS | Employee referrals (org-scoped) |
| GET/POST | `/scorecards/submit` | SCORE_INTERVIEW | Submit or fetch interview scores (org-scoped) |

---

## Admin & GDPR

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/admin/gdpr?userId=` | ADMIN only | Export staff user data (GDPR) |
| DELETE | `/admin/gdpr?userId=` | ADMIN only | Delete staff user data (right to erasure) |
| GET | `/admin/gdpr/candidates/export` | ADMIN only | Export candidate data |
| DELETE | `/admin/gdpr/candidates/erase` | ADMIN only | Erase candidate data |
| GET | `/audit-logs` | ADMIN only | View audit log entries |
| GET/POST | `/portal/gdpr/export` | Portal auth | Candidate self-service export |
| POST | `/portal/gdpr/erase` | Portal auth | Candidate self-service erase |

---

## Analytics & DEI

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/analytics/dashboard` | VIEW_ANALYTICS | Pipeline funnel, source breakdown, hire rate |
| GET | `/dei/metrics` | VIEW_ANALYTICS (add-on) | Aggregate DEI funnel metrics |
| POST | `/dei/self-id` | Public | Voluntary candidate self-ID (careers apply) |

---

## Billing (Stripe)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| POST | `/billing/checkout` | ADMIN | Start checkout session |
| POST | `/billing/portal` | ADMIN | Customer portal |
| GET | `/billing/subscription` | ADMIN | Current plan + add-ons |
| POST | `/billing/webhook` | Public (signed) | Stripe webhook |

---

## Public (No Auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/careers` | Public careers page data |
| GET | `/careers/jobs` | Public job listings |
| POST | `/careers/apply` | Submit job application |
| POST | `/careers/chatbot` | Careers site FAQ chatbot |
| GET | `/health` | Health check |
| GET/POST | `/assessments/take/[token]` | Token-gated candidate assessment |

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Human-readable error message"
}
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request / validation error |
| 401 | Unauthorized (no/invalid session) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Resource not found |
| 413 | Payload too large |
| 415 | Unsupported media type |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

---

## Rate Limiting

- Login: 10 attempts per 15 minutes per IP
- Resume parse: 10 per 10 minutes per IP
- General API: In-memory rate limiter by default (per-instance); optional Redis when `REDIS_URL` is set and `ioredis` is installed

Rate-limited responses include a `Retry-After` header (seconds).

---

## RBAC Roles

| Role | Typical Access |
|------|---------------|
| ADMIN | Full access, user management, audit logs |
| RECRUITER | Candidates, jobs, pipeline, email, integrations |
| HIRING_MANAGER | View candidates, schedule interviews, scoring |
| INTERVIEWER | View assigned candidates, submit scores |
| VIEWER | Read-only access to candidates and analytics |

See `src/lib/roles.ts` for the full permission matrix (**34** permissions).
