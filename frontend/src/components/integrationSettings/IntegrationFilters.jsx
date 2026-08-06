import React from 'react';
import { Search, Filter } from 'lucide-react';
import PremiumSelect from '../ui/PremiumSelect';
import { STATUS_FILTER_OPTIONS } from './integrationConstants';

export default function IntegrationFilters({
  searchQuery,
  setSearchQuery,
  categoryFilter,
  setCategoryFilter,
  categoryOptions,
  statusFilter,
  setStatusFilter,
}) {
  return (
    <div data-tour="integrations-filters" className="card-ats-bordered p-4 sm:p-5 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
      <div className="flex items-center gap-2 mb-3">
        <Filter size={15} className="text-brand-600 flex-shrink-0" />
        <p className="text-sm font-bold text-stone-900 tracking-tight">Find providers</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <label className="label-ats">Search</label>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Name, category, or keyword…"
              className="input-ats input-ats-icon w-full"
            />
          </div>
        </div>
        <div>
          <label className="label-ats">Category</label>
          <PremiumSelect
            variant="list"
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={categoryOptions}
            placeholder="All categories"
          />
        </div>
        <div>
          <label className="label-ats">Status</label>
          <PremiumSelect
            variant="list"
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_FILTER_OPTIONS}
            placeholder="All statuses"
          />
        </div>
      </div>
    </div>
  );
}
