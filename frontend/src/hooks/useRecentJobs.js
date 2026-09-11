import { useCallback, useEffect, useState } from 'react';
import { authenticatedFetch } from '../utils/fetchUtils';
import { useAuth } from '../context/AuthContext';

const POLL_MS = 60_000;

/** Recent open jobs for dashboard widget */
export default function useRecentJobs(limit = 5) {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const enabled = user?.role && user.role !== 'freelancer';

  const refresh = useCallback(async () => {
    if (!enabled) {
      setRows([]);
      setLoading(false);
      return;
    }
    try {
      const res = await authenticatedFetch(`/api/jobs/recent?limit=${limit}`, { cache: 'no-store' });
      if (!res.ok) return;
      const body = await res.json().catch(() => ({}));
      if (body.success) setRows(body.data || []);
      else if (Array.isArray(body)) setRows(body);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [enabled, limit]);

  useEffect(() => {
    setLoading(true);
    refresh();
    if (!enabled) return undefined;
    const id = window.setInterval(refresh, POLL_MS);
    const onChanged = () => { refresh(); };
    window.addEventListener('jobs:changed', onChanged);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('jobs:changed', onChanged);
    };
  }, [refresh, enabled]);

  return { rows, loading, enabled };
}
