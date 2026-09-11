import { BASE_API_URL } from '../config';

export const clearClientAuthStorage = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('isLoggedIn');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('userName');
  localStorage.removeItem('userData');
  localStorage.removeItem('userRole');
  localStorage.removeItem('orgData');
  localStorage.removeItem('orgName');
  localStorage.removeItem('orgId');
};

export const isPublicAuthPath = (path = typeof window !== 'undefined' ? window.location.pathname : '') => {
  const p = String(path || '');
  return (
    p.startsWith('/login')
    || p.startsWith('/register')
    || p.startsWith('/reset-password')
    || p.startsWith('/verify-email')
    || p.startsWith('/accept-invite')
    || p.startsWith('/sso')
  );
};

/**
 * End the server session (HttpOnly cookie), drop client auth, and leave the
 * app with a history replace so Back cannot restore a logged-in page.
 */
export const handleLogout = async () => {
  try {
    await fetch(`${BASE_API_URL}/api/logout`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      keepalive: true,
    });
  } catch {
    /* still clear locally if the network call fails */
  }
  clearClientAuthStorage();
  if (!isPublicAuthPath()) {
    window.location.replace('/login');
  }
};
