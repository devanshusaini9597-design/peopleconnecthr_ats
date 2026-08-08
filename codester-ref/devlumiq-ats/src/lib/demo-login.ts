/**
 * Demo login gate — mirrors the assessment code-runner pattern.
 *
 * Production: OFF unless ENABLE_DEMO_LOGIN is explicitly true|1|on,
 *             OR the request is on a known Devlumiq staging host.
 * Development: ON by default (set ENABLE_DEMO_LOGIN=false to disable).
 *
 * Never leave this enabled on a live customer deployment.
 */

/** Official staging / preview hosts where one-click demo login is allowed. */
const DEMO_HOSTS = new Set([
  'devlumiq-ats-v22-staging.vercel.app',
  'devlumiq-ats-rbac.vercel.app',
  'localhost',
  '127.0.0.1',
]);

export function isDemoHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const hostname = host.toLowerCase().split(':')[0].trim();
  if (!hostname) return false;
  if (DEMO_HOSTS.has(hostname)) return true;
  // Vercel preview deployments for official demo projects
  if (
    hostname.endsWith('.vercel.app') &&
    (hostname.includes('devlumiq-ats-v22-staging') || hostname.includes('devlumiq-ats-rbac'))
  ) {
    return true;
  }
  return false;
}

function hostFromAppUrl(): string | null {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  if (!appUrl) return null;
  try {
    return new URL(appUrl).hostname;
  } catch {
    return null;
  }
}

/**
 * @param host - optional Host header / window.location.hostname
 */
export function isDemoLoginEnabled(host?: string | null): boolean {
  const flag = (process.env.ENABLE_DEMO_LOGIN || '').toLowerCase().trim();
  if (flag === 'false' || flag === '0' || flag === 'off') return false;
  if (flag === 'true' || flag === '1' || flag === 'on') return true;

  if (isDemoHost(host) || isDemoHost(hostFromAppUrl())) return true;

  // Default: allow only outside production
  return process.env.NODE_ENV !== 'production';
}
