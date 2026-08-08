import { BASE_API_URL } from '../config';

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
  if (!(options.body instanceof FormData)) {
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

    if (!isAuthEndpoint) {
      try {
        await tryRefreshSession();
        return authenticatedFetch(url, options, true);
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userName');
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }
    } else {
      response
        .clone()
        .json()
        .then((data) => {
          if (
            data.message === 'USER_DELETED' ||
            data.message === 'Token expired. Please login again.' ||
            data.code === 'ACCOUNT_DEACTIVATED'
          ) {
            localStorage.removeItem('token');
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('userEmail');
            localStorage.removeItem('userName');
            window.dispatchEvent(new CustomEvent('auth:unauthorized'));
          }
        })
        .catch(() => {});
    }
  }

  return response;
};

export const isUnauthorized = (response) => {
  return response.status === 401 || response.status === 403;
};

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
