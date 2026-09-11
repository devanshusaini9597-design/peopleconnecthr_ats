import API_URL from '../config';

/** Resolve org logo / profile photo for <img src>. Hosted /uploads paths go through the API origin. */
export function resolveOrgLogoSrc(logo) {
  const raw = String(logo || '').trim();
  if (!raw) return '';
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
  if (raw.startsWith('/')) {
    const base = String(API_URL || '').replace(/\/$/, '');
    return `${base}${raw}`;
  }
  return raw;
}

export const resolveAssetSrc = resolveOrgLogoSrc;

