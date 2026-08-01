import React, { useState, useEffect, useCallback } from 'react';
import { ScrollText, Download, Filter, RefreshCw, Lock, ChevronLeft, ChevronRight, User as UserIcon } from 'lucide-react';
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
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md text-center bg-white border border-gray-200 rounded-2xl p-10 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Audit Log requires an upgrade</h2>
          <p className="text-gray-500 mt-2 text-sm">
            The Audit Log is available on Professional and Enterprise plans. Upgrade your plan to see who did what, and when.
          </p>
          <a href="/billing" className="inline-block mt-6 px-5 py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors">
            View Plans
          </a>
        </div>
      </div>
    );
  }

  return (
      <div className="min-h-screen bg-gray-50/50 p-6 pb-20">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                <ScrollText className="w-6 h-6 text-gray-400" /> Audit Log
              </h1>
              <p className="text-gray-500 mt-1 text-sm">A record of security-relevant actions taken across your organization.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchLogs(pagination.page)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Refresh
              </button>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 flex items-center gap-2 disabled:opacity-60"
                title={exportLocked ? 'CSV export requires the Enterprise plan' : 'Export as CSV'}
              >
                <Download className="w-4 h-4" /> {exporting ? 'Exporting…' : 'Export CSV'}
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
            <Filter className="w-4 h-4 text-gray-400 shrink-0" />
            <select
              value={filters.action}
              onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700"
            >
              <option value="">All actions</option>
              {filterOptions.actions.map((a) => <option key={a} value={a}>{formatAction(a)}</option>)}
            </select>
            <select
              value={filters.resource}
              onChange={(e) => setFilters((f) => ({ ...f, resource: e.target.value }))}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700"
            >
              <option value="">All resources</option>
              {filterOptions.resources.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700"
            />
            <span className="text-gray-400 text-sm">to</span>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700"
            />
            {(filters.action || filters.resource || filters.startDate || filters.endDate) && (
              <button
                onClick={() => setFilters({ action: '', resource: '', startDate: '', endDate: '' })}
                className="text-sm text-blue-600 hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 font-medium">
                <tr>
                  <th className="px-6 py-3">Timestamp</th>
                  <th className="px-6 py-3">Action</th>
                  <th className="px-6 py-3">Resource</th>
                  <th className="px-6 py-3">User</th>
                  <th className="px-6 py-3">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan="5" className="px-6 py-10 text-center text-gray-400">Loading…</td></tr>
                ) : entries.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-10 text-center text-gray-500">
                      <div className="flex flex-col items-center">
                        <ScrollText className="w-8 h-8 text-gray-300 mb-2" />
                        <p>No audit log entries yet.</p>
                        <p className="text-xs text-gray-400 mt-1">Actions like team changes and integration updates will show up here.</p>
                      </div>
                    </td>
                  </tr>
                ) : entries.map((entry) => (
                  <tr key={entry._id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-gray-500 whitespace-nowrap">{entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '—'}</td>
                    <td className="px-6 py-3 font-medium text-gray-900 capitalize">{formatAction(entry.action)}</td>
                    <td className="px-6 py-3 text-gray-600">{entry.resource}{entry.resourceId ? ` #${String(entry.resourceId).slice(-6)}` : ''}</td>
                    <td className="px-6 py-3 text-gray-600">
                      <span className="inline-flex items-center gap-1.5">
                        <UserIcon className="w-3.5 h-3.5 text-gray-400" />
                        {entry.userId?.name || entry.userId?.email || 'System'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-400">{entry.ipAddress || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>Page {pagination.page} of {pagination.pages} ({pagination.total} entries)</span>
              <div className="flex items-center gap-2">
                <button
                  disabled={pagination.page <= 1}
                  onClick={() => fetchLogs(pagination.page - 1)}
                  className="p-2 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={pagination.page >= pagination.pages}
                  onClick={() => fetchLogs(pagination.page + 1)}
                  className="p-2 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
  );
};

export default AuditLogPage;
