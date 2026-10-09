import { isPublicMarketingPath } from './authUtils';

/** Register PWA service worker (production + local https / localhost). */
export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  // Marketing pages should not wait on SW install / extra `/` fetch.
  if (isPublicMarketingPath()) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* silent — SW optional in some hostings */
    });
  });
}
