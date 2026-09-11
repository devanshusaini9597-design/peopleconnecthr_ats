import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { authenticatedFetch } from '../utils/fetchUtils';
import { useAuth } from '../context/AuthContext';

/** Analytics sidebar badge — unread shared reports. Cleared when user opens Analytics. */
const POLL_MS = 10_000;

export function markReportSharesSeen() {
  authenticatedFetch('/api/notifications/report-shares/mark-seen', { method: 'POST' })
    .then((res) => {
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('report-shares:changed'));
        window.dispatchEvent(new CustomEvent('notifications:refresh'));
      }
    })
    .catch(() => {});
}

export default function useReportShareNavUpdates() {
  const { user } = useAuth();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const enabled = Boolean(user?._id || user?.id) && user?.role !== 'freelancer';
  const onAnalytics = location.pathname === '/analytics' || location.pathname.startsWith('/analytics/');
  const markedForVisit = useRef(false);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setUnreadCount(0);
      return;
    }
    try {
      const res = await authenticatedFetch('/api/notifications/report-shares/unread-count', {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const body = await res.json().catch(() => ({}));
      const count = Number(body?.count ?? 0);
      setUnreadCount(Number.isFinite(count) ? Math.max(0, Math.min(9, count)) : 0);
    } catch {
      /* ignore */
    }
  }, [enabled]);

  useEffect(() => {
    if (!onAnalytics) {
      markedForVisit.current = false;
      return undefined;
    }
    if (!enabled || markedForVisit.current) return undefined;
    markedForVisit.current = true;
    // Clear after a beat so the badge is visible when arriving from a notification.
    const t = window.setTimeout(() => {
      markReportSharesSeen();
      setUnreadCount(0);
    }, 1200);
    return () => window.clearTimeout(t);
  }, [onAnalytics, enabled]);

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
    window.addEventListener('report-shares:changed', onRefresh);
    window.addEventListener('notifications:refresh', onRefresh);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
      window.removeEventListener('report-shares:changed', onRefresh);
      window.removeEventListener('notifications:refresh', onRefresh);
    };
  }, [refresh, enabled]);

  return unreadCount;
}
