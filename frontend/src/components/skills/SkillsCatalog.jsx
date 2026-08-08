import React from 'react';
import {
  Loader2, Download, Trash2, Sparkles, Pencil, ChevronLeft, ChevronRight
} from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import SkillsGuide from './SkillsGuide';

export default function SkillsCatalog({
  loading,
  skills,
  grouped,
  counts,
  q,
  category,
  source,
  seeding,
  pagination,
  rangeFrom,
  rangeTo,
  showGuide,
  onSeed,
  onClearFilters,
  onOpenEdit,
  onDelete,
  onPrevPage,
  onNextPage,
}) {
  return (
    <div data-tour="skills-catalog" className="lg:col-span-8 min-w-0">
      <div className="card-ats-bordered relative overflow-hidden min-h-[32rem] flex flex-col">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <div className="relative px-4 sm:px-5 pt-5 pb-3 border-b border-stone-100 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-stone-900 tracking-tight">Skills catalog</h2>
            <p className="text-[11px] text-stone-400 mt-0.5">
              {loading
                ? 'Loading…'
                : skills.length === 0
                  ? 'Nothing in this view'
                  : `Page ${pagination.page} of ${pagination.pages} · ${skills.length} on this page`}
            </p>
          </div>
          <span className="badge-neutral text-[10px] flex-shrink-0 capitalize">{source}</span>
        </div>

        <div className="relative flex-1 flex flex-col p-4 sm:p-5 gap-3">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-28 skeleton-ats rounded-2xl" />)}
            </div>
          ) : skills.length === 0 ? (
            <div className="flex-1 flex flex-col justify-center">
              <EmptyState
                icon={Sparkles}
                tone="brand"
                message={counts.total === 0 && !q && !category && source === 'all' ? 'No skills yet' : 'No matching skills'}
                subMessage={
                  counts.total === 0 && !q && !category && source === 'all'
                    ? 'Import the starter catalog or add a custom skill to get started.'
                    : 'Try a different search, source, or category filter.'
                }
                action={
                  counts.total === 0 && !q && !category && source === 'all' ? (
                    <button type="button" onClick={onSeed} className="btn-primary" disabled={seeding}>
                      {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      Import catalog
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={onClearFilters}
                    >
                      Clear filters
                    </button>
                  )
                }
              />
              {counts.total === 0 && !q && !category && source === 'all' && (
                <div className="mt-2">
                  <SkillsGuide />
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {grouped.map(([cat, rows]) => (
                  <section
                    key={cat}
                    className="rounded-2xl border border-stone-200/80 bg-white overflow-hidden shadow-sm"
                  >
                    <div className="px-4 py-3 border-b border-stone-100 bg-stone-50/80 flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-stone-800 text-sm">{cat}</h3>
                      <span className="badge-neutral text-[10px]">{rows.length}</span>
                    </div>
                    <div className="p-3 sm:p-4 flex flex-wrap gap-2">
                      {rows.map((s) => (
                        <div
                          key={s._id}
                          className={`inline-flex items-center gap-1.5 max-w-full rounded-xl border px-2.5 py-1.5 text-xs sm:text-sm ${
                            s.isSystem
                              ? 'border-stone-200 bg-stone-50 text-stone-700'
                              : 'border-brand-200/70 bg-brand-50/60 text-brand-800'
                          }`}
                        >
                          <span className="truncate font-medium">{s.name}</span>
                          {s.isSystem ? (
                            <span className="text-[10px] uppercase tracking-wide text-stone-400 font-bold flex-shrink-0">
                              sys
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => onOpenEdit(s)}
                                className="p-1 rounded-lg text-stone-400 hover:text-brand-700 hover:bg-white/80 transition-colors"
                                aria-label={`Edit ${s.name}`}
                                title="Edit"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDelete(s)}
                                className="p-1 rounded-lg text-stone-400 hover:text-red-500 hover:bg-white/80 transition-colors"
                                aria-label={`Delete ${s.name}`}
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>

              {showGuide && (
                <div className="mt-auto pt-1">
                  <SkillsGuide />
                </div>
              )}
            </>
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
