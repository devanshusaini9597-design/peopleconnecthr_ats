import React from 'react';
import { Search, LayoutGrid, List, X, Filter, Briefcase, Target } from 'lucide-react';
import PremiumSelect from '../ui/PremiumSelect';
import { STAGE_FILTER_OPTIONS, classNames } from './constants';

export default function ApplicationsFilters({
  selectedJobId,
  setSelectedJobId,
  jobOptions,
  searchQuery,
  setSearchQuery,
  stageFilter,
  setStageFilter,
  viewMode,
  setViewMode,
  clearFilters,
}) {
  const hasActiveFilters = Boolean(searchQuery || stageFilter !== 'all');

  return (
    <section
      data-tour="apps-filters"
      className="rounded-xl border border-stone-200/90 bg-white shadow-sm overflow-hidden"
    >
      <div className="h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
      <div className="p-4 sm:p-5 flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3 lg:gap-4">
          <div className="flex-1 min-w-0">
            <label className="label-ats flex items-center gap-1.5">
              <Briefcase size={12} className="text-stone-400" aria-hidden="true" /> Job
            </label>
            <PremiumSelect
              variant="list"
              value={selectedJobId}
              onChange={setSelectedJobId}
              options={jobOptions}
              placeholder="Select a job"
              icon={Briefcase}
              searchable
              searchPlaceholder="Search jobs…"
              emptyLabel="No jobs found"
              allowClear
            />
          </div>

          <div className="flex-1 min-w-0">
            <label className="label-ats flex items-center gap-1.5">
              <Filter size={12} className="text-stone-400" aria-hidden="true" /> Search
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
              <input
                type="search"
                placeholder={selectedJobId ? 'Search name or email…' : 'Pick a job first…'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-ats input-ats-icon w-full !pr-9 min-w-0"
                disabled={!selectedJobId}
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
          </div>

          <div className="w-full sm:w-48 lg:w-44 flex-shrink-0">
            <label className="label-ats flex items-center gap-1.5">
              <Target size={12} className="text-stone-400" aria-hidden="true" /> Stage
            </label>
            <PremiumSelect
              variant="list"
              value={stageFilter}
              onChange={setStageFilter}
              options={STAGE_FILTER_OPTIONS}
              placeholder="All stages"
              icon={Target}
            />
          </div>

          <div className="w-full sm:w-auto flex-shrink-0">
            <label className="label-ats">View</label>
            <div className="flex h-[42px] items-center rounded-xl border border-stone-200 bg-stone-50 p-1 gap-1 min-w-[7.5rem]">
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={classNames(
                  'flex-1 h-full inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold px-2.5 transition-all',
                  viewMode === 'kanban'
                    ? 'bg-white text-brand-700 shadow-sm border border-stone-200/80'
                    : 'text-stone-500 hover:text-stone-700'
                )}
                title="Board view"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Board
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={classNames(
                  'flex-1 h-full inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold px-2.5 transition-all',
                  viewMode === 'table'
                    ? 'bg-white text-brand-700 shadow-sm border border-stone-200/80'
                    : 'text-stone-500 hover:text-stone-700'
                )}
                title="List view"
              >
                <List className="w-3.5 h-3.5" />
                List
              </button>
            </div>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between gap-3 pt-1 border-t border-stone-100">
            <p className="text-xs text-stone-500">Filters active</p>
            <button type="button" className="text-xs font-semibold text-brand-700 hover:text-brand-800" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
