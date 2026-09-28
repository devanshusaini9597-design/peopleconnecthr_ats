import { useCallback, useEffect, useState } from 'react';
import { authenticatedFetch } from '../utils/fetchUtils';
import { useAuth } from '../context/AuthContext';
import { planHasFeature } from '../config/planFeatures';

const POLL_MS = 30_000;
const EMPLOYEE_ROLES = ['owner', 'admin', 'hr_manager', 'hr_recruiter', 'recruiter', 'sales'];

export default function useInboxNavUpdates() {
  const { user, organization } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const enabled =
    Boolean(user?.role)
    && EMPLOYEE_ROLES.includes(user.role)
    && planHasFeature(organization?.plan, 'messaging.inbox');

  const refresh = useCallback(async () => {
    if (!enabled) {
      setUnreadCount(0);
      return;
    }
    try {
      const res = await authenticatedFetch('/api/inbox/stats?assigned=me', { cache: 'no-store' });
      if (!res.ok) return;
      const body = await res.json().catch(() => ({}));
      const count = Number(body?.data?.unreadCount ?? 0);
      setUnreadCount(Number.isFinite(count) ? Math.max(0, count) : 0);
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
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    window.addEventListener('inbox:changed', refresh);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
      window.removeEventListener('inbox:changed', refresh);
    };
  }, [refresh, enabled]);

  return unreadCount;
}
