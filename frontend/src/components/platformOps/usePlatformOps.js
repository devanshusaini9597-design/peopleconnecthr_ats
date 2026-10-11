import { useCallback, useEffect, useRef, useState } from 'react';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../../utils/fetchUtils';
import { useToast } from '../Toast';

export default function usePlatformOps(view = 'live') {
  const toast = useToast();
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [hiddenShells, setHiddenShells] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [q, setQ] = useState('');
  const qRef = useRef(q);
  qRef.current = q;

  const load = useCallback(async (nextView = view, nextQ = qRef.current, opts = {}) => {
    const silent = Boolean(opts.silent);
    if (!silent) setLoading(true);
    try {
      const qs = new URLSearchParams({ view: nextView, limit: '50' });
      if (String(nextQ || '').trim()) qs.set('q', String(nextQ).trim());
      const [sumRes, listRes] = await Promise.all([
        authenticatedFetch('/api/platform/summary'),
        authenticatedFetch(`/api/platform/tenants?${qs}`),
      ]);
      if (isUnauthorized(sumRes) || isUnauthorized(listRes)) return handleUnauthorized();
      const sumJson = await sumRes.json();
      const listJson = await listRes.json();
      if (!sumRes.ok) throw new Error(sumJson.message || 'Could not load summary');
      if (!listRes.ok) throw new Error(listJson.message || 'Could not load workspaces');
      setSummary(sumJson.data || null);
      setRows(Array.isArray(listJson.data?.items) ? listJson.data.items : []);
      setHiddenShells(Number(listJson.data?.hiddenShells) || 0);
    } catch (err) {
      if (!silent) toast.error(err.message || 'Could not load platform console');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [view, toast]);

  useEffect(() => { load(view, qRef.current); }, [view, load]);

  useEffect(() => {
    const id = window.setInterval(() => load(view, qRef.current, { silent: true }), 30000);
    const onVis = () => {
      if (document.visibilityState === 'visible') load(view, qRef.current, { silent: true });
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [view, load]);

  const patch = async (id, body) => {
    setSavingId(id);
    try {
      const res = await authenticatedFetch(`/api/platform/tenants/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (isUnauthorized(res)) return handleUnauthorized();
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not update workspace');
      setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...data.data } : row)).filter((row) => {
        if (view === 'live') return !row.archived && !row.isEmptyShell && row.kind !== 'platform';
        return true;
      }));
      toast.success('Saved');
      load(view, q);
      return data.data;
    } catch (err) {
      toast.error(err.message || 'Could not update workspace');
      return null;
    } finally {
      setSavingId('');
    }
  };

  return { summary, rows, hiddenShells, loading, savingId, q, setQ, load, patch };
}
