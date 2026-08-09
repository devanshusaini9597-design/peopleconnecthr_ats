import React from 'react';
import {
  AlertTriangle, CheckSquare, ChevronLeft, ChevronRight, ClipboardList,
  Loader2, Square,
} from 'lucide-react';
import EmptyState from '../../ui/EmptyState';
import { PAGE_SIZE } from './workbenchConstants';
import { getReadiness, getRowIssues, initials } from './workbenchHelpers';
import StatusChip from './StatusChip';

export default function StagingQueue({
  isLoading,
  rows,
  selectedIds,
  activeId,
  page,
  total,
  totalPages,
  allSelected,
  onTogglePage,
  onToggleRow,
  onActivate,
  onChangePage,
  onOpenImport,
}) {
  if (isLoading) {
    return (
      <div data-tour="wb-queue" className="h-full min-h-[480px] flex flex-col items-center justify-center gap-3 bg-white">
        <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
        <p className="text-sm font-medium text-stone-500">Loading staging queue…</p>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div data-tour="wb-queue" className="h-full min-h-[480px] bg-white flex items-center justify-center p-6">
        <EmptyState
          icon={ClipboardList}
          tone="emerald"
          message="Queue is clear"
          subMessage="Flagged Bulk Import rows appear here until you release them into Candidates."
          action={(
            <button type="button" className="btn-primary" onClick={onOpenImport}>
              <ClipboardList className="w-4 h-4" /> Open Bulk Import
            </button>
          )}
        />
      </div>
    );
  }

  return (
    <div data-tour="wb-queue" className="flex flex-col h-full min-h-[480px] bg-white">
      <div className="px-3.5 sm:px-4 py-2.5 border-b border-stone-200 bg-stone-50/80 flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onTogglePage}
          className="inline-flex items-center justify-center text-stone-500 hover:text-brand-700"
          aria-label="Select page"
        >
          {allSelected
            ? <CheckSquare className="w-[18px] h-[18px] text-brand-600" />
            : <Square className="w-[18px] h-[18px]" />}
        </button>
        <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Staging queue</p>
        <span className="text-xs text-stone-400 tabular-nums ml-auto">
          {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()}
        </span>
      </div>

      <ul className="flex-1 overflow-y-auto divide-y divide-stone-100">
        {rows.map((row) => {
          const on = selectedIds.has(row._id);
          const active = activeId === row._id;
          const readiness = getReadiness(row);
          const issues = getRowIssues(row);
          return (
            <li key={row._id}>
              <div
                className={`flex items-stretch transition-colors ${
                  active ? 'bg-brand-50/70' : on ? 'bg-brand-50/35' : 'hover:bg-stone-50/90'
                }`}
              >
                <button
                  type="button"
                  className="px-3.5 py-3.5 shrink-0 self-center text-stone-400 hover:text-brand-700"
                  onClick={() => onToggleRow(row._id)}
                  aria-label={on ? 'Deselect' : 'Select'}
                >
                  {on
                    ? <CheckSquare className="w-[17px] h-[17px] text-brand-600" />
                    : <Square className="w-[17px] h-[17px]" />}
                </button>

                <button
                  type="button"
                  onClick={() => onActivate(row)}
                  className="flex-1 min-w-0 text-left pr-3.5 sm:pr-4 py-3.5"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-bold ${
                        active ? 'bg-brand-600 text-white' : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {initials(row.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-stone-900 truncate">
                          {row.name || 'Unnamed record'}
                        </p>
                        <StatusChip tone={readiness.tone}>{readiness.label}</StatusChip>
                      </div>
                      <p className="text-xs text-stone-500 mt-0.5 truncate">
                        {[row.email, row.companyName, row.position].filter(Boolean).join(' · ') || 'Missing identity fields'}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        {issues.length > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-700">
                            <AlertTriangle className="w-2.5 h-2.5" /> {issues.length} issue{issues.length === 1 ? '' : 's'}
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-emerald-700">No open issues</span>
                        )}
                        {row.rowIndex != null && (
                          <span className="text-[10px] text-stone-400">Import row #{row.rowIndex}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-stone-200 px-3.5 sm:px-4 py-2.5 flex items-center justify-between gap-2 bg-stone-50/60 shrink-0">
        <button
          type="button"
          className="btn-secondary !h-8 !text-xs !px-3"
          disabled={page <= 1}
          onClick={() => onChangePage(page - 1)}
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Prev
        </button>
        <span className="text-xs font-semibold text-stone-600 tabular-nums">{page} / {totalPages}</span>
        <button
          type="button"
          className="btn-secondary !h-8 !text-xs !px-3"
          disabled={page >= totalPages}
          onClick={() => onChangePage(page + 1)}
        >
          Next <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
