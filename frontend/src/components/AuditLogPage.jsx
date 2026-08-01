import React, { useState, useEffect, useCallback } from 'react';
import { ScrollText, Download, Filter, RefreshCw, Lock, ChevronLeft, ChevronRight, User as UserIcon, Loader2 } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
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
      <div className="page-shell-ats">
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
    <div className="page-shell-ats">
      <PageHeader
        icon={ScrollText}
        title="Audit Log"
        subtitle="A record of security-relevant actions taken across your organization."
        gradientTitle
      >
        <button type="button" onClick={() => fetchLogs(pagination.page)} className="btn-secondary">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="btn-primary"
          title={exportLocked ? 'CSV export requires the Enterprise plan' : 'Export as CSV'}
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </PageHeader>

      <div className="card-ats-bordered p-4 flex flex-wrap items-center gap-3">
        <Filter className="w-4 h-4 text-stone-400 shrink-0" />
        <select
          value={filters.action}
          onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
          className="input-ats !w-full sm:!w-auto !py-1.5 !px-3"
        >
          <option value="">All actions</option>
          {filterOptions.actions.map((a) => <option key={a} value={a}>{formatAction(a)}</option>)}
        </select>
        <select
          value={filters.resource}
          onChange={(e) => setFilters((f) => ({ ...f, resource: e.target.value }))}
          className="input-ats !w-full sm:!w-auto !py-1.5 !px-3"
        >
          <option value="">All resources</option>
          {filterOptions.resources.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <input
          type="date"
          value={filters.startDate}
          onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
          className="input-ats !w-full sm:!w-auto !py-1.5 !px-3"
        />
        <span className="text-stone-400 text-sm hidden sm:inline">to</span>
        <input
          type="date"
          value={filters.endDate}
          onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
          className="input-ats !w-full sm:!w-auto !py-1.5 !px-3"
        />
        {(filters.action || filters.resource || filters.startDate || filters.endDate) && (
          <button
            type="button"
            onClick={() => setFilters({ action: '', resource: '', startDate: '', endDate: '' })}
            className="text-sm text-brand-600 hover:underline font-medium"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="table-shell-ats overflow-x-auto">
        <table className="w-full text-left text-sm min-w-[640px]">
          <thead className="bg-stone-50/80 text-stone-500 font-medium">
            <tr>
              <th className="px-4 sm:px-6 py-3">Timestamp</th>
              <th className="px-4 sm:px-6 py-3">Action</th>
              <th className="px-4 sm:px-6 py-3">Resource</th>
              <th className="px-4 sm:px-6 py-3">User</th>
              <th className="px-4 sm:px-6 py-3">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {loading ? (
              <tr>
                <td colSpan="5" className="px-6 py-12">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <Loader2 className="w-6 h-6 text-brand-600 animate-spin" />
                    <p className="text-sm text-stone-400">Loading audit log…</p>
                  </div>
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan="5">
                  <EmptyState
                    icon={ScrollText}
                    message="No audit log entries yet."
                    subMessage="Actions like team changes and integration updates will show up here."
                  />
                </td>
              </tr>
            ) : entries.map((entry) => (
              <tr key={entry._id} className="hover:bg-brand-50/20 transition-colors">
                <td className="px-4 sm:px-6 py-3 text-stone-500 whitespace-nowrap">
                  {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '—'}
                </td>
                <td className="px-4 sm:px-6 py-3">
                  <span className="badge-neutral capitalize">{formatAction(entry.action)}</span>
                </td>
                <td className="px-4 sm:px-6 py-3 text-stone-600">
                  <span className="badge-info">
                    {entry.resource}{entry.resourceId ? ` #${String(entry.resourceId).slice(-6)}` : ''}
                  </span>
                </td>
                <td className="px-4 sm:px-6 py-3 text-stone-600">
                  <span className="inline-flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-stone-400" />
                    {entry.userId?.name || entry.userId?.email || 'System'}
                  </span>
                </td>
                <td className="px-4 sm:px-6 py-3 text-stone-400 font-mono text-xs">{entry.ipAddress || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination.pages > 1 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-sm text-stone-500">
          <span>Page {pagination.page} of {pagination.pages} ({pagination.total} entries)</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => fetchLogs(pagination.page - 1)}
              className="btn-secondary !px-3 !py-2"
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <button
              type="button"
              disabled={pagination.page >= pagination.pages}
              onClick={() => fetchLogs(pagination.page + 1)}
              className="btn-secondary !px-3 !py-2"
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
