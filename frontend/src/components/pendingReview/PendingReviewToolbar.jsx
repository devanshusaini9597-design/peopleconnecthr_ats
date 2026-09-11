import React from 'react';
import { Eye, EyeOff, Loader2, Search, Trash2, Upload, Filter } from 'lucide-react';

export default function PendingReviewToolbar({
  stats,
  bucket,
  query,
  selectedCount,
  readyOnPage,
  showOriginals,
  isImporting,
  changeBucket,
  changeSearch,
  setShowOriginals,
  selectImportReady,
  setSelected,
  runDelete,
  runImport,
  selected,
}) {
  return (
    <section
      data-tour="pr-toolbar"
      className="rounded-xl border border-stone-200/90 bg-white shadow-sm overflow-hidden"
    >
      <div className="h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
      <div className="p-4 sm:p-5 space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-end gap-3">
          <div className="flex-1 min-w-0">
            <label htmlFor="pr-search" className="label-ats flex items-center gap-1.5">
              <Filter size={12} className="text-stone-400" aria-hidden="true" /> Search queue
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
              <input
                id="pr-search"
                className="input-ats input-ats-icon"
                placeholder="Search by name, email, company…"
                value={query}
                onChange={(e) => changeSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 xl:pb-0.5">
            {[
              { id: 'all', label: 'All', n: stats.total },
              { id: 'review', label: 'Needs review', n: stats.review },
              { id: 'blocked', label: 'Blocked', n: stats.blocked },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => changeBucket(t.id)}
                className={`h-10 px-3.5 rounded-xl text-xs font-bold border transition-colors ${
                  bucket === t.id
                    ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                    : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                }`}
              >
                {t.label}
                <span className={`ml-1.5 tabular-nums ${bucket === t.id ? 'text-white/80' : 'text-stone-400'}`}>
                  {t.n}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-stone-100">
          <button type="button" className="btn-secondary !h-9 !text-xs" onClick={() => setShowOriginals((v) => !v)}>
            {showOriginals ? <EyeOff size={14} /> : <Eye size={14} />}
            {showOriginals ? 'Hide originals' : 'Show originals'}
          </button>
          <button type="button" className="btn-secondary !h-9 !text-xs" onClick={selectImportReady} disabled={!readyOnPage}>
            Select ready ({readyOnPage})
          </button>
          <button type="button" className="btn-secondary !h-9 !text-xs" onClick={() => setSelected(new Set())} disabled={!selectedCount}>
            Clear selection
          </button>

          <div className="flex-1 min-w-[8px]" />

          <button
            type="button"
            className="btn-secondary !h-9 !text-xs !text-red-600 !border-red-200 hover:!bg-red-50"
            disabled={!selectedCount}
            onClick={() => runDelete([...selected])}
          >
            <Trash2 size={14} /> Delete ({selectedCount})
          </button>
          <button
            type="button"
            className="btn-primary !h-9 !text-xs"
            disabled={!selectedCount || isImporting}
            onClick={() => runImport([...selected])}
          >
            {isImporting ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Import selected ({selectedCount})
          </button>
        </div>
      </div>
    </section>
  );
}
