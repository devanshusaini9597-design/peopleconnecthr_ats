import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ScrollText, Download, RefreshCw, Lock, Loader2 } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import usePageTour from '../hooks/usePageTour';
import { authenticatedFetch, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';
import { AUDIT_TOUR_KEY, AUDIT_TOUR_STEPS, formatAction } from './auditLog/auditLogConstants';
import AuditLogFilters from './auditLog/AuditLogFilters';
import AuditLogTable from './auditLog/AuditLogTable';

const AuditLogPage = () => {
  const toast = useToast();
  const [tourOpen, setTourOpen] = usePageTour(AUDIT_TOUR_KEY);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [exportLocked, setExportLocked] = useState(false);
  const [entries, setEntries] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 1 });
  const [filters, setFilters] = useState({ action: '', resource: '', startDate: '', endDate: '' });
  const [query, setQuery] = useState('');
  const [filterOptions, setFilterOptions] = useState({ actions: [], resources: [] });
  const [exporting, setExporting] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const lastErrorToast = useRef('');

  const actionOptions = useMemo(() => [
    { value: '', label: 'All actions' },
    ...filterOptions.actions.map((a) => ({
      value: a,
      label: formatAction(a),
      description: a,
    })),
  ], [filterOptions.actions]);

  const resourceOptions = useMemo(() => [
    { value: '', label: 'All resources' },
    ...filterOptions.resources.map((r) => ({
      value: r,
      label: r,
    })),
  ], [filterOptions.resources]);

  const hasActiveFilters = !!(filters.action || filters.resource || filters.startDate || filters.endDate);

  const visibleEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => {
      const hay = [
        e.action,
        e.resource,
        e.resourceId,
        e.ipAddress,
        e.userId?.name,
        e.userId?.email,
        typeof e.details === 'string' ? e.details : JSON.stringify(e.details || ''),
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [entries, query]);

  const fetchDistinct = useCallback(async () => {
    try {
      const res = await authenticatedFetch('/api/organization/audit-log/distinct');
      if (res.status === 401) return handleUnauthorized();
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) setFilterOptions({ actions: data.actions || [], resources: data.resources || [] });
    } catch {
      /* best-effort */
    }
  }, []);

  const fetchLogs = useCallback(async (page = 1) => {
    setLoading(true);
    setUpgradeRequired(false);
    setLoadError(null);
    setExpandedId(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(pagination.limit) });
      if (filters.action) params.set('action', filters.action);
      if (filters.resource) params.set('resource', filters.resource);
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);

      const res = await authenticatedFetch(`/api/organization/audit-log?${params.toString()}`);
      if (res.status === 401) return handleUnauthorized();
      const data = await res.json();
      if (res.status === 403 && data.code === 'UPGRADE_REQUIRED') {
        setUpgradeRequired(true);
        return;
      }
      if (data.success) {
        setEntries(data.data || []);
        setPagination(data.pagination || { page, limit: pagination.limit, total: 0, pages: 1 });
        lastErrorToast.current = '';
      } else {
        const msg = data.message || 'Failed to load audit log';
        setLoadError(msg);
        setEntries([]);
        if (lastErrorToast.current !== msg) {
          lastErrorToast.current = msg;
          toast?.error?.(msg);
        }
      }
    } catch {
      const msg = 'Failed to load audit log';
      setLoadError(msg);
      setEntries([]);
      if (lastErrorToast.current !== msg) {
        lastErrorToast.current = msg;
        toast?.error?.(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.limit]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchDistinct(); }, [fetchDistinct]);
  useEffect(() => { fetchLogs(1); }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExport = async () => {
    setExporting(true);
    setExportLocked(false);
    try {
      const params = new URLSearchParams();
      if (filters.action) params.set('action', filters.action);
      if (filters.resource) params.set('resource', filters.resource);
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);

      const res = await authenticatedFetch(`/api/organization/audit-log/export?${params.toString()}`);
      if (res.status === 401) return handleUnauthorized();
      if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
        if (data.code === 'UPGRADE_REQUIRED') {
          setExportLocked(true);
          toast?.error?.('CSV export requires the Enterprise plan.');
          return;
        }
      }
      if (!res.ok) {
        toast?.error?.('Export failed');
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast?.success?.('Audit log exported');
    } catch {
      toast?.error?.('Export failed');
    } finally {
      setExporting(false);
    }
  };

  if (upgradeRequired) {
    return (
      <div className="page-shell-ats animate-page-enter">
        <div className="min-h-[60vh] flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center card-ats-bordered border-amber-200/80 bg-amber-50/40 p-8 sm:p-10 animate-slide-up">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4 ring-4 ring-amber-100/60">
              <Lock className="w-7 h-7 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-stone-900 tracking-tight">Audit Log requires an upgrade</h2>
            <p className="text-stone-500 mt-2 text-sm leading-relaxed">
              Available on Professional and Enterprise — see who did what, and when, across your org.
            </p>
            <a href="/billing" className="btn-primary inline-flex mt-6">View Plans</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell-ats animate-page-enter">
      <PageHeader
        icon={ScrollText}
        title="Audit Log"
        subtitle="Security-relevant actions across your organization."
        gradientTitle
      >
        <button
          type="button"
          onClick={() => fetchLogs(pagination.page)}
          className="h-10 w-10 inline-flex items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 hover:text-brand-600 hover:border-brand-300"
          title="Refresh"
          aria-label="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="btn-primary flex-1 sm:flex-none"
          title={exportLocked ? 'CSV export requires the Enterprise plan' : 'Export as CSV'}
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </PageHeader>

      <AuditLogFilters
        query={query}
        setQuery={setQuery}
        filters={filters}
        setFilters={setFilters}
        actionOptions={actionOptions}
        resourceOptions={resourceOptions}
        hasActiveFilters={hasActiveFilters}
        pagination={pagination}
        filterOptions={filterOptions}
      />

      <AuditLogTable
        loading={loading}
        loadError={loadError}
        visibleEntries={visibleEntries}
        entries={entries}
        query={query}
        expandedId={expandedId}
        setExpandedId={setExpandedId}
        pagination={pagination}
        fetchLogs={fetchLogs}
      />

      <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title="Take a tour of Audit Log" />
      <ProductTour
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        steps={AUDIT_TOUR_STEPS}
        storageKey={AUDIT_TOUR_KEY}
      />
    </div>
  );
};

export default AuditLogPage;
