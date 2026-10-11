import React from 'react';
import { Search, SlidersHorizontal, Briefcase } from 'lucide-react';
import PremiumSelect from '../ui/PremiumSelect';
import { STAGE_FILTER_OPTIONS } from './constants';

export default function ApplicationsFilters({
  selectedJobId,
  setSelectedJobId,
  jobOptions,
  searchQuery,
  setSearchQuery,
  stageFilter,
  setStageFilter,
  stageFilterOptions,
  viewMode,
  setViewMode,
  clearFilters,
  resultCount,
  totalCount,
  loading,
}) {
  const stageOptions = stageFilterOptions?.length ? stageFilterOptions : STAGE_FILTER_OPTIONS;
  const hasActiveFilters = Boolean(searchQuery || (stageFilter && stageFilter !== 'all') || (selectedJobId && selectedJobId !== 'all'));
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  return (
    <div data-tour="apps-filters" className="toolbar-ats mb-4 overflow-visible">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-600 pointer-events-none" />
          <input
            type="search"
            placeholder="Search candidate, email, or job"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-ats input-ats-icon !pr-10 !h-11 !rounded-xl w-full"
            aria-label="Search pipeline"
          />
        </div>
        <div className="w-full sm:w-56 min-w-0">
          <PremiumSelect
            compact
            className="rounded-xl w-full bg-white"
            value={selectedJobId || 'all'}
            onChange={(v) => setSelectedJobId(v || 'all')}
            options={jobOptions}
            placeholder="All jobs"
            icon={Briefcase}
            searchable
            searchPlaceholder="Search jobs…"
            emptyLabel="No jobs found"
          />
        </div>
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className={`h-11 px-3.5 rounded-xl border text-[13px] font-semibold inline-flex items-center gap-1.5 ${
            filtersOpen || (stageFilter && stageFilter !== 'all')
              ? 'border-brand-300 bg-brand-50 text-brand-800'
              : 'border-stone-200 bg-white text-stone-700 hover:border-brand-300'
          }`}
        >
          <SlidersHorizontal size={14} />
          Filters
        </button>
        <div className="inline-flex items-center rounded-xl border border-stone-200 bg-white p-0.5 shadow-sm">
          {[
            { id: 'kanban', label: 'Board' },
            { id: 'table', label: 'List' },
          ].map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setViewMode(id)}
              className={`h-9 px-3.5 rounded-[10px] text-[13px] font-semibold ${
                viewMode === id
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
                  : 'text-stone-600 hover:bg-stone-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {filtersOpen ? (
        <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 border-t border-stone-100 pt-3">
          <PremiumSelect
            compact
            className="rounded-xl w-full bg-white"
            value={stageFilter}
            onChange={setStageFilter}
            options={stageOptions}
            placeholder="All stages"
          />
          {hasActiveFilters ? (
            <button type="button" onClick={clearFilters} className="btn-secondary !h-10">
              Clear filters
            </button>
          ) : null}
          <p className="text-[12px] text-stone-500 self-center sm:col-span-2">
            {loading
              ? 'Loading…'
              : `${typeof resultCount === 'number' ? resultCount : 0}${typeof totalCount === 'number' && totalCount !== resultCount ? ` of ${totalCount}` : ''} in view`}
          </p>
        </div>
      ) : null}
    </div>
  );
}
