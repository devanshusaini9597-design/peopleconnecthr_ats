import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { authenticatedFetch } from '../utils/fetchUtils';
import { useAuth } from '../context/AuthContext';

const POLL_MS = 20_000;

export function markSupportSeen() {
  authenticatedFetch('/api/support/mark-seen', { method: 'POST' })
    .then((res) => {
      if (res.ok) window.dispatchEvent(new CustomEvent('support:changed'));
    })
    .catch(() => {});
}

export default function useSupportNavUpdates() {
  const { user } = useAuth();
  const location = useLocation();
  const [count, setCount] = useState(0);
  const enabled = user?.role === 'freelancer';
  const onSupport = location.pathname === '/feedback' || location.pathname.startsWith('/feedback/');

  useEffect(() => {
    if (onSupport && enabled) markSupportSeen();
  }, [onSupport, enabled]);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setCount(0);
      return;
    }
    try {
      const res = await authenticatedFetch('/api/support/unread-count', { cache: 'no-store' });
      if (!res.ok) return;
      const body = await res.json().catch(() => ({}));
      const next = Number(body?.count ?? 0);
      setCount(Number.isFinite(next) ? Math.max(0, Math.min(9, next)) : 0);
    } catch {
      /* ignore */
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
    window.addEventListener('support:changed', onRefresh);
    window.addEventListener('notifications:refresh', onRefresh);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
      window.removeEventListener('support:changed', onRefresh);
      window.removeEventListener('notifications:refresh', onRefresh);
    };
  }, [refresh, enabled]);

  return count;
}
