import { BASE_API_URL } from '../config';

const HARD_SESSION_CODES = new Set([
  'SESSION_EXPIRED',
  'SESSION_IDLE_TIMEOUT',
  'SESSION_REVOKED',
  'ACCOUNT_DEACTIVATED',
]);

function dropClientSession(code) {
  localStorage.removeItem('token');
  localStorage.removeItem('isLoggedIn');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('userName');
  const eventName = HARD_SESSION_CODES.has(code) ? 'auth:session-expired' : 'auth:unauthorized';
  window.dispatchEvent(new CustomEvent(eventName, { detail: { code } }));
}

let isRefreshing = false;
let refreshWaiters = [];

const waitForRefresh = () =>
  new Promise((resolve, reject) => {
    refreshWaiters.push({ resolve, reject });
  });

const resolveRefreshWaiters = (ok) => {
  refreshWaiters.forEach((w) => (ok ? w.resolve() : w.reject(new Error('refresh failed'))));
  refreshWaiters = [];
};

async function tryRefreshSession() {
  if (isRefreshing) return waitForRefresh();
  isRefreshing = true;
  try {
    const res = await fetch(`${BASE_API_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('refresh failed');
    resolveRefreshWaiters(true);
    return true;
  } catch (err) {
    resolveRefreshWaiters(false);
    throw err;
  } finally {
    isRefreshing = false;
  }
}

/**
 * Authenticated API requests via HttpOnly cookie (credentials: include).
 * No JWT in localStorage. On 401, attempts silent refresh once.
 */
export const authenticatedFetch = async (url, options = {}, _retried = false) => {
  const orgId = localStorage.getItem('orgId');

  const headers = {};
  const method = String(options.method || 'GET').toUpperCase();
  if (!(options.body instanceof FormData) && method !== 'GET' && method !== 'HEAD') {
    headers['Content-Type'] = 'application/json';
  }

  Object.assign(headers, options.headers || {});

  if (orgId) {
    headers['X-Organization-Id'] = orgId;
  }

  const fullUrl = url.startsWith('http')
    ? url
    : `${BASE_API_URL}${url.startsWith('/') ? '' : '/'}${url}`;

  const response = await fetch(fullUrl, {
    ...options,
    headers,
    credentials: options.credentials !== undefined ? options.credentials : 'include',
  });

  if (response.status === 401 && !_retried) {
    const isAuthEndpoint =
      fullUrl.includes('/api/login') ||
      fullUrl.includes('/api/auth/refresh') ||
      fullUrl.includes('/api/logout');

    let body = {};
    try {
      body = await response.clone().json();
    } catch {
      body = {};
    }

    if (HARD_SESSION_CODES.has(body.code)) {
      dropClientSession(body.code);
      return response;
    }

    if (!isAuthEndpoint) {
      try {
        await tryRefreshSession();
        return authenticatedFetch(url, options, true);
      } catch {
        dropClientSession();
      }
    } else if (
      body.message === 'USER_DELETED' ||
      body.message === 'Token expired. Please login again.' ||
      HARD_SESSION_CODES.has(body.code)
    ) {
      dropClientSession(body.code);
    }
  }

  return response;
};

/**
 * True only for auth/session failures (401).
 * Do NOT treat 403 as logout — plan limits and permissions return 403.
 */
export const isUnauthorized = (response) => {
  return Boolean(response && response.status === 401);
};

/** Permission, plan limit, or policy denial — show an error; keep the session. */
export const isForbidden = (response) => {
  return Boolean(response && response.status === 403);
};

/**
 * Clear user-facing copy for plan / permission denials.
 * Never use this path to log the user out.
 */
export function planLimitErrorMessage(body = {}, fallbackResource = 'this resource') {
  const code = String(body?.code || '');
  const resource = String(body?.resource || fallbackResource).toLowerCase();
  const current = body?.current;
  const limit = body?.limit;
  const usage = (Number.isFinite(Number(current)) && Number.isFinite(Number(limit)))
    ? ` (${current}/${limit})`
    : '';

  if (code === 'PLAN_LIMIT_EXCEEDED' || body?.upgradeRequired) {
    const label = resource === 'jobs'
      ? 'jobs'
      : resource === 'candidates'
        ? 'candidates'
        : resource === 'users'
          ? 'team seats'
          : resource === 'emails'
            ? 'emails this month'
            : resource;
    return `Plan limit exceeded for ${label}${usage}. Upgrade your plan in Billing to continue, or contact support for Enterprise.`;
  }

  if (typeof body?.message === 'string' && body.message.trim()) {
    return body.message.trim();
  }

  return `You do not have permission to use ${fallbackResource}.`;
}

export const handleUnauthorized = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('isLoggedIn');
  localStorage.removeItem('userEmail');
  window.dispatchEvent(new CustomEvent('auth:unauthorized'));
};

/** Parse JSON from a fetch Response; throws on HTML/empty non-JSON (e.g. Express 404 pages). */
export async function readApiJson(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const err = new Error(
      res.status === 404
        ? 'API endpoint not found. The backend may need a redeploy.'
        : `Invalid response from server (${res.status || 'unknown'})`
    );
    err.status = res.status;
    err.nonJson = true;
    throw err;
  }
}

export { BASE_API_URL };
