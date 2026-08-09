import React from 'react';
import {
  Filter, Search, X, Layers, CheckCircle2, Ban, ListFilter,
} from 'lucide-react';
import PremiumSelect from '../../ui/PremiumSelect';

const STAGE_OPTIONS = [
  { value: 'all', label: 'All staged' },
  { value: 'review', label: 'Needs review' },
  { value: 'blocked', label: 'Blocked' },
];

export default function WorkbenchFilters({
  query,
  setQuery,
  bucket,
  setBucket,
  readyOnPage,
  selectedCount,
  isImporting,
  onSelectReady,
  onClearSelection,
  onDeleteSelected,
  onImportSelected,
  statsTotal,
}) {
  const hasSearch = Boolean(query);

  return (
    <section
      data-tour="wb-filters"
      className="rounded-xl border border-stone-200/90 bg-white shadow-sm overflow-hidden"
    >
      <div className="h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
      <div className="p-4 sm:p-5 flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3 lg:gap-4">
          <div className="flex-1 min-w-0">
            <label htmlFor="wb-search" className="label-ats flex items-center gap-1.5">
              <Filter size={12} className="text-stone-400" aria-hidden="true" /> Search
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
              <input
                id="wb-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, email, company…"
                className="input-ats input-ats-icon w-full !pr-9 min-w-0"
              />
              {hasSearch && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="w-full sm:w-52 lg:w-48 flex-shrink-0">
            <label htmlFor="wb-stage" className="label-ats flex items-center gap-1.5">
              <Layers size={12} className="text-stone-400" aria-hidden="true" /> Stage
            </label>
            <PremiumSelect
              id="wb-stage"
              variant="list"
              value={bucket}
              onChange={setBucket}
              options={STAGE_OPTIONS}
              placeholder="Stage"
              icon={ListFilter}
            />
          </div>

          <p className="text-sm font-medium text-stone-500 lg:pb-2.5 lg:ml-auto whitespace-nowrap">
            {statsTotal.toLocaleString()} in queue
            {selectedCount > 0 ? ` · ${selectedCount} selected` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-stone-100">
          <button
            type="button"
            className="btn-secondary !h-9 !text-xs"
            disabled={!readyOnPage}
            onClick={onSelectReady}
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Select ready ({readyOnPage})
          </button>
          <button
            type="button"
            className="btn-secondary !h-9 !text-xs"
            disabled={!selectedCount}
            onClick={onClearSelection}
          >
            Clear selection
          </button>
          <div className="flex-1 min-w-[8px]" />
          <button
            type="button"
            className="btn-secondary !h-9 !text-xs !text-red-600 !border-red-200 hover:!bg-red-50"
            disabled={!selectedCount}
            onClick={onDeleteSelected}
          >
            <Ban className="w-3.5 h-3.5" /> Discard ({selectedCount})
          </button>
          <button
            type="button"
            className="btn-primary !h-9 !text-xs"
            disabled={!selectedCount || isImporting}
            onClick={onImportSelected}
          >
            Release selected ({selectedCount})
          </button>
        </div>
      </div>
    </section>
  );
}
