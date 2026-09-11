import { useCallback, useEffect, useState } from 'react';
import { authenticatedFetch } from '../utils/fetchUtils';
import { useAuth } from '../context/AuthContext';
import { planHasFeature } from '../config/planFeatures';

const POLL_MS = 30_000;

export default function useAnnouncementNavUpdates() {
  const { user, organization } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const enabled =
    Boolean(user?.role)
    && planHasFeature(organization?.plan, 'announcements');

  const refresh = useCallback(async () => {
    if (!enabled) {
      setUnreadCount(0);
      return;
    }
    try {
      const res = await authenticatedFetch('/api/announcements/unread-count', { cache: 'no-store' });
      if (!res.ok) return;
      const body = await res.json().catch(() => ({}));
      const count = Number(body?.count ?? 0);
      setUnreadCount(Number.isFinite(count) ? Math.max(0, count) : 0);
    } catch {
      /* ignore network */
    }
  }, [enabled]);

  useEffect(() => {
    refresh();
    if (!enabled) return undefined;
    const id = window.setInterval(refresh, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const onRefresh = () => { refresh(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    window.addEventListener('announcements:refresh', onRefresh);
    window.addEventListener('announcements:changed', onRefresh);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
      window.removeEventListener('announcements:refresh', onRefresh);
      window.removeEventListener('announcements:changed', onRefresh);
    };
  }, [refresh, enabled]);

  return unreadCount;
}
