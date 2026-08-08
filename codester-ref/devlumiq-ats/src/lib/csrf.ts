/**
 * CSRF Protection — Origin-based validation
 *
 * Validates Origin / Referer against NEXT_PUBLIC_APP_URL for cookie-session
 * mutating requests. Bearer API-key callers skip CSRF (no cookie CSRF risk).
 *
 * Also applied centrally in middleware for all mutating /api/* routes so
 * handlers that use raw getSession/requireAuth are covered.
 */

import { NextRequest, NextResponse } from 'next/server';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Paths that intentionally accept cross-origin or no-Origin mutating requests. */
export const CSRF_EXEMPT_PREFIXES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/auth/demo',
  '/api/auth/google',
  '/api/auth/docusign',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/setup-account',
  '/api/auth/resend-verification',
  '/api/auth/sso',
  '/api/webhooks',
  '/api/billing/webhook',
  '/api/zapier/webhook',
  '/api/careers',
  '/api/dei/self-id',
  '/api/assessments/take',
  '/api/cron/retention',
  '/api/portal/auth',
  '/api/portal/gdpr',
  '/api/linkedin/import',
];

export function isCsrfExemptPath(pathname: string): boolean {
  if (CSRF_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  // Token-gated assessment APIs
  if (/^\/api\/assessments\/[a-f0-9]{32,64}(\/(answer|submit|run|proctoring-event))?\/?$/.test(pathname)) {
    return true;
  }
  return false;
}

/**
 * Validates that mutating requests come from the same origin.
 * Returns null if valid, or a 403 NextResponse if invalid.
 */
export function validateCsrf(request: NextRequest): NextResponse | null {
  if (SAFE_METHODS.has(request.method)) return null;

  // Bearer API keys are not cookie CSRF vectors
  if (request.headers.get('authorization')?.startsWith('Bearer ')) return null;

  const pathname = request.nextUrl?.pathname ?? (() => {
    try { return new URL(request.url).pathname; } catch { return ''; }
  })();
  if (isCsrfExemptPath(pathname)) return null;

  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';

  // In development, allow requests without origin (e.g., Postman, curl)
  if (process.env.NODE_ENV === 'development') return null;

  if (!origin && !referer) {
    return NextResponse.json(
      { error: 'Forbidden — missing Origin header' },
      { status: 403 }
    );
  }

  const requestOrigin = origin || new URL(referer!).origin;

  if (appUrl && !requestOrigin.startsWith(new URL(appUrl).origin)) {
    return NextResponse.json(
      { error: 'Forbidden — origin mismatch' },
      { status: 403 }
    );
  }

  return null;
}
