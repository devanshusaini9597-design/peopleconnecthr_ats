import React from 'react';
import { Search, LayoutGrid, List, X, Filter, Briefcase, Target } from 'lucide-react';
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
  const jobFiltered = selectedJobId && selectedJobId !== 'all';

  return (
    <section data-tour="apps-filters" className="toolbar-ats flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 min-w-0 max-w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search name or email…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-ats !pl-10 !pr-9 w-full"
            aria-label="Search pipeline"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <p className="text-[11px] text-stone-400 font-medium sm:text-right flex-shrink-0">
          {loading
            ? 'Loading…'
            : `${typeof resultCount === 'number' ? resultCount : 0}${typeof totalCount === 'number' && totalCount !== resultCount ? ` of ${totalCount}` : ''} in view`}
        </p>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-1 min-w-0">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 px-1 flex-shrink-0">
            <Filter size={14} /> Filters
          </div>
          <div className="flex-1 min-w-0 sm:max-w-xs">
            <PremiumSelect
              variant="list"
              compact
              value={selectedJobId || 'all'}
              onChange={(v) => setSelectedJobId(v || 'all')}
              options={jobOptions}
              placeholder="All open jobs"
              icon={Briefcase}
              searchable
              searchPlaceholder="Search jobs…"
              emptyLabel="No jobs found"
            />
          </div>
          <div className="w-full sm:w-44 flex-shrink-0">
            <PremiumSelect
              variant="list"
              compact
              value={stageFilter}
              onChange={setStageFilter}
              options={stageOptions}
              placeholder="All stages"
              icon={Target}
            />
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              className="text-xs font-semibold text-brand-700 hover:text-brand-800 self-start sm:self-center whitespace-nowrap"
              onClick={() => {
                clearFilters();
                if (jobFiltered) setSelectedJobId('all');
              }}
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 px-1">
            View
          </div>
          {[
            { id: 'kanban', label: 'Board', icon: LayoutGrid },
            { id: 'table', label: 'List', icon: List },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setViewMode(id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                viewMode === id
                  ? 'bg-brand-600 text-white border-brand-600 shadow-md shadow-brand-500/20'
                  : 'bg-white text-stone-600 border-stone-200 hover:border-brand-300 hover:bg-brand-50/50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
