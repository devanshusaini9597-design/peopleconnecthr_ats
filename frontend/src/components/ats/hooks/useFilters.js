import { useMemo, useState, useCallback } from 'react';

/**
 * Shared filter state for the ATS candidate list.
 */
export function useFilters(initial = {}) {
  const [filters, setFilters] = useState({
    search: '',
    position: '',
    location: '',
    companyName: '',
    ...initial,
  });

  const setFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      search: '',
      position: '',
      location: '',
      companyName: '',
      ...initial,
    });
  }, [initial]);

  const activeCount = useMemo(
    () => Object.values(filters).filter((v) => v !== undefined && v !== null && String(v).trim() !== '').length,
    [filters]
  );

  return { filters, setFilters, setFilter, resetFilters, activeCount };
}
