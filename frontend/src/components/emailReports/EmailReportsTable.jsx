import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Columns3,
  ChevronRight,
  Loader2,
  Check,
} from 'lucide-react';
import {
  TABLE_COLUMNS,
  METRIC_LABELS,
  defaultVisibleColumnIds,
  loadVisibleColumns,
  saveVisibleColumns,
} from './emailReportsConstants';

const STATUS_STYLES = {
  accepted: 'bg-sky-50 text-sky-800 ring-sky-200/80',
  sending: 'bg-amber-50 text-amber-800 ring-amber-200/80',
  sent: 'bg-stone-100 text-stone-700 ring-stone-200/80',
  delivered: 'bg-emerald-50 text-emerald-800 ring-emerald-200/80',
  opened: 'bg-teal-50 text-teal-800 ring-teal-200/80',
  clicked: 'bg-indigo-50 text-indigo-800 ring-indigo-200/80',
  completed: 'bg-emerald-50 text-emerald-800 ring-emerald-200/80',
  partial: 'bg-amber-50 text-amber-800 ring-amber-200/80',
  failed: 'bg-rose-50 text-rose-800 ring-rose-200/80',
  bounced: 'bg-rose-50 text-rose-800 ring-rose-200/80',
  soft_bounced: 'bg-orange-50 text-orange-800 ring-orange-200/80',
  hard_bounced: 'bg-rose-50 text-rose-900 ring-rose-300/80',
  unsubscribed: 'bg-stone-100 text-stone-600 ring-stone-200/80',
  spam: 'bg-rose-50 text-rose-700 ring-rose-200/80',
  unopened: 'bg-stone-50 text-stone-500 ring-stone-200/80',
  replied: 'bg-violet-50 text-violet-800 ring-violet-200/80',
  queued: 'bg-stone-50 text-stone-500 ring-stone-200/80',
};

