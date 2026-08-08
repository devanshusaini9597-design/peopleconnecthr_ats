/** Register PWA service worker (production + local https / localhost). */
export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* silent — SW optional in some hostings */
    });
  });
}
