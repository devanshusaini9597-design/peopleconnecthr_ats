'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker only.
 * Push permission / subscribe is opt-in via Settings → Notifications (PushNotificationSettings).
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);

  return null;
}