function Badge({ children, tone = 'sent' }) {
  const cls = STATUS_STYLES[tone] || STATUS_STYLES.sent;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${cls}`}>
      {String(children || '').replace(/_/g, ' ')}
    </span>
  );
}

function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function cellValue(row, colId) {
  const t = row.totals || {};
  switch (colId) {
    case 'sentAt':
      return <span className="whitespace-nowrap text-stone-600">{fmtDate(row.sentAt)}</span>;
    case 'subject':
      return (
        <div className="min-w-[200px] max-w-xs">
          <div className="truncate font-semibold text-stone-900">
            {row.subject || row.campaignName || '—'}
          </div>
          <div className="truncate text-xs text-stone-500">
            {row.fromEmail || '—'}
            {row.sentByUserId?.name ? ` · ${row.sentByUserId.name}` : ''}
          </div>
        </div>
      );
    case 'channel':
      return <span className="capitalize font-medium text-stone-800">{row.channel || '—'}</span>;
    case 'provider':
      return (
        <span className="capitalize text-stone-700">
          {(row.provider || '').replace(/_/g, ' ') || '—'}
        </span>
      );
    case 'status':
      return <Badge tone={row.status}>{row.status}</Badge>;
    case 'from':
      return <span className="break-all text-stone-700">{row.fromEmail || '—'}</span>;
    case 'sentBy':
      return (
        <span className="text-stone-700">
          {row.sentByUserId?.name || row.sentByUserId?.email || '—'}
        </span>
      );
    case 'sent':
      return <span className="font-semibold tabular-nums text-stone-900">{t.sent ?? 0}</span>;
    case 'delivered':
      return <span className="tabular-nums text-emerald-800">{t.delivered ?? 0}</span>;
    case 'opened':
      return <span className="tabular-nums text-teal-800">{t.opened ?? 0}</span>;
    case 'clicked':
      return <span className="tabular-nums text-indigo-800">{t.clicked ?? 0}</span>;
    case 'bounced':
      return <span className="tabular-nums text-amber-800">{t.bounced ?? 0}</span>;
    case 'replied':
      return <span className="tabular-nums text-violet-800">{t.replied ?? 0}</span>;
    case 'failed':
      return <span className="tabular-nums text-rose-800">{t.failed ?? 0}</span>;
    default:
      return '—';
  }
}

export default function EmailReportsTable({
  items,
  loading,
  error,
  activeTab,
  activeMeta,
  metricFilter = 'all',
  pagination,
  onPageChange,
  onOpenDetail,
}) {
  const tableScrollRef = useRef(null);
  const dragScrollRef = useRef({ active: false, moved: false, startX: 0, scrollLeft: 0 });
  const [visibleIds, setVisibleIds] = useState(() => loadVisibleColumns());
  const [columnsOpen, setColumnsOpen] = useState(false);

  useEffect(() => {
    saveVisibleColumns(visibleIds);
  }, [visibleIds]);

  const orderedColumns = useMemo(
    () => TABLE_COLUMNS.filter((c) => visibleIds.includes(c.id)),
    [visibleIds]
  );

  const lockedIds = useMemo(
    () => TABLE_COLUMNS.filter((c) => c.locked).map((c) => c.id),
    []
  );

  const toggleColumn = (id) => {
    const col = TABLE_COLUMNS.find((c) => c.id === id);
    if (col?.locked) return;
    setVisibleIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 2) return prev;
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  };

  const selectAllColumns = () => {
    setVisibleIds(TABLE_COLUMNS.map((c) => c.id));
  };

  const clearAllColumns = () => {
    setVisibleIds([...lockedIds]);
  };

  const resetColumns = () => {
    setVisibleIds(defaultVisibleColumnIds());
  };

  const isClickOnScrollbar = (el, e) => {
    const rect = el.getBoundingClientRect();
    const canScrollX = el.scrollWidth > el.clientWidth;
    const canScrollY = el.scrollHeight > el.clientHeight;
    const hBar = Math.max(el.offsetHeight - el.clientHeight, 0);
    const vBar = Math.max(el.offsetWidth - el.clientWidth, 0);
    if (canScrollX && e.clientY >= rect.bottom - Math.max(hBar, 16)) return true;
    if (canScrollY && e.clientX >= rect.right - Math.max(vBar, 16)) return true;
    return false;
  };

  const onTableDragScrollStart = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('button, a, input, select, textarea, label, [role="button"]')) return;
    if (!e.target.closest('td, th, .email-reports-drag')) return;
    const el = tableScrollRef.current;
    if (!el) return;
    if (isClickOnScrollbar(el, e)) return;
    dragScrollRef.current = { active: true, moved: false, startX: e.pageX, scrollLeft: el.scrollLeft };
    el.dataset.dragging = '1';
  };

  const onTableDragScrollMove = (e) => {
    const state = dragScrollRef.current;
    if (!state.active) return;
    const el = tableScrollRef.current;
    if (!el) return;
    e.preventDefault();
    const dx = e.pageX - state.startX;
    if (Math.abs(dx) > 3) state.moved = true;
    el.scrollLeft = state.scrollLeft - dx;
  };

  const onTableDragScrollEnd = () => {
    const state = dragScrollRef.current;
    if (!state.active) return;
    state.active = false;
    const el = tableScrollRef.current;
    if (el) delete el.dataset.dragging;
  };

  const colSpan = orderedColumns.length + 1;
  const metricLabel =
    metricFilter && metricFilter !== 'all'
      ? METRIC_LABELS[metricFilter] || metricFilter
      : null;

  return (
    <div data-tour="email-reports-table" className="card-ats-bordered relative min-w-0 overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />

      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold tracking-tight text-stone-900">
            {activeMeta.label} history
            {metricLabel ? (
              <span className="ml-2 text-xs font-semibold text-brand-700">· {metricLabel}</span>
            ) : null}
          </h3>
          <p className="text-xs text-stone-500">
            Drag horizontally to scroll · absolute counts only
          </p>
        </div>

        <div className="relative shrink-0" data-tour="email-reports-columns">
          <button
            type="button"
            className="btn-secondary inline-flex items-center gap-2"
            onClick={() => setColumnsOpen((o) => !o)}
            aria-expanded={columnsOpen}
          >
            <Columns3 size={16} />
            Columns
          </button>
          {columnsOpen && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-10 cursor-default"
                aria-label="Close columns"
                onClick={() => setColumnsOpen(false)}
              />
              <div className="absolute right-0 z-20 mt-2 w-72 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl">
                <div className="border-b border-stone-100 bg-stone-50 px-3 py-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
                    Show fields
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={selectAllColumns}
                      className="rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={clearAllColumns}
                      className="rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50"
                    >
                      Uncheck all
                    </button>
                    <button
                      type="button"
                      onClick={resetColumns}
                      className="rounded-lg bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-800 ring-1 ring-brand-200 hover:bg-brand-100"
                    >
                      Reset
                    </button>
                  </div>
                </div>
                <ul className="max-h-72 overflow-y-auto py-1">
                  {TABLE_COLUMNS.map((col) => {
                    const on = visibleIds.includes(col.id);
                    const Icon = col.icon;
                    return (
                      <li key={col.id}>
                        <button
                          type="button"
                          disabled={col.locked && on}
                          onClick={() => toggleColumn(col.id)}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-stone-50 disabled:opacity-60"
                        >
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded border ${
                              on
                                ? 'border-brand-500 bg-brand-500 text-white'
                                : 'border-stone-300 bg-white text-transparent'
                            }`}
                          >
                            <Check size={12} strokeWidth={3} />
                          </span>
                          <Icon size={14} className="shrink-0 text-stone-400" />
                          <span className="font-medium text-stone-800">{col.label}</span>
                          {col.locked ? (
                            <span className="ml-auto text-[10px] font-semibold uppercase text-stone-400">
                              Required
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>

      <div
        ref={tableScrollRef}
        className="cand-table-scroll min-w-0 overflow-x-auto select-none"
        onMouseDown={onTableDragScrollStart}
        onMouseMove={onTableDragScrollMove}
        onMouseUp={onTableDragScrollEnd}
        onMouseLeave={onTableDragScrollEnd}
      >
        <table
          className="email-reports-drag w-max min-w-full border-collapse border border-stone-200 text-left text-sm select-text"
          role="table"
          aria-label="Email reports history"
        >
          <thead>
            <tr className="bg-stone-100">
              {orderedColumns.map((col) => {
                const Icon = col.icon;
                return (
                  <th
                    key={col.id}
                    scope="col"
                    className="whitespace-nowrap border border-stone-200 bg-stone-100 px-3.5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-stone-600"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Icon size={12} className="text-brand-600" strokeWidth={2.25} />
                      {col.label}
                    </span>
                  </th>
                );
              })}
              <th
                scope="col"
                className="whitespace-nowrap border border-stone-200 bg-stone-100 px-3.5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-stone-600"
              >
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={colSpan} className="border border-stone-200 px-4 py-12 text-center text-stone-500">
                  <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-brand-600" />
                  Loading {activeMeta.short.toLowerCase()} reports…
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && !error && (
              <tr>
                <td colSpan={colSpan} className="border border-stone-200 px-4 py-12 text-center text-stone-500">
                  {metricLabel
                    ? `No sends with ${metricLabel.toLowerCase()} activity for this filter.`
                    : activeTab === 'marketing'
                      ? 'No marketing campaigns logged yet. Send a campaign, then Refresh from Zoho.'
                      : activeTab === 'transactional'
                        ? 'No transactional sends yet. Email a candidate to see ZeptoMail tracking here.'
                        : 'No tracked sends yet. Send mail from the ATS, then refresh.'}
                </td>
              </tr>
            )}
            {!loading &&
              items.map((row, index) => (
                <tr
                  key={row._id}
                  className={`transition-colors hover:bg-brand-50/40 ${
                    index % 2 === 0 ? 'bg-white' : 'bg-stone-50/50'
                  }`}
                >
                  {orderedColumns.map((col) => (
                    <td key={col.id} className="border border-stone-200 px-3.5 py-3 align-middle">
                      {cellValue(row, col.id)}
                    </td>
                  ))}
                  <td className="border border-stone-200 px-3.5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onOpenDetail(row._id)}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-900"
                    >
                      Details <ChevronRight className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {pagination.pages > 1 && (
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-stone-100 px-4 py-3 text-sm">
          <span className="text-stone-500">
            Page {pagination.page} of {pagination.pages} · {pagination.total} sends
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary px-3 py-1.5"
              disabled={pagination.page <= 1}
              onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn-secondary px-3 py-1.5"
              disabled={pagination.page >= pagination.pages}
              onClick={() => onPageChange(pagination.page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
