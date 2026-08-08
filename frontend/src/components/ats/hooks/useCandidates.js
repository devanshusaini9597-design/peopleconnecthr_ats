import { useState, useEffect, useCallback } from 'react';
import { authenticatedFetch, readApiJson } from '../../utils/fetchUtils';
import { BASE_API_URL } from '../../config';

/**
 * Fetch + paginate candidates for the ATS board.
 */
export function useCandidates(filters = {}, page = 1, pageSize = 50) {
  const [candidates, setCandidates] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });
      Object.entries(filters || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.set(key, String(value));
        }
      });
      const res = await authenticatedFetch(`${BASE_API_URL}/candidates?${params}`);
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.message || 'Failed to load candidates');
      setCandidates(data.candidates || data || []);
      setTotalCount(data.total || data.totalCount || (data.candidates || []).length);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  return { candidates, totalCount, loading, error, refetch: fetchCandidates };
}
