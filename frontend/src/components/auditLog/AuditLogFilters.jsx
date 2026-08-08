import React from 'react';
import { Filter, Info, ScrollText, Search, Shield } from 'lucide-react';
import PremiumSelect from '../ui/PremiumSelect';
import PremiumDatePicker from '../ui/PremiumDatePicker';

export default function AuditLogFilters({
  query,
  setQuery,
  filters,
  setFilters,
  actionOptions,
  resourceOptions,
  hasActiveFilters,
  pagination,
  filterOptions,
}) {
  return (
    <>
      <div
        data-tour="audit-tip"
        className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed flex flex-wrap items-center gap-x-3 gap-y-1.5"
      >
        <span className="inline-flex items-center gap-1.5 text-brand-700 font-semibold">
          <Info size={14} /> Tip
        </span>
        <span>
          Filter by action, resource, or date. Entries are retained for 90 days. Export CSV on Enterprise.
          Press <span className="font-semibold text-stone-800">?</span> for a tour.
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0">
            <ScrollText className="w-4 h-4" />
          </div>
          <div>
            <p className="text-lg font-bold text-stone-900 tabular-nums leading-none">{pagination.total}</p>
            <p className="text-[11px] text-stone-500 mt-1">Matching events</p>
          </div>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center flex-shrink-0">
            <Filter className="w-4 h-4" />
          </div>
          <div>
            <p className="text-lg font-bold text-stone-900 tabular-nums leading-none">{filterOptions.actions.length}</p>
            <p className="text-[11px] text-stone-500 mt-1">Action types</p>
          </div>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-bold text-stone-900 leading-none">90-day retention</p>
            <p className="text-[11px] text-stone-500 mt-1">Auto-purged after TTL</p>
          </div>
        </div>
      </div>

      <section
        data-tour="audit-filters"
        className="rounded-xl border border-stone-200/90 bg-white shadow-sm overflow-hidden"
      >
        <div className="h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <div className="p-4 sm:p-5 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input-ats input-ats-icon"
              placeholder="Search this page by user, action, IP…"
              aria-label="Search audit entries"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="min-w-0">
              <label className="label-ats">Action</label>
              <PremiumSelect
                value={filters.action}
                onChange={(v) => setFilters((f) => ({ ...f, action: v || '' }))}
                options={actionOptions}
                placeholder="All actions"
                searchable
                searchPlaceholder="Search actions…"
                variant="list"
              />
            </div>
            <div className="min-w-0">
              <label className="label-ats">Resource</label>
              <PremiumSelect
                value={filters.resource}
                onChange={(v) => setFilters((f) => ({ ...f, resource: v || '' }))}
                options={resourceOptions}
                placeholder="All resources"
                searchable
                searchPlaceholder="Search resources…"
                variant="list"
              />
            </div>
            <div className="min-w-0">
              <label className="label-ats">From</label>
              <PremiumDatePicker
                value={filters.startDate}
                onChange={(v) => setFilters((f) => ({ ...f, startDate: v || '' }))}
                placeholder="Start date"
                allowClear
              />
            </div>
            <div className="min-w-0">
              <label className="label-ats">To</label>
              <PremiumDatePicker
                value={filters.endDate}
                onChange={(v) => setFilters((f) => ({ ...f, endDate: v || '' }))}
                placeholder="End date"
                allowClear
              />
            </div>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => setFilters({ action: '', resource: '', startDate: '', endDate: '' })}
              className="text-sm text-brand-600 hover:text-brand-700 font-semibold self-start"
            >
              Clear filters
            </button>
          )}
        </div>
      </section>
    </>
  );
}
