import React from 'react';
import {
  ChevronDown, ChevronLeft, ChevronRight, RefreshCw, ScrollText, Search, User as UserIcon,
} from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import { actionBadgeClass, formatAction } from './auditLogConstants';

export default function AuditLogTable({
  loading,
  loadError,
  visibleEntries,
  entries,
  query,
  expandedId,
  setExpandedId,
  pagination,
  fetchLogs,
}) {
  return (
    <>
      <div data-tour="audit-table" className="table-shell-ats relative overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[720px]">
            <thead className="bg-stone-50/90 text-stone-500 font-semibold text-xs uppercase tracking-wide border-b border-stone-100">
              <tr>
                <th className="px-4 sm:px-5 py-3.5 w-8" />
                <th className="px-4 sm:px-5 py-3.5">Timestamp</th>
                <th className="px-4 sm:px-5 py-3.5">Action</th>
                <th className="px-4 sm:px-5 py-3.5">Resource</th>
                <th className="px-4 sm:px-5 py-3.5">User</th>
                <th className="px-4 sm:px-5 py-3.5">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                [1, 2, 3, 4, 5, 6].map((i) => (
                  <tr key={i}>
                    <td className="px-4 sm:px-5 py-3.5"><div className="h-4 w-4 skeleton-ats rounded" /></td>
                    <td className="px-4 sm:px-5 py-3.5"><div className="h-4 w-32 skeleton-ats rounded-lg" /></td>
                    <td className="px-4 sm:px-5 py-3.5"><div className="h-5 w-24 skeleton-ats rounded-lg" /></td>
                    <td className="px-4 sm:px-5 py-3.5"><div className="h-5 w-20 skeleton-ats rounded-lg" /></td>
                    <td className="px-4 sm:px-5 py-3.5"><div className="h-4 w-28 skeleton-ats rounded-lg" /></td>
                    <td className="px-4 sm:px-5 py-3.5"><div className="h-4 w-20 skeleton-ats rounded-lg" /></td>
                  </tr>
                ))
              ) : loadError ? (
                <tr>
                  <td colSpan="6">
                    <EmptyState
                      icon={ScrollText}
                      tone="amber"
                      message="Couldn’t load audit log"
                      subMessage={loadError}
                      action={
                        <button type="button" onClick={() => fetchLogs(1)} className="btn-secondary">
                          <RefreshCw className="w-4 h-4" /> Retry
                        </button>
                      }
                    />
                  </td>
                </tr>
              ) : visibleEntries.length === 0 ? (
                <tr>
                  <td colSpan="6">
                    <EmptyState
                      icon={query ? Search : ScrollText}
                      tone="sky"
                      message={query ? 'No events match your search' : 'No audit log entries yet'}
                      subMessage={
                        query
                          ? 'Try a different term or clear the search box.'
                          : 'Actions like team changes and integration updates will show up here.'
                      }
                    />
                  </td>
                </tr>
              ) : visibleEntries.map((entry) => {
                const hasDetails = entry.details != null
                  && !(typeof entry.details === 'object' && Object.keys(entry.details).length === 0);
                const open = expandedId === entry._id;
                return (
                  <React.Fragment key={entry._id}>
                    <tr
                      className={`hover:bg-brand-50/30 transition-colors ${hasDetails ? 'cursor-pointer' : ''} ${open ? 'bg-brand-50/20' : ''}`}
                      onClick={() => hasDetails && setExpandedId(open ? null : entry._id)}
                    >
                      <td className="px-4 sm:px-5 py-3.5 text-stone-300">
                        {hasDetails ? (
                          <ChevronDown
                            size={14}
                            className={`transition-transform ${open ? 'rotate-180 text-brand-600' : ''}`}
                          />
                        ) : (
                          <span className="inline-block w-3.5" />
                        )}
                      </td>
                      <td className="px-4 sm:px-5 py-3.5 text-stone-500 whitespace-nowrap text-xs sm:text-sm tabular-nums">
                        {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 sm:px-5 py-3.5">
                        <span className={`inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-lg border capitalize whitespace-nowrap ${actionBadgeClass(entry.action)}`}>
                          {formatAction(entry.action)}
                        </span>
                      </td>
                      <td className="px-4 sm:px-5 py-3.5 text-stone-600">
                        <span className="inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-lg border bg-sky-50 text-sky-700 border-sky-100 whitespace-nowrap">
                          {entry.resource}
                          {entry.resourceId ? ` · ${String(entry.resourceId).slice(-6)}` : ''}
                        </span>
                      </td>
                      <td className="px-4 sm:px-5 py-3.5 text-stone-600">
                        <span className="inline-flex items-center gap-2 min-w-0">
                          <span className="w-7 h-7 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center flex-shrink-0 border border-brand-100">
                            <UserIcon className="w-3.5 h-3.5" />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-stone-800">
                              {entry.userId?.name || 'System'}
                            </span>
                            {entry.userId?.email && (
                              <span className="block truncate text-[11px] text-stone-400">{entry.userId.email}</span>
                            )}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 sm:px-5 py-3.5 text-stone-400 font-mono text-xs whitespace-nowrap">
                        {entry.ipAddress || '—'}
                      </td>
                    </tr>
                    {open && hasDetails && (
                      <tr className="bg-stone-50/80">
                        <td colSpan="6" className="px-4 sm:px-5 py-3">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400 mb-1.5">Details</p>
                          <pre className="text-xs text-stone-600 font-mono whitespace-pre-wrap break-all bg-white border border-stone-200 rounded-xl p-3 max-h-48 overflow-auto">
                            {typeof entry.details === 'string'
                              ? entry.details
                              : JSON.stringify(entry.details, null, 2)}
                          </pre>
                          {entry.userAgent && (
                            <p className="text-[11px] text-stone-400 mt-2 truncate">
                              User-Agent: {entry.userAgent}
                            </p>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {(pagination.pages > 1 || pagination.total > 0) && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-sm text-stone-500">
          <span className="font-medium text-center sm:text-left tabular-nums">
            Page {pagination.page} of {Math.max(1, pagination.pages)} · {pagination.total} entries
            {query && visibleEntries.length !== entries.length
              ? ` · ${visibleEntries.length} on this page match search`
              : ''}
          </span>
          {pagination.pages > 1 && (
            <div className="grid grid-cols-2 sm:flex items-center gap-2">
              <button
                type="button"
                disabled={pagination.page <= 1 || loading}
                onClick={() => fetchLogs(pagination.page - 1)}
                className="btn-secondary !px-3 !py-2 min-w-0"
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <button
                type="button"
                disabled={pagination.page >= pagination.pages || loading}
                onClick={() => fetchLogs(pagination.page + 1)}
                className="btn-secondary !px-3 !py-2 min-w-0"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
