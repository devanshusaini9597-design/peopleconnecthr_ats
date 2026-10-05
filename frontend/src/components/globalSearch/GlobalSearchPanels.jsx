import React from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Loader2, Users, Briefcase, X, ArrowRight,
  Megaphone, Filter, ChevronLeft, ChevronRight,
} from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import { StatCard } from '../dashboard/DashboardWidgets';
import PremiumSelect from '../ui/PremiumSelect';
import ColumnsPicker from '../ui/ColumnsPicker';
import { ENTITY_FILTERS, statusBadgeClass } from './globalSearchConstants';
import { CANDIDATE_SEARCH_SCOPES } from '../ats/atsConstants';

const iconBtn =
  'inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border font-semibold transition-colors';

export function GlobalSearchKpis({ counts, loading, onCardClick, scope = 'desk', showMis = true }) {
  const people = (Number(counts.candidates) || 0) + (showMis ? (Number(counts.mis) || 0) : 0);
  const orgWide = scope === 'organization';
  const fromSearch = scope === 'search';
  const peopleCaption = fromSearch
    ? (showMis ? 'Matching candidates and MIS contacts' : 'Matching candidates')
    : showMis
      ? (orgWide ? 'Candidates and MIS contacts across the organisation' : 'Your candidates and organisation MIS contacts')
      : (orgWide ? 'Candidates across the organisation' : 'Candidates on your account');
  const candCaption = fromSearch
    ? 'Matching candidates in this search'
    : (orgWide ? 'All organisation candidates' : 'Candidates on your account');
  const misCaption = fromSearch
    ? 'Matching MIS contacts in this search'
    : (orgWide ? 'Organisation directory' : 'Organisation directory and contacts you added');
  const card = (key, props) => (
    <StatCard
      {...props}
      loading={loading}
      onClick={() => onCardClick?.(key)}
    />
  );
  return (
    <div data-tour="search-kpis" className="min-w-0 w-full">
      <div className={`grid gap-4 sm:gap-5 min-w-0 w-full grid-cols-1 sm:grid-cols-2 ${showMis ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
        {card('all', { icon: Users, label: 'Total talent', value: people, caption: peopleCaption, gradient: 'from-brand-500 to-teal-400' })}
        {card('candidates', { icon: Users, label: 'Candidates', value: counts.candidates || 0, caption: candCaption, gradient: 'from-teal-600 to-emerald-400' })}
        {showMis ? card('mis', { icon: Megaphone, label: 'MIS contacts', value: counts.mis || 0, caption: misCaption, gradient: 'from-amber-500 to-orange-400' }) : null}
        {card('jobs', { icon: Briefcase, label: 'Jobs', value: counts.jobs || 0, caption: 'Open and closed requisitions', gradient: 'from-sky-500 to-cyan-400' })}
      </div>
    </div>
  );
}

function tabCount(f, counts, countsLoading = false) {
  const key = f.key === 'all' ? 'people' : f.key;
  const sideExact = Boolean(counts?.exactBy?.[key] || counts?.exactBy?.[f.key] || counts?.exact);
  if (!sideExact) return countsLoading ? { pending: true } : null;
  const reported = f.key === 'all' ? counts.people : counts[f.key];
  const n = Number(reported) || 0;
  return { n, pending: false };
}

function buildTableRows(entity, data) {
  if (entity === 'all') {
    return [
      ...(data.candidates || []).map((r) => ({ ...r, _kind: 'candidates' })),
      ...(data.mis || []).map((r) => ({ ...r, _kind: 'mis' })),
    ];
  }
  return (data[entity] || []).map((r) => ({ ...r, _kind: entity }));
}

function rowName(entity, r) {
  if (entity === 'jobs') return r.title || r.role || 'Untitled';
  if (entity === 'applications' || entity === 'interviews') return r.candidateId?.name || '—';
  return r.name || '—';
}

function rowDetail(entity, r) {
  if (entity === 'jobs') return [r.jobCode, r.location, r.clientName].filter(Boolean).join(' · ');
  if (entity === 'applications') return [r.jobId?.jobCode || r.jobId?.title, r.stage].filter(Boolean).join(' · ');
  if (entity === 'interviews') return [r.jobId?.jobCode || r.jobId?.title, r.status].filter(Boolean).join(' · ');
  return [r.email, r.position, r.location, r.skills].filter(Boolean).join(' · ');
}

function rowHref(entity, r, relatedJob) {
  if (entity === 'jobs') return '/jobs';
  if (entity === 'applications') return r.jobId?.jobCode ? `/applications?jobId=${encodeURIComponent(r.jobId.jobCode)}` : '/applications';
  if (entity === 'interviews') return '/interviews';
  if (entity === 'mis') return '/mis';
  if (entity === 'jobFit') return `/ats?highlight=${r._id}${relatedJob?.jobCode ? `&jobId=${encodeURIComponent(relatedJob.jobCode)}` : ''}`;
  return `/ats?highlight=${r._id}`;
}

function kindLabel(kind) {
  if (kind === 'mis') return 'MIS';
  if (kind === 'jobFit') return 'Job fit';
  if (kind === 'candidates') return 'Candidate';
  if (kind === 'jobs') return 'Job';
  if (kind === 'applications') return 'Application';
  if (kind === 'interviews') return 'Interview';
  if (kind === 'related') return 'AI related';
  return kind;
}

export function GlobalSearchWorkbench({
  workbenchRef,
  inputRef, q, setQ, onSearch, clearSearch, hasRun, loading,
  searchScope, setSearchScope,
  showAdvancedSearch, setShowAdvancedSearch, activeAdvFilterCount = 0,
  columnOptions, visibleColumnIds, onVisibleColumnsChange, onSelectAllColumns, onClearAllColumns, onResetColumns,
  entity, setEntity, counts,
  countsLoading = false,
  rowCounts = {},
  entityTabs = ENTITY_FILTERS,
  filterPanel,
  relatedJob,
  children,
}) {
  const scopeLabel = CANDIDATE_SEARCH_SCOPES.find((s) => s.value === searchScope)?.label || 'Anywhere';
  const placeholder =
    searchScope === 'candidateId'
      ? 'Enter Candidate ID'
      : searchScope === 'applicationId'
        ? 'Enter Application ID'
        : searchScope && searchScope !== 'all'
          ? `Search by ${scopeLabel}`
          : 'Search by name, email, position, skill, or location';

  return (
    <div ref={workbenchRef} data-tour="search-workbench" className="card-ats-bordered overflow-hidden min-w-0">
      <div className="p-4 sm:p-5 border-b border-stone-100 space-y-4">
        <form
          className="flex flex-wrap sm:flex-nowrap items-stretch gap-1.5 min-w-0"
          onSubmit={(e) => {
            e.preventDefault();
            onSearch?.();
          }}
        >
          <div className="relative flex-1 min-w-[12rem] flex h-11 overflow-hidden rounded-xl border border-stone-200 bg-white focus-within:border-brand-600 transition-colors">
            <div className="w-11 flex-shrink-0 flex items-center justify-center text-stone-400 border-r border-stone-200/90">
              <PremiumSelect
                variant="list"
                compact
                bare
                iconOnly
                icon={Search}
                value={searchScope || 'all'}
                onChange={(v) => setSearchScope?.(v || 'all')}
                options={CANDIDATE_SEARCH_SCOPES}
                placeholder="Anywhere"
                menuMinWidth={200}
              />
            </div>
            <div className="relative flex-1 min-w-0">
              <input
                ref={inputRef}
                id="global-search-q"
                type="text"
                className="search-bare-input w-full h-full min-w-0 pl-2.5 pr-9 bg-transparent border-0 outline-none ring-0 shadow-none text-sm font-medium text-stone-900 placeholder:text-stone-400 placeholder:truncate"
                placeholder={placeholder}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoComplete="off"
              />
              {q ? (
                <button type="button" onClick={clearSearch} className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 z-[1]" aria-label="Clear search">
                  <X size={14} />
                </button>
              ) : null}
            </div>
          </div>
          <button type="submit" className="btn-primary h-11 px-5 flex-shrink-0 !shadow-none" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </button>
          <button
            type="button"
            title="Filters"
            aria-label="Filters"
            onClick={() => setShowAdvancedSearch?.((v) => !v)}
            className={`relative ${iconBtn} ${
              showAdvancedSearch || activeAdvFilterCount > 0
                ? 'border-brand-500 bg-brand-50 text-brand-800'
                : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50 text-stone-600'
            }`}
          >
            <Filter size={16} strokeWidth={1.75} />
            {activeAdvFilterCount > 0 ? (
              <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[1.1rem] h-4 px-1 rounded-full bg-stone-900 text-white text-[9px] font-bold tabular-nums">
                {activeAdvFilterCount}
              </span>
            ) : null}
          </button>
          {Array.isArray(columnOptions) && columnOptions.length > 0 ? (
            <ColumnsPicker
              columns={columnOptions}
              visibleIds={visibleColumnIds}
              onChange={onVisibleColumnsChange}
              onSelectAll={onSelectAllColumns}
              onClearAll={onClearAllColumns}
              onReset={onResetColumns}
              buttonClassName={`${iconBtn} border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50`}
              iconOnly
            />
          ) : null}
        </form>
        {filterPanel}
      </div>

      <div className="px-4 sm:px-5 pt-3 border-b border-stone-100">
        <div className="flex items-end gap-1 min-w-0 flex-wrap">
          {(entityTabs.length ? entityTabs : ENTITY_FILTERS).map((f) => {
            const active = entity === f.key;
            const count = tabCount(f, counts, countsLoading);
            const disabled = Boolean(f.disabled);
            return (
              <button
                key={f.key}
                type="button"
                disabled={disabled}
                title={undefined}
                onClick={() => setEntity(f.key)}
                className={`px-3.5 py-2.5 text-xs font-bold border-b-2 -mb-px whitespace-nowrap ${
                  disabled
                    ? 'border-transparent text-stone-400 cursor-default'
                    : active
                      ? 'border-brand-600 text-brand-800'
                      : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                {f.label}
                {hasRun ? (
                  <span className="ml-1.5 tabular-nums font-semibold opacity-70">
                    {count == null || count.pending
                      ? '…'
                      : Number(count.n).toLocaleString()}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div data-tour="search-results" className="min-w-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

export function GlobalSearchSimpleResults({
  loading, hasRun, entity, data, relatedJob, page, pageSize, totalForEntity, onPageChange, appliedQuery, clearSearch,
}) {
  const tableRows = buildTableRows(entity, data);
  const from = totalForEntity ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(page * pageSize, totalForEntity || 0);
  const lastPage = Math.max(1, Math.ceil((totalForEntity || 0) / pageSize));

  if (loading && hasRun && tableRows.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-stone-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Searching…
      </div>
    );
  }
  if (!loading && !hasRun) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Search}
          tone="brand"
          message="No search run yet"
          subMessage="Enter keywords or open Filters, then select Search."
        />
      </div>
    );
  }
  if (!loading && hasRun && tableRows.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Search}
          tone="amber"
          message="No matching records"
          subMessage={`No results for “${appliedQuery || 'the current filters'}”. Adjust the criteria and search again.`}
          action={<button type="button" className="btn-secondary" onClick={clearSearch}>Clear search</button>}
        />
      </div>
    );
  }
  return (
    <>
      <div className={`overflow-x-auto ${loading ? 'opacity-60' : ''}`}>
        <table className="min-w-full text-left">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr>
              <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-stone-400">Source</th>
              <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-stone-400">Name</th>
              <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-stone-400">Details</th>
              <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-stone-400">Status</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {tableRows.map((r) => {
              const kind = r._kind || entity;
              const name = rowName(kind, r);
              const badge = statusBadgeClass(r.status || r.stage || r.meta);
              return (
                <tr key={`${kind}-${r._id}`} className="border-t border-stone-100 hover:bg-stone-50/80">
                  <td className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-stone-500 whitespace-nowrap">{kindLabel(kind)}</td>
                  <td className="px-3 py-2.5 text-sm font-semibold text-stone-900 break-words max-w-[16rem]">{name}</td>
                  <td className="px-3 py-2.5 text-[12px] text-stone-500 break-words max-w-[28rem]">{rowDetail(kind, r)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {badge ? <span className={`${badge} text-[10px] capitalize`}>{String(r.status || r.stage || '').replace(/_/g, ' ')}</span> : <span className="text-stone-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <Link to={rowHref(kind, r, relatedJob)} className="text-stone-400 hover:text-brand-600" aria-label={`Open ${name}`}>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-stone-100 bg-stone-50/80">
        <p className="text-[11px] font-medium text-stone-500 tabular-nums">
          {totalForEntity
            ? `Showing ${from.toLocaleString()}–${to.toLocaleString()} of ${totalForEntity.toLocaleString()} · ${pageSize} per page`
            : `${tableRows.length} rows`}
        </p>
        <div className="flex items-center gap-1">
          <button type="button" className="btn-secondary !px-2 !py-1" disabled={page <= 1} onClick={() => onPageChange?.(page - 1)} aria-label="Previous page">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-[11px] font-semibold text-stone-600 tabular-nums px-2">{page} / {lastPage}</span>
          <button type="button" className="btn-secondary !px-2 !py-1" disabled={page >= lastPage} onClick={() => onPageChange?.(page + 1)} aria-label="Next page">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
}
