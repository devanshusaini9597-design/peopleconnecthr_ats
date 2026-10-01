import React, { useMemo } from 'react';
import { Search, Filter, X, Briefcase, Hash, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PremiumSelect from '../ui/PremiumSelect';
import ColumnsPicker from '../ui/ColumnsPicker';
import CandidatesSortMenu from './CandidatesSortMenu';
import { CANDIDATE_SEARCH_SCOPES } from './atsConstants';

const iconBtn =
  'inline-flex h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0 items-center justify-center rounded-xl border font-semibold shadow-sm shadow-stone-900/5 transition-all duration-200';

export default function CandidatesSearchToolbar(props) {
  const { t } = useTranslation();
  const {
    searchQuery, setSearchQuery, searchScope, setSearchScope, setCurrentPage,
    showAdvancedSearch, setShowAdvancedSearch,
    activeAdvFilterCount, freelanceOnly, setFreelanceOnly, isFreelancer,
    statusFilter, onClearStatusFilter,
    columnOptions = [],
    visibleColumnIds = [],
    onVisibleColumnsChange,
    onSelectAllColumns,
    onClearAllColumns,
    onResetColumns,
    sortField = 'date',
    sortOrder = 'desc',
    onSortChange,
    isSearching = false,
    jobs = [],
    jobIdFilter = '',
    onJobIdChange,
  } = props;

  const scopeLabel = CANDIDATE_SEARCH_SCOPES.find((s) => s.value === searchScope)?.label || 'Anywhere';
  const placeholder =
    searchScope === 'candidateId'
      ? 'Enter Candidate ID'
      : searchScope === 'applicationId'
        ? 'Enter Application ID'
        : searchScope && searchScope !== 'all'
          ? `Search by ${scopeLabel}`
          : t('candidates.searchPlaceholder');

  const jobOptions = useMemo(() => (
    jobs.map((job) => {
      const code = String(job.jobCode || '').trim();
      const title = String(job.title || job.role || 'Untitled').trim();
      const count = Number(job.uniqueCandidateCount ?? job.applicationCount) || 0;
      return {
        value: code || String(job._id),
        label: code || title,
        description: code ? title : '',
        meta: String(count),
        icon: Hash,
        searchText: `${code} ${title}`,
      };
    })
  ), [jobs]);

  const jobSelected = Boolean(String(jobIdFilter || '').trim());
  const showJobs = !isFreelancer && Array.isArray(jobs) && jobs.length > 0;

  return (
    <div className="p-3 sm:p-5 border-b border-stone-100/90 overflow-visible bg-gradient-to-b from-stone-50/40 to-white" data-tour="cand-search">
      <div className="flex flex-col gap-2.5 sm:gap-3 min-w-0">
        <div className="relative w-full min-w-0 flex h-11 overflow-hidden rounded-xl border border-stone-200/90 bg-white shadow-sm shadow-stone-900/5 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/15 transition-all">
          <div className="w-11 flex-shrink-0 border-r border-stone-200/90">
            <PremiumSelect
              variant="list"
              compact
              bare
              iconOnly
              icon={Search}
              value={searchScope || 'all'}
              onChange={(v) => { setSearchScope(v || 'all'); setCurrentPage(1); }}
              options={CANDIDATE_SEARCH_SCOPES}
              placeholder="Anywhere"
              menuMinWidth={200}
            />
          </div>
          <div className="relative flex-1 min-w-0">
            <input
              type="text"
              placeholder={placeholder}
              aria-label="Search candidates"
              className="search-bare-input w-full h-full min-w-0 pl-3 pr-9 bg-transparent border-0 outline-none ring-0 shadow-none text-sm font-medium text-stone-900 placeholder:text-stone-400 placeholder:truncate"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            />
            {searchQuery.trim() && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 z-[1]"
                title={t('common.clear')}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 min-w-0">
          {showJobs ? (
            <div className="w-full min-[420px]:w-[min(100%,14rem)] sm:w-[13.5rem] flex-shrink-0 min-w-0">
              <PremiumSelect
                variant="list"
                compact
                className={jobSelected ? '[&>button]:border-brand-400 [&>button]:bg-brand-50/80 [&>button]:shadow-sm' : '[&>button]:shadow-sm [&>button]:shadow-stone-900/5'}
                value={jobIdFilter || ''}
                onChange={(v) => { onJobIdChange?.(v === 'all' || !v ? '' : v); setCurrentPage(1); }}
                options={jobOptions}
                placeholder="Job"
                icon={Briefcase}
                searchable
                searchPlaceholder="Find a requisition…"
                emptyLabel="No jobs found"
                allowClear={jobSelected}
                menuMinWidth={280}
              />
            </div>
          ) : null}

          <div className="inline-flex items-center gap-1.5 p-1 rounded-xl bg-white/90 border border-stone-200/80 shadow-sm shadow-stone-900/5">
            {!isFreelancer && (
              <button
                type="button"
                title={freelanceOnly ? 'Showing freelancer shares only' : 'Show freelancer-shared candidates separately'}
                aria-label="Show freelancer shares"
                aria-pressed={freelanceOnly}
                onClick={() => setFreelanceOnly((v) => !v)}
                className={`${iconBtn} ${
                  freelanceOnly
                    ? 'border-indigo-400 bg-indigo-50 text-indigo-800 shadow-indigo-500/10'
                    : 'border-transparent bg-transparent hover:bg-stone-50 text-stone-600 shadow-none'
                }`}
              >
                <UserRound size={16} strokeWidth={1.75} />
              </button>
            )}
            {freelanceOnly ? (
              <span className="hidden min-[480px]:inline-flex items-center h-8 px-2 rounded-lg text-[10px] font-bold uppercase tracking-wide text-indigo-800 bg-indigo-50 border border-indigo-200">
                Freelancer shares
              </span>
            ) : null}
            <button
              type="button"
              title={t('candidates.filters')}
              aria-label={t('candidates.filters')}
              onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
              className={`relative ${iconBtn} ${
                showAdvancedSearch || activeAdvFilterCount > 0
                  ? 'border-brand-400 bg-brand-50 text-brand-800 shadow-brand-500/10'
                  : 'border-transparent bg-transparent hover:bg-stone-50 text-stone-600 shadow-none'
              }`}
            >
              <Filter size={16} strokeWidth={1.75} />
              {activeAdvFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[1.1rem] h-4 px-1 rounded-full bg-stone-900 text-white text-[9px] font-bold tabular-nums">
                  {activeAdvFilterCount}
                </span>
              )}
            </button>
            <CandidatesSortMenu
              sortField={sortField}
              sortOrder={sortOrder}
              disabled={isSearching}
              onChange={(field, order) => onSortChange?.(field, order)}
            />
            <ColumnsPicker
              data-tour="cand-columns"
              columns={columnOptions}
              visibleIds={visibleColumnIds}
              onChange={onVisibleColumnsChange}
              onSelectAll={onSelectAllColumns}
              onClearAll={onClearAllColumns}
              onReset={onResetColumns}
              buttonClassName={`${iconBtn} border-transparent bg-transparent text-stone-600 hover:bg-stone-50 shadow-none`}
              iconOnly
            />
          </div>
        </div>
      </div>
      {statusFilter ? (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 h-8 pl-3 pr-1.5 rounded-full bg-brand-50 text-brand-800 text-xs font-semibold border border-brand-200 shadow-sm">
            Status: {String(statusFilter).replace(/[_-]+/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
            <button
              type="button"
              onClick={() => { onClearStatusFilter?.(); setCurrentPage(1); }}
              className="p-1 rounded-full text-brand-600 hover:bg-brand-100"
              title={t('common.clear')}
            >
              <X size={12} />
            </button>
          </span>
        </div>
      ) : null}
    </div>
  );
}
