import { BASE_API_URL } from '../config';

// Utility function to make authenticated API requests
export const authenticatedFetch = (url, options = {}) => {
  const token = localStorage.getItem('token');
  const orgId = localStorage.getItem('orgId');
  
  const headers = {};
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  
  Object.assign(headers, options.headers || {});
  
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  if (orgId) {
    headers['X-Organization-Id'] = orgId;
  }
  
  const fullUrl = url.startsWith('http') ? url : `${BASE_API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  
  return fetch(fullUrl, {
    ...options,
    headers,
    credentials: options.credentials !== undefined ? options.credentials : 'include',
  }).then(response => {
    if (response.status === 401) {
      response.clone().json().then(data => {
        if (data.message === 'USER_DELETED' || data.message === 'Token expired. Please login again.') {
          localStorage.removeItem('token');
          localStorage.removeItem('isLoggedIn');
          localStorage.removeItem('userEmail');
          localStorage.removeItem('userName');
          window.location.href = '/login';
        }
      }).catch(() => {});
    }
    return response;
  });
};

export const isUnauthorized = (response) => {
  return response.status === 401 || response.status === 403;
};

export const handleUnauthorized = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('isLoggedIn');
  localStorage.removeItem('userEmail');
  window.location.href = '/login';
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
