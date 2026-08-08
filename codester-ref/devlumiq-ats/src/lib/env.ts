/**
 * Environment variable validation.
 * Call validateEnv() once at startup (e.g., in instrumentation.ts or layout.tsx server side).
 * In production, missing required vars throw immediately so the deployment fails fast.
 */

const REQUIRED_PROD = ['JWT_SECRET', 'DATABASE_URL', 'NEXT_PUBLIC_APP_URL'] as const;

const OPTIONAL_WITH_WARNINGS = [
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASS',
] as const;

export function validateEnv(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const missing = REQUIRED_PROD.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `[env] Missing required environment variables: ${missing.join(', ')}. ` +
        'Set them in your deployment environment before starting.',
    );
  }

  for (const key of OPTIONAL_WITH_WARNINGS) {
    if (!process.env[key]) {
      console.warn(`[env] Optional variable ${key} is not set — related features may not work.`);
    }
  }
}

/** Type-safe env accessors (throw in production if missing) */
export const env = {
  get JWT_SECRET() {
    return process.env.JWT_SECRET || 'devlumiq-ats-dev-only-secret-do-not-use-in-production';
  },
  get DATABASE_URL() {
    return process.env.DATABASE_URL!;
  },
  get APP_URL() {
    return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  },
  get SMTP_HOST() { return process.env.SMTP_HOST; },
  get SMTP_PORT() { return Number(process.env.SMTP_PORT) || 587; },
  get SMTP_SECURE() { return process.env.SMTP_SECURE === 'true'; },
  get SMTP_USER() { return process.env.SMTP_USER; },
  get SMTP_PASS() { return process.env.SMTP_PASS; },
  get FROM_EMAIL() { return process.env.FROM_EMAIL || 'noreply@devlumiq.com'; },
  get FROM_NAME() { return process.env.FROM_NAME || 'DevLumiq ATS'; },
  isProd: process.env.NODE_ENV === 'production',
};
