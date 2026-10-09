import API_URL from '../config';

/** Staging tenants live on the hyphen Railway host, not production. */
const STAGING_CAREERS_API = 'https://peopleconnecthr-ats-production.up.railway.app';
const STAGING_CAREERS_SLUGS = new Set(['test-company-a', 'test-company-b']);

export function careersApiBase(orgSlug) {
  const slug = String(orgSlug || '').trim().toLowerCase();
  if (STAGING_CAREERS_SLUGS.has(slug)) return STAGING_CAREERS_API;
  return API_URL;
}

export function careersApiUrl(orgSlug, path = '') {
  const base = careersApiBase(orgSlug).replace(/\/$/, '');
  const suffix = String(path || '').replace(/^\//, '');
  const slug = encodeURIComponent(String(orgSlug || '').trim());
  return suffix
    ? `${base}/api/careers/${slug}/${suffix}`
    : `${base}/api/careers/${slug}`;
}
