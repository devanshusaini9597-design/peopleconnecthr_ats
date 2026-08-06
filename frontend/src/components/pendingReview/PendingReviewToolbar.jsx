import React from 'react';
import { Eye, EyeOff, Loader2, Search, Trash2, Upload } from 'lucide-react';

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
    <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-sm sticky top-0 z-20">
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'all', label: 'All', n: stats.total },
          { id: 'review', label: 'Needs review', n: stats.review },
          { id: 'blocked', label: 'Blocked', n: stats.blocked },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => changeBucket(t.id)}
            className={`h-9 px-3 rounded-xl text-xs font-bold border ${
              bucket === t.id ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-stone-200 text-stone-600'
            }`}
          >
            {t.label} · {t.n}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            className="input-ats !h-9 !pl-9 !py-0 !text-xs w-48"
            placeholder="Search records…"
            value={query}
            onChange={(e) => changeSearch(e.target.value)}
          />
        </div>
        <button type="button" className="btn-secondary !h-9 !text-xs" onClick={() => setShowOriginals((v) => !v)}>
          {showOriginals ? <EyeOff size={14} /> : <Eye size={14} />}
          {showOriginals ? 'Hide originals' : 'Show originals'}
        </button>
        <button type="button" className="btn-secondary !h-9 !text-xs" onClick={selectImportReady} disabled={!readyOnPage}>
          Select ready
        </button>
        <button type="button" className="btn-secondary !h-9 !text-xs" onClick={() => setSelected(new Set())} disabled={!selectedCount}>
          Clear
        </button>
        <button
          type="button"
          className="btn-secondary !h-9 !text-xs !text-red-600 !border-red-200"
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
  );
}
