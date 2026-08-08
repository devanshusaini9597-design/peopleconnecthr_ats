import React from 'react';
import { Filter, RefreshCw, Briefcase, Building2, MapPin, Calendar, ArrowUpAZ, ArrowDownAZ, ArrowUpDown, IndianRupee, Clock3, BarChart3 } from 'lucide-react';
import PremiumSelect from '../ui/PremiumSelect';
import PremiumDatePicker from '../ui/PremiumDatePicker';

export default function CandidatesAdvancedFilters(props) {
  const {
    showAdvancedSearch, activeAdvFilterCount, clearAdvancedFilters, advancedSearchFilters,
    setAdvancedSearchFilters, positionFilterOptions, expOptions, ctcFilterOptions,
    sortField, setSortField, sortOrder, setSortOrder, setCurrentPage,
  } = props;
  if (!showAdvancedSearch) return null;
  return (
          <div className="border-b border-stone-200 bg-gradient-to-b from-stone-50 to-white animate-fade-in">
            <div className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand-600 to-teal-600 text-white shadow-md shadow-brand-500/20 inline-flex items-center justify-center flex-shrink-0">
                  <Filter size={16} strokeWidth={2} />
                </div>
                <div className="min-w-0 pt-0.5">
                  <h3 className="text-sm font-bold text-stone-900 tracking-tight">Advanced filters</h3>
                  <p className="text-[12px] text-stone-500 mt-0.5 leading-snug">
                    {activeAdvFilterCount > 0
                      ? `${activeAdvFilterCount} filter${activeAdvFilterCount === 1 ? '' : 's'} active · list updates live`
                      : 'Narrow by role, compensation, and sort order'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={clearAdvancedFilters}
                disabled={activeAdvFilterCount === 0}
                className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-semibold border border-stone-200 bg-white text-stone-600 shadow-sm hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50/40 transition-colors disabled:opacity-40 disabled:pointer-events-none self-start sm:self-auto"
              >
                <RefreshCw size={13} /> Reset
              </button>
            </div>

            <div className="px-4 sm:px-6 pb-5 space-y-5">
              {/* Role & place */}
              <section className="rounded-xl border border-stone-200/90 bg-white shadow-sm p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="h-7 w-7 rounded-lg bg-brand-50 text-brand-700 border border-brand-100 inline-flex items-center justify-center">
                    <Briefcase size={13} strokeWidth={2} />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-stone-800">Role & place</p>
                    <p className="text-[11px] text-stone-400">Where and what they applied for</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div className="min-w-0">
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-600 mb-1.5">
                      <Briefcase size={12} className="text-brand-600" /> Position
                    </label>
                    <PremiumSelect
                      variant="list"
                      value={advancedSearchFilters.position}
                      onChange={(v) => setAdvancedSearchFilters((prev) => ({ ...prev, position: v }))}
                      options={positionFilterOptions}
                      placeholder="All positions"
                      searchable
                      searchPlaceholder="Filter positions…"
                      allowClear
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-600 mb-1.5">
                      <Building2 size={12} className="text-brand-600" /> Company
                    </label>
                    <div className="relative">
                      <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none z-[1]" />
                      <input
                        type="text"
                        value={advancedSearchFilters.companyName}
                        onChange={(e) => setAdvancedSearchFilters((prev) => ({ ...prev, companyName: e.target.value }))}
                        placeholder="Company name"
                        className="field-premium field-premium-icon"
                      />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-600 mb-1.5">
                      <MapPin size={12} className="text-brand-600" /> Location
                    </label>
                    <div className="relative">
                      <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none z-[1]" />
                      <input
                        type="text"
                        value={advancedSearchFilters.location}
                        onChange={(e) => setAdvancedSearchFilters((prev) => ({ ...prev, location: e.target.value }))}
                        placeholder="City or region"
                        className="field-premium field-premium-icon"
                      />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-600 mb-1.5">
                      <Calendar size={12} className="text-brand-600" /> Date
                    </label>
                    <PremiumDatePicker
                      value={advancedSearchFilters.date}
                      onChange={(v) => setAdvancedSearchFilters((prev) => ({ ...prev, date: v }))}
                      placeholder="Pick a date"
                      allowClear
                    />
                  </div>
                </div>
              </section>

              {/* Experience & CTC */}
              <section className="rounded-xl border border-stone-200/90 bg-white shadow-sm p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="h-7 w-7 rounded-lg bg-teal-50 text-teal-700 border border-teal-100 inline-flex items-center justify-center">
                    <IndianRupee size={13} strokeWidth={2} />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-stone-800">Experience & CTC</p>
                    <p className="text-[11px] text-stone-400">Set min and max ranges</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="min-w-0 space-y-2">
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-600">
                      <Clock3 size={12} className="text-teal-600" /> Experience (years)
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <PremiumSelect variant="list" value={advancedSearchFilters.expMin} onChange={(v) => setAdvancedSearchFilters((prev) => ({ ...prev, expMin: v }))} options={expOptions} placeholder="Min" allowClear />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wide text-stone-300 flex-shrink-0">to</span>
                      <div className="flex-1 min-w-0">
                        <PremiumSelect variant="list" value={advancedSearchFilters.expMax} onChange={(v) => setAdvancedSearchFilters((prev) => ({ ...prev, expMax: v }))} options={expOptions} placeholder="Max" allowClear />
                      </div>
                    </div>
                  </div>
                  <div className="min-w-0 space-y-2">
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-600">
                      <IndianRupee size={12} className="text-teal-600" /> Current CTC
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <PremiumSelect variant="list" value={advancedSearchFilters.ctcMin} onChange={(v) => setAdvancedSearchFilters((prev) => ({ ...prev, ctcMin: v }))} options={ctcFilterOptions} placeholder="Min" allowClear />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wide text-stone-300 flex-shrink-0">to</span>
                      <div className="flex-1 min-w-0">
                        <PremiumSelect variant="list" value={advancedSearchFilters.ctcMax} onChange={(v) => setAdvancedSearchFilters((prev) => ({ ...prev, ctcMax: v }))} options={ctcFilterOptions} placeholder="Max" allowClear />
                      </div>
                    </div>
                  </div>
                  <div className="min-w-0 space-y-2">
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-600">
                      <BarChart3 size={12} className="text-teal-600" /> Expected CTC
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <PremiumSelect variant="list" value={advancedSearchFilters.expectedCtcMin} onChange={(v) => setAdvancedSearchFilters((prev) => ({ ...prev, expectedCtcMin: v }))} options={ctcFilterOptions} placeholder="Min" allowClear />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wide text-stone-300 flex-shrink-0">to</span>
                      <div className="flex-1 min-w-0">
                        <PremiumSelect variant="list" value={advancedSearchFilters.expectedCtcMax} onChange={(v) => setAdvancedSearchFilters((prev) => ({ ...prev, expectedCtcMax: v }))} options={ctcFilterOptions} placeholder="Max" allowClear />
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Sort */}
              <section className="rounded-xl border border-stone-200/90 bg-white shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 py-3 border-b border-stone-100 bg-stone-50/50 flex items-center gap-2.5">
                  <span className="h-8 w-8 rounded-lg bg-white text-stone-700 border border-stone-200 shadow-sm inline-flex items-center justify-center">
                    <ArrowUpDown size={14} strokeWidth={2} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-stone-900">Sort results</p>
                    <p className="text-[11px] text-stone-400">Choose field and direction</p>
                  </div>
                </div>
                <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-4 md:items-end">
                  <div className="min-w-0">
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-600 mb-1.5">
                      <Calendar size={12} className="text-stone-500" /> Sort by
                    </label>
                    <PremiumSelect
                      variant="list"
                      value={sortField}
                      onChange={(v) => { setSortField(v); setCurrentPage(1); }}
                      options={[
                        { value: 'date', label: 'Date' },
                        { value: 'name', label: 'Name' },
                        { value: 'email', label: 'Email' },
                        { value: 'position', label: 'Position' },
                        { value: 'location', label: 'Location' },
                        { value: 'company', label: 'Company' },
                        { value: 'status', label: 'Status' },
                        { value: 'spoc', label: 'SPOC' },
                      ]}
                      placeholder="Sort field"
                    />
                  </div>
                  <div className="min-w-0 md:min-w-[220px]">
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Direction</label>
                    <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-stone-200 bg-stone-50 p-1">
                      <button
                        type="button"
                        onClick={() => { setSortOrder('asc'); setCurrentPage(1); }}
                        className={`h-9 rounded-md text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-all ${
                          sortOrder === 'asc'
                            ? 'bg-gradient-to-br from-brand-600 to-teal-600 text-white shadow-sm shadow-brand-500/20'
                            : 'text-stone-600 hover:bg-white hover:text-stone-900'
                        }`}
                      >
                        <ArrowUpAZ size={13} /> Ascending
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSortOrder('desc'); setCurrentPage(1); }}
                        className={`h-9 rounded-md text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-all ${
                          sortOrder === 'desc'
                            ? 'bg-gradient-to-br from-brand-600 to-teal-600 text-white shadow-sm shadow-brand-500/20'
                            : 'text-stone-600 hover:bg-white hover:text-stone-900'
                        }`}
                      >
                        <ArrowDownAZ size={13} /> Descending
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
  );
}
