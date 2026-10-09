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

const MARKETING_PREFIXES = [
  '/pricing', '/features', '/enterprise', '/security', '/integrations',
  '/ai-automation', '/faq', '/contact', '/privacy', '/terms', '/customers',
  '/trust', '/status', '/demo',
];

export const isPublicMarketingPath = (path = typeof window !== 'undefined' ? window.location.pathname : '') => {
  const p = String(path || '');
  if (p === '/' || p === '') return true;
  return MARKETING_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
};

export const isPublicAuthPath = (path = typeof window !== 'undefined' ? window.location.pathname : '') => {
  const p = String(path || '');
  return (
    isPublicMarketingPath(p)
    || p.startsWith('/login')
    || p.startsWith('/pchr-ops')
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
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  // Always hard-load /login after leaving the app so React Router does not
  // keep `state.from` (e.g. Candidates) and send the next sign-in there.
  // Stay put on other public auth screens (demo, platform ops sign-in).
  if (path.startsWith('/login') || !isPublicAuthPath(path)) {
    window.location.replace('/login');
  }
};
