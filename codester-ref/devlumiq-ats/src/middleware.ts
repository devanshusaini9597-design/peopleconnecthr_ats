import { NextRequest, NextResponse } from 'next/server';
import { validateCsrf, isCsrfExemptPath } from '@/lib/csrf';

const PUBLIC_API_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/auth/demo',
  '/api/auth/google',
  '/api/auth/google/callback',
  '/api/auth/docusign',
  '/api/auth/docusign/callback',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/verify-email',
  '/api/auth/setup-account',
  '/api/auth/resend-verification',
  '/api/webhooks',
  '/api/billing/webhook',
  '/api/zapier/webhook',
  '/api/careers',
  '/api/jobs/public',
  '/api/health',
  '/api/assessments/take',
  '/api/dei/self-id',
  '/api/webhooks/meetings',
  '/api/cron/retention',
  '/api/portal',
  '/api/auth/sso',
  '/api/auth/validate',
  '/api/linkedin/import',
];

const DEV_JWT_FALLBACK = 'devlumiq-ats-dev-only-secret-do-not-use-in-production';

/** Token-gated assessment APIs: /api/assessments/<48-hex>/(answer|submit|run)? */
function isPublicAssessmentTokenApi(pathname: string): boolean {
  return /^\/api\/assessments\/[a-f0-9]{32,64}(\/(answer|submit|run|proctoring-event))?\/?$/.test(pathname);
}

function base64UrlToBytes(input: string): Uint8Array<ArrayBuffer> {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function getJwtSecret(): string | null {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') return null;
  return DEV_JWT_FALLBACK;
}

/**
 * Edge-compatible HS256 JWT verify (Web Crypto).
 * Rejects forged cookies that only decode the payload without a valid signature.
 */
async function extractSession(
  cookieValue: string,
): Promise<{ userId: string; role: string; organizationId?: string | null; exp?: number } | null> {
  const JWT_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
  if (!JWT_RE.test(cookieValue)) return null;

  const secret = getJwtSecret();
  if (!secret) return null;

  try {
    const [headerB64, payloadB64, sigB64] = cookieValue.split('.');
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlToBytes(sigB64),
      new TextEncoder().encode(`${headerB64}.${payloadB64}`),
    );
    if (!valid) return null;

    const json = new TextDecoder().decode(base64UrlToBytes(payloadB64));
    const payload = JSON.parse(json) as {
      userId?: string;
      role?: string;
      organizationId?: string | null;
      exp?: number;
    };
    if (!payload.userId) return null;
    if (payload.exp && payload.exp < Date.now() / 1000) return null;
    return {
      userId: payload.userId,
      role: payload.role ?? 'VIEWER',
      organizationId: payload.organizationId ?? null,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Universal CSRF for mutating /api/* (cookie sessions). Bearer + exempt paths skip.
  if (pathname.startsWith('/api') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    if (!isCsrfExemptPath(pathname)) {
      const csrfError = validateCsrf(request);
      if (csrfError) return csrfError;
    }
  }

  const isDashboard = pathname.startsWith('/dashboard');
  const isProtectedApi =
    pathname.startsWith('/api') &&
    !PUBLIC_API_PATHS.some((p) => pathname.startsWith(p)) &&
    !isPublicAssessmentTokenApi(pathname);

  if (!isDashboard && !isProtectedApi) return NextResponse.next();

  const cookieValue = request.cookies.get('ats_session')?.value;
  const session = cookieValue ? await extractSession(cookieValue) : null;
  const hasBearer = request.headers.get('authorization')?.startsWith('Bearer ');

  // Chrome extension / API keys: let route handlers validate Bearer (no cookie required)
  if (!session && hasBearer && isProtectedApi) {
    return NextResponse.next();
  }

  if (!session) {
    if (isDashboard) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = session.role;

  const adminOnlyPaths = ['/dashboard/settings/users', '/dashboard/settings/audit-log'];
  const isAdminOnly = adminOnlyPaths.some((p) => pathname.startsWith(p));
  if (isAdminOnly && role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  const managersOnlyPaths = ['/dashboard/settings'];
  const isManagersOnly = managersOnlyPaths.some((p) => pathname.startsWith(p));
  const managerRoles = ['ADMIN', 'RECRUITER', 'HIRING_MANAGER'];
  if (isManagersOnly && !managerRoles.includes(role)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  const analyticsOnlyPaths = ['/dashboard/analytics', '/dashboard/reports'];
  const isAnalyticsOnly = analyticsOnlyPaths.some((p) => pathname.startsWith(p));
  const analyticsRoles = ['ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'VIEWER'];
  if (isAnalyticsOnly && !analyticsRoles.includes(role)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  const res = NextResponse.next();
  res.headers.set('x-user-id', session.userId);
  res.headers.set('x-user-role', session.role);
  if (session.organizationId) res.headers.set('x-org-id', session.organizationId);
  return res;
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
};
