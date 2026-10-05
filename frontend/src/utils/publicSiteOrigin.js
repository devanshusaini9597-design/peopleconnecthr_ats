/** Public site Turnstile is allowed on. Share links must use this host. */
export const PUBLIC_SITE_ORIGIN = 'https://www.peopleconnecthr.com';

export function publicSiteOrigin() {
  if (typeof window === 'undefined') return PUBLIC_SITE_ORIGIN;
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return window.location.origin;
  return PUBLIC_SITE_ORIGIN;
}
