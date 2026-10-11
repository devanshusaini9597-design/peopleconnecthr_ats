import { useCallback, useEffect, useState } from 'react';
import { authenticatedFetch } from '../utils/fetchUtils';
import { useAuth } from '../context/AuthContext';

const POLL_MS = 30_000;

export function markPartnerApplicationSeen(applicationId) {
  if (!applicationId) return Promise.resolve();
  return authenticatedFetch(`/api/freelancer-applications/${applicationId}/mark-seen`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
    .then((res) => {
      if (res.ok) window.dispatchEvent(new CustomEvent('partner-applications:changed'));
    })
    .catch(() => {});
}

export default function usePartnerNavUpdates() {
  const { user } = useAuth();
  const role = user?.role;
  const enabled = role === 'owner' || role === 'admin';
  const [newCount, setNewCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setNewCount(0);
      return;
    }
    try {
      const res = await authenticatedFetch('/api/freelancer-applications/unread-count', { cache: 'no-store' });
      if (!res.ok) return;
      const body = await res.json().catch(() => ({}));
      const count = Number(body?.count ?? 0);
      setNewCount(Number.isFinite(count) ? Math.max(0, count) : 0);
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
    window.addEventListener('partner-applications:changed', onRefresh);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
      window.removeEventListener('partner-applications:changed', onRefresh);
    };
  }, [refresh, enabled]);

  return newCount;
}
