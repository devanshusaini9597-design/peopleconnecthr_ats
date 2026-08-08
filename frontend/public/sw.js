/* SkillNix ATS service worker — offline shell + push */
const CACHE = 'skillnix-shell-v2';
const PRECACHE = ['/', '/manifest.webmanifest', '/logo.png', '/favicon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api') || url.pathname.includes('.')) {
    // Network-first for assets/API-ish paths
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }
  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
        return res;
      })
      .catch(() => caches.match(request).then((r) => r || caches.match('/')))
  );
});

self.addEventListener('push', (event) => {
  let payload = { title: 'SkillNix', body: 'You have a new notification', url: '/dashboard' };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch { /* ignore */ }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/logo.png',
      badge: '/favicon.png',
      data: { url: payload.url || '/dashboard' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/dashboard';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
