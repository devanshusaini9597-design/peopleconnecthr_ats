import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ScrollText, Download, Filter, RefreshCw, Lock, ChevronLeft, ChevronRight, User as UserIcon, Loader2, Calendar } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import PremiumSelect from './ui/PremiumSelect';
import { authenticatedFetch, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';

const formatAction = (action) => (action || '').replace(/\./g, ' ').replace(/_/g, ' ');

const AuditLogPage = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [exportLocked, setExportLocked] = useState(false);
  const [entries, setEntries] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 1 });
  const [filters, setFilters] = useState({ action: '', resource: '', startDate: '', endDate: '' });
  const [filterOptions, setFilterOptions] = useState({ actions: [], resources: [] });
  const [exporting, setExporting] = useState(false);

  const actionOptions = useMemo(() => [
    { value: '', label: 'All actions', description: 'No filter' },
    ...filterOptions.actions.map((a) => ({
      value: a,
      label: formatAction(a),
      description: a,
    })),
  ], [filterOptions.actions]);

  const resourceOptions = useMemo(() => [
    { value: '', label: 'All resources', description: 'No filter' },
    ...filterOptions.resources.map((r) => ({
      value: r,
      label: r,
    })),
  ], [filterOptions.resources]);

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
        setPagination(data.pagination || pagination);
      } else {
        toast?.error?.(data.message || 'Failed to load audit log');
      }
    } catch (err) {
      toast?.error?.('Failed to load audit log');
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
    } catch (err) {
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
              The Audit Log is available on Professional and Enterprise plans. Upgrade your plan to see who did what, and when.
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
        <button type="button" onClick={() => fetchLogs(pagination.page)} className="btn-secondary flex-1 sm:flex-none">
          <RefreshCw className="w-4 h-4" /> Refresh
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

      <div className="toolbar-ats flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 px-1">
            <Filter size={14} /> Filters
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <PremiumSelect
            value={filters.action}
            onChange={(v) => setFilters((f) => ({ ...f, action: v || '' }))}
            options={actionOptions}
            placeholder="All actions"
            searchable
            searchPlaceholder="Search actions…"
            compact
          />
          <PremiumSelect
            value={filters.resource}
            onChange={(v) => setFilters((f) => ({ ...f, resource: v || '' }))}
            options={resourceOptions}
            placeholder="All resources"
            searchable
            searchPlaceholder="Search resources…"
            compact
          />
          <div className="relative min-w-0">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
              className="input-ats !pl-10"
              aria-label="Start date"
            />
          </div>
          <div className="relative min-w-0">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
              className="input-ats !pl-10"
              aria-label="End date"
            />
          </div>
        </div>
        {(filters.action || filters.resource || filters.startDate || filters.endDate) && (
          <button
            type="button"
            onClick={() => setFilters({ action: '', resource: '', startDate: '', endDate: '' })}
            className="text-sm text-brand-600 hover:text-brand-700 font-semibold self-start"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="table-shell-ats relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[640px]">
            <thead className="bg-stone-50/90 text-stone-500 font-semibold text-xs uppercase tracking-wide border-b border-stone-100">
              <tr>
                <th className="px-4 sm:px-6 py-3.5">Timestamp</th>
                <th className="px-4 sm:px-6 py-3.5">Action</th>
                <th className="px-4 sm:px-6 py-3.5">Resource</th>
                <th className="px-4 sm:px-6 py-3.5">User</th>
                <th className="px-4 sm:px-6 py-3.5">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                [1, 2, 3, 4, 5].map((i) => (
                  <tr key={i}>
                    <td className="px-4 sm:px-6 py-3.5"><div className="h-4 w-32 skeleton-ats rounded-lg" /></td>
                    <td className="px-4 sm:px-6 py-3.5"><div className="h-5 w-24 skeleton-ats rounded-lg" /></td>
                    <td className="px-4 sm:px-6 py-3.5"><div className="h-5 w-20 skeleton-ats rounded-lg" /></td>
                    <td className="px-4 sm:px-6 py-3.5"><div className="h-4 w-28 skeleton-ats rounded-lg" /></td>
                    <td className="px-4 sm:px-6 py-3.5"><div className="h-4 w-20 skeleton-ats rounded-lg" /></td>
                  </tr>
                ))
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan="5">
                    <EmptyState
                      icon={ScrollText}
                      tone="sky"
                      message="No audit log entries yet"
                      subMessage="Actions like team changes and integration updates will show up here."
                    />
                  </td>
                </tr>
              ) : entries.map((entry) => (
                <tr key={entry._id} className="hover:bg-brand-50/30 transition-colors">
                  <td className="px-4 sm:px-6 py-3.5 text-stone-500 whitespace-nowrap text-xs sm:text-sm">
                    {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 sm:px-6 py-3.5">
                    <span className="badge-neutral capitalize">{formatAction(entry.action)}</span>
                  </td>
                  <td className="px-4 sm:px-6 py-3.5 text-stone-600">
                    <span className="badge-info">
                      {entry.resource}{entry.resourceId ? ` #${String(entry.resourceId).slice(-6)}` : ''}
                    </span>
                  </td>
                  <td className="px-4 sm:px-6 py-3.5 text-stone-600">
                    <span className="inline-flex items-center gap-1.5 min-w-0">
                      <span className="w-7 h-7 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center flex-shrink-0 border border-brand-100">
                        <UserIcon className="w-3.5 h-3.5" />
                      </span>
                      <span className="truncate text-sm font-medium">{entry.userId?.name || entry.userId?.email || 'System'}</span>
                    </span>
                  </td>
                  <td className="px-4 sm:px-6 py-3.5 text-stone-400 font-mono text-xs">{entry.ipAddress || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {pagination.pages > 1 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-sm text-stone-500">
          <span className="font-medium text-center sm:text-left">Page {pagination.page} of {pagination.pages} ({pagination.total} entries)</span>
          <div className="grid grid-cols-2 sm:flex items-center gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => fetchLogs(pagination.page - 1)}
              className="btn-secondary !px-3 !py-2 min-w-0"
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <button
              type="button"
              disabled={pagination.page >= pagination.pages}
              onClick={() => fetchLogs(pagination.page + 1)}
              className="btn-secondary !px-3 !py-2 min-w-0"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogPage;
