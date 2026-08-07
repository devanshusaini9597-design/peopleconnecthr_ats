import { useCallback } from 'react';
import API_URL from '../../config';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../../utils/fetchUtils';
import { normalizeApp } from './constants';

export function useApplicationsData({ setJobs, setApplications, setStats, setLoading, showToast }) {
  const fetchJobs = useCallback(async () => {
    try {
      const res = await authenticatedFetch(`${API_URL}/jobs?isTemplate=false`);
      if (isUnauthorized(res)) return handleUnauthorized();
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data?.data || []);
        setJobs(list.filter((j) => j.status !== 'Closed' && j.status !== 'Cancelled'));
      }
    } catch (err) {
      console.error('Error fetching jobs:', err);
    }
  }, [setJobs]);

  const fetchStats = useCallback(async (jobId) => {
    try {
      const q = jobId ? `?jobId=${jobId}` : '';
      const res = await authenticatedFetch(`${API_URL}/api/applications/stats${q}`);
      if (isUnauthorized(res)) return handleUnauthorized();
      if (res.ok) {
        const json = await res.json();
        const data = json?.data || json || {};
        setStats({
          total: data.total ?? 0,
          byStage: data.byStage || {},
          avgTime: data.avgTime || 'N/A',
        });
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, [setStats]);

  const fetchApplications = useCallback(async (jobId) => {
    setLoading(true);
    try {
      const res = await authenticatedFetch(`${API_URL}/api/applications?jobId=${jobId}&limit=200`);
      if (isUnauthorized(res)) return handleUnauthorized();
      if (res.ok) {
        const json = await res.json();
        const list = Array.isArray(json) ? json : (json?.data || []);
        setApplications(list.map(normalizeApp).filter(Boolean));
      }
    } catch (err) {
      console.error('Error fetching apps:', err);
      showToast('Failed to load applications', 'error');
    } finally {
      setLoading(false);
    }
  }, [setLoading, setApplications, showToast]);

  return { fetchJobs, fetchStats, fetchApplications };
}
