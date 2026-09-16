import { useState, useMemo, useEffect, useCallback } from 'react';
import { EMPTY_ADVANCED_FILTERS, PAGE_SIZE } from '../atsConstants';
import { is100PercentCorrect } from '../utils/candidateFormatters';

function snapshotFilters({
  advancedSearchFilters,
  activityPeriod,
  activityFrom,
  activityTo,
  sortField,
  sortOrder,
}) {
  return {
    advancedSearchFilters: { ...EMPTY_ADVANCED_FILTERS, ...(advancedSearchFilters || {}) },
    activityPeriod: String(activityPeriod || '').trim(),
    activityFrom: String(activityFrom || '').trim(),
    activityTo: String(activityTo || '').trim(),
    sortField: String(sortField || 'date').trim() || 'date',
    sortOrder: String(sortOrder || 'desc').trim() || 'desc',
  };
}

/**
 * Filter UI state for Candidates.
 * Advanced filters are draft until Apply / Search is clicked (enterprise style).
 * Toolbar search / status from URL still update the list live.
 */
export function useCandidateFilters(
  candidates = [],
  {
    freelanceOnly = false,
    serverMode = false,
    serverTotalCount = 0,
    serverTotalPages = 1,
  } = {},
) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState('all');
  const [filterJob, setFilterJob] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  /** Freelancer mandate drill-down: only candidates submitted to a mandate. */
  const [idFilter, setIdFilter] = useState([]);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);

  const [advancedSearchFilters, setAdvancedSearchFilters] = useState({ ...EMPTY_ADVANCED_FILTERS });
  const [activityPeriod, setActivityPeriod] = useState('');
  const [activityFrom, setActivityFrom] = useState('');
  const [activityTo, setActivityTo] = useState('');
  const [sortField, setSortField] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');

  const [appliedFilters, setAppliedFilters] = useState(() => snapshotFilters({
    advancedSearchFilters: { ...EMPTY_ADVANCED_FILTERS },
    activityPeriod: '',
    activityFrom: '',
    activityTo: '',
    sortField: 'date',
    sortOrder: 'desc',
  }));

  const [showOnlyCorrect, setShowOnlyCorrect] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const draftSnapshot = useMemo(
    () => snapshotFilters({
      advancedSearchFilters,
      activityPeriod,
      activityFrom,
      activityTo,
      sortField,
      sortOrder,
    }),
    [advancedSearchFilters, activityPeriod, activityFrom, activityTo, sortField, sortOrder],
  );

  const filtersDirty = useMemo(
    () => JSON.stringify(draftSnapshot) !== JSON.stringify(appliedFilters),
    [draftSnapshot, appliedFilters],
  );

  const applyAdvancedFilters = useCallback(() => {
    const next = snapshotFilters({
      advancedSearchFilters,
      activityPeriod,
      activityFrom,
      activityTo,
      sortField,
      sortOrder,
    });
    // Custom range needs both dates
    if (next.activityPeriod === 'custom' && (!next.activityFrom || !next.activityTo)) {
      return { ok: false, message: 'Select both From and To dates for a custom range.' };
    }
    setAppliedFilters(next);
    setCurrentPage(1);
    return { ok: true };
  }, [advancedSearchFilters, activityPeriod, activityFrom, activityTo, sortField, sortOrder]);

  const clearAdvancedFilters = useCallback(() => {
    const empty = snapshotFilters({
      advancedSearchFilters: { ...EMPTY_ADVANCED_FILTERS },
      activityPeriod: '',
      activityFrom: '',
      activityTo: '',
      sortField: 'date',
      sortOrder: 'desc',
    });
    setAdvancedSearchFilters({ ...EMPTY_ADVANCED_FILTERS });
    setActivityPeriod('');
    setActivityFrom('');
    setActivityTo('');
    setSortField('date');
    setSortOrder('desc');
    setAppliedFilters(empty);
    setCurrentPage(1);
  }, []);

  /** Sync URL/dashboard period into both draft + applied (external navigation). */
  const syncActivityFromUrl = useCallback((period, from, to) => {
    const p = String(period || '').trim();
    const f = String(from || '').trim();
    const t = String(to || '').trim();
    setActivityPeriod(p);
    setActivityFrom(f);
    setActivityTo(t);
    setAppliedFilters((prev) => ({
      ...prev,
      activityPeriod: p,
      activityFrom: f,
      activityTo: t,
    }));
  }, []);

  const activeAdvFilterCount = useMemo(() => {
    const adv = appliedFilters.advancedSearchFilters || {};
    const advCount = Object.values(adv).filter((v) => Boolean(String(v || '').trim())).length;
    const periodCount = appliedFilters.activityPeriod && appliedFilters.activityPeriod !== 'all' ? 1 : 0;
    return advCount + periodCount;
  }, [appliedFilters]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, searchScope, statusFilter, idFilter, showOnlyCorrect, freelanceOnly]);

  const listQueryOptions = useMemo(() => {
    const adv = appliedFilters.advancedSearchFilters || {};
    const ids = Array.isArray(idFilter)
      ? idFilter.map((id) => String(id || '').trim()).filter(Boolean)
      : [];
    return {
      search: searchQuery.trim(),
      searchScope,
      status: statusFilter,
      ids: ids.length ? ids : undefined,
      position: String(adv.position || filterJob || '').trim(),
      location: String(adv.location || '').trim(),
      companyName: String(adv.companyName || '').trim(),
      skills: String(adv.skills || '').trim(),
      product: String(adv.product || '').trim(),
      spoc: String(adv.spoc || '').trim(),
      client: String(adv.client || '').trim(),
      date: '',
      dateRange: String(appliedFilters.activityPeriod || '').trim(),
      customFrom: String(appliedFilters.activityFrom || '').trim(),
      customTo: String(appliedFilters.activityTo || '').trim(),
      expMin: String(adv.expMin || '').trim(),
      expMax: String(adv.expMax || '').trim(),
      ctcMin: String(adv.ctcMin || '').trim(),
      ctcMax: String(adv.ctcMax || '').trim(),
      expectedCtcMin: String(adv.expectedCtcMin || '').trim(),
      expectedCtcMax: String(adv.expectedCtcMax || '').trim(),
      sortField: appliedFilters.sortField || 'date',
      sortOrder: appliedFilters.sortOrder || 'desc',
      freelanceOnly: Boolean(freelanceOnly),
    };
  }, [
    searchQuery, searchScope, statusFilter, idFilter, filterJob, appliedFilters, freelanceOnly,
  ]);

  const pageCandidates = useMemo(() => {
    if (!showOnlyCorrect) return candidates;
    return candidates.filter((c) => is100PercentCorrect(c));
  }, [candidates, showOnlyCorrect]);

  const filteredCandidates = pageCandidates;
  const sortedCandidates = pageCandidates;
  const totalFilteredPages = serverMode
    ? Math.max(1, serverTotalPages || 1)
    : Math.max(1, Math.ceil(pageCandidates.length / PAGE_SIZE) || 1);
  const filteredCount = serverMode
    ? Math.max(0, serverTotalCount || 0)
    : pageCandidates.length;

  const visibleCandidates = useMemo(() => {
    if (serverMode) return pageCandidates;
    const safePage = Math.min(Math.max(1, currentPage), totalFilteredPages);
    const startIdx = (safePage - 1) * PAGE_SIZE;
    return pageCandidates.slice(startIdx, startIdx + PAGE_SIZE);
  }, [serverMode, pageCandidates, currentPage, totalFilteredPages]);

  return {
    idFilter, setIdFilter,
    searchQuery, setSearchQuery,
    searchScope, setSearchScope,
    filterJob, setFilterJob,
    statusFilter, setStatusFilter,
    showAdvancedSearch, setShowAdvancedSearch,
    advancedSearchFilters, setAdvancedSearchFilters,
    activityPeriod, setActivityPeriod,
    activityFrom, setActivityFrom,
    activityTo, setActivityTo,
    sortField, setSortField,
    sortOrder, setSortOrder,
    showOnlyCorrect, setShowOnlyCorrect,
    currentPage, setCurrentPage,
    clearAdvancedFilters,
    applyAdvancedFilters,
    syncActivityFromUrl,
    filtersDirty,
    activeAdvFilterCount,
    appliedFilters,
    listQueryOptions,
    filteredCandidates,
    sortedCandidates,
    visibleCandidates,
    totalFilteredPages,
    filteredCount,
    PAGE_SIZE,
  };
}
