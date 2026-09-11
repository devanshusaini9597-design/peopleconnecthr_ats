import React from 'react';
import {
  Loader2, Download, Trash2, Sparkles, Pencil, ChevronLeft, ChevronRight,
} from 'lucide-react';
import EmptyState from '../ui/EmptyState';

export default function PositionsCatalog({
  loading,
  rows,
  total,
  q,
  seeding,
  pagination,
  rangeFrom,
  rangeTo,
  onSeed,
  onClearSearch,
  onOpenEdit,
  onDelete,
  onPrevPage,
  onNextPage,
  isFreelancer,
}) {
  return (
    <div data-tour="positions-catalog" className="lg:col-span-8 min-w-0">
      <div className="card-ats-bordered relative overflow-hidden min-h-[32rem] flex flex-col">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <div className="relative px-4 sm:px-5 pt-5 pb-3 border-b border-stone-100 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-stone-900 tracking-tight">Positions catalog</h2>
            <p className="text-[11px] text-stone-400 mt-0.5">
              {loading
                ? 'Loading…'
                : rows.length === 0
                  ? 'Nothing in this view'
                  : `Page ${pagination.page} of ${pagination.pages} · ${rows.length} on this page`}
            </p>
          </div>
          <span className="badge-neutral text-[10px] flex-shrink-0">{total} total</span>
        </div>

        <div className="relative flex-1 flex flex-col p-4 sm:p-5 gap-3">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-12 skeleton-ats rounded-xl" />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex-1 flex flex-col justify-center">
              <EmptyState
                icon={Sparkles}
                tone="brand"
                message={total === 0 && !q ? 'No positions yet' : 'No matching positions'}
                subMessage={
                  total === 0 && !q
                    ? 'Load the starter set or add a role to get started.'
                    : 'Try a different search.'
                }
                action={
                  total === 0 && !q ? (
                    <button type="button" onClick={onSeed} className="btn-primary" disabled={seeding}>
                      {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      Load starter set
                    </button>
                  ) : (
                    <button type="button" className="btn-secondary" onClick={onClearSearch}>
                      Clear search
                    </button>
                  )
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-stone-100/90 rounded-2xl border border-stone-200/80 bg-white overflow-hidden">
              {rows.map((item) => {
                const canManage = !isFreelancer || item.isMine;
                const initials = String(item.name || '?')
                  .trim()
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase() || '?';
                return (
                  <li
                    key={item._id || item.name}
                    className="group flex items-center gap-2.5 sm:gap-3 px-3 sm:px-3.5 py-2.5 hover:bg-stone-50/90 min-w-0"
                  >
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600 text-[10px] font-bold tracking-wide group-hover:bg-stone-200/80">
                      {initials.slice(0, 2)}
                    </span>
                    <p className="flex-1 min-w-0 text-sm font-semibold text-stone-900 truncate uppercase tracking-wide">
                      {item.name}
                    </p>
                    {canManage && (
                      <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => onOpenEdit(item)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 hover:text-brand-700 hover:bg-brand-50"
                          title="Edit"
                          aria-label={`Edit ${item.name}`}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(item)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 hover:text-red-600 hover:bg-red-50"
                          title="Delete"
                          aria-label={`Delete ${item.name}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {pagination.total > 0 && (
          <div className="relative px-4 sm:px-5 py-3 border-t border-stone-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-stone-50/50">
            <span className="text-xs font-medium text-stone-500 text-center sm:text-left">
              Showing {rangeFrom}–{rangeTo} of {pagination.total}
            </span>
            <div className="grid grid-cols-2 sm:flex items-center gap-2">
              <button
                type="button"
                disabled={pagination.page <= 1 || loading}
                onClick={onPrevPage}
                className="btn-secondary !px-3 !py-2 min-w-0"
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <span className="hidden sm:inline text-xs font-semibold text-stone-600 px-2">
                {pagination.page} / {pagination.pages}
              </span>
              <button
                type="button"
                disabled={!pagination.hasMore || loading}
                onClick={onNextPage}
                className="btn-secondary !px-3 !py-2 min-w-0"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
