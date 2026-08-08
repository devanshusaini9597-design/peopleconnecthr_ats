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
  return (
    <div data-tour="apps-filters" className="card-ats-bordered p-3 sm:p-5 relative">
      <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 pointer-events-none" />
      <div className="flex items-center gap-2 mb-3 pt-1">
        <Filter size={15} className="text-brand-600 flex-shrink-0" />
        <p className="text-sm font-bold text-stone-900 tracking-tight">Find applications</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-3 sm:gap-4 items-end">
        <div className="sm:col-span-1 xl:col-span-3 min-w-0">
          <label className="label-ats">Job</label>
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
        <div className="sm:col-span-1 xl:col-span-3 min-w-0">
          <label className="label-ats">Search</label>
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              placeholder={selectedJobId ? 'Name, email, phone…' : 'Pick a job first…'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-ats input-ats-icon w-full !pr-9"
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
        <div className="sm:col-span-1 xl:col-span-2 min-w-0">
          <label className="label-ats">Stage</label>
          <PremiumSelect
            variant="list"
            value={stageFilter}
            onChange={setStageFilter}
            options={STAGE_FILTER_OPTIONS}
            placeholder="All stages"
            icon={Target}
          />
        </div>
        <div className="sm:col-span-1 xl:col-span-4 flex flex-wrap items-end gap-2 min-w-0">
          <div className="flex bg-stone-100 p-1 rounded-xl h-[42px] items-center flex-shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={classNames(
                'h-8 w-8 flex items-center justify-center rounded-lg transition-all',
                viewMode === 'kanban' ? 'bg-white shadow-sm text-brand-600' : 'text-stone-500 hover:text-stone-700'
              )}
              title="Board view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={classNames(
                'h-8 w-8 flex items-center justify-center rounded-lg transition-all',
                viewMode === 'table' ? 'bg-white shadow-sm text-brand-600' : 'text-stone-500 hover:text-stone-700'
              )}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          {(searchQuery || stageFilter !== 'all') && (
            <button
              type="button"
              className="btn-secondary !h-[42px] flex-1 sm:flex-none"
              onClick={clearFilters}
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
