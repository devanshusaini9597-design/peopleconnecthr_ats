import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import { canViewOrgAnalytics } from '../utils/analyticsScope';
import BASE_API_URL from '../config';

export default function useEmployeeAnalyticsScope() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const canSelect = canViewOrgAnalytics(user?.role);
  const employeeParam = canSelect ? (searchParams.get('employee') || 'all') : 'all';
  const userId = canSelect && employeeParam !== 'all' ? employeeParam : '';

  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  useEffect(() => {
    if (!canSelect) {
      setEmployees([]);
      return undefined;
    }
    let cancelled = false;
    setLoadingEmployees(true);
    (async () => {
      try {
        const res = await authenticatedFetch(`${BASE_API_URL}/api/analytics/employees`);
        if (isUnauthorized(res)) {
          handleUnauthorized();
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        setEmployees(Array.isArray(data.employees) ? data.employees : []);
      } catch {
        if (!cancelled) setEmployees([]);
      } finally {
        if (!cancelled) setLoadingEmployees(false);
      }
    })();
    return () => { cancelled = true; };
  }, [canSelect]);

  const selectedEmployee = useMemo(
    () => employees.find((e) => String(e.id) === String(userId)) || null,
    [employees, userId]
  );

  const setEmployee = (id) => {
    const next = new URLSearchParams(searchParams);
    if (!id || id === 'all') next.delete('employee');
    else next.set('employee', id);
    setSearchParams(next, { replace: true });
  };

  return {
    canSelect,
    userId,
    employeeParam,
    employees,
    selectedEmployee,
    setEmployee,
    loadingEmployees,
  };
}
