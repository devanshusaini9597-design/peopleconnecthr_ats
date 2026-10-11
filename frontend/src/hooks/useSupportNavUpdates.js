import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { authenticatedFetch } from '../utils/fetchUtils';
import { useAuth } from '../context/AuthContext';

const POLL_MS = 45_000;
const COMPANY_ROLES = ['owner', 'admin', 'hr_manager', 'hr_recruiter', 'recruiter', 'sales'];

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
  const freelancer = user?.role === 'freelancer';
  const company = Boolean(user && (user.role === 'owner' || COMPANY_ROLES.includes(user.role)));
  const enabled = freelancer || company;
  const onSupport = freelancer
    ? (location.pathname === '/feedback' || location.pathname.startsWith('/feedback/'))
    : location.pathname.startsWith('/support-desk');

  useEffect(() => {
    if (onSupport && freelancer) markSupportSeen();
  }, [onSupport, freelancer]);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setCount(0);
      return;
    }
    try {
      const path = freelancer ? '/api/support/unread-count' : '/api/support/org/unread-count';
      const res = await authenticatedFetch(path, { cache: 'no-store' });
      if (!res.ok) return;
      const body = await res.json().catch(() => ({}));
      const next = Number(body?.count ?? 0);
      setCount(Number.isFinite(next) ? Math.max(0, next) : 0);
    } catch {
      /* ignore */
    }
  }, [enabled, freelancer]);

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
