import { useState, useMemo, useEffect, useCallback } from 'react';
import { EMPTY_ADVANCED_FILTERS, PAGE_SIZE } from '../atsConstants';
import { is100PercentCorrect } from '../utils/candidateFormatters';

/**
 * Filter UI state for Candidates.
 * When serverMode is true, the API owns search/sort/pagination — this hook
 * only holds control state and presents the current page of rows.
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
  const [showOnlyCorrect, setShowOnlyCorrect] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const clearAdvancedFilters = useCallback(() => {
    setAdvancedSearchFilters({ ...EMPTY_ADVANCED_FILTERS });
  }, []);

  const activeAdvFilterCount = Object.values(advancedSearchFilters).filter((v) => Boolean(String(v || '').trim())).length
    + (activityPeriod && activityPeriod !== 'all' ? 1 : 0);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, searchScope, advancedSearchFilters, showOnlyCorrect, statusFilter, idFilter, sortField, sortOrder, freelanceOnly, activityPeriod, activityFrom, activityTo]);

  const listQueryOptions = useMemo(() => {
    const adv = advancedSearchFilters;
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
      date: String(adv.date || '').trim(),
      dateRange: String(activityPeriod || '').trim(),
      customFrom: String(activityFrom || '').trim(),
      customTo: String(activityTo || '').trim(),
      expMin: String(adv.expMin || '').trim(),
      expMax: String(adv.expMax || '').trim(),
      ctcMin: String(adv.ctcMin || '').trim(),
      ctcMax: String(adv.ctcMax || '').trim(),
      expectedCtcMin: String(adv.expectedCtcMin || '').trim(),
      expectedCtcMax: String(adv.expectedCtcMax || '').trim(),
      sortField,
      sortOrder,
      freelanceOnly: Boolean(freelanceOnly),
    };
  }, [
    searchQuery, searchScope, statusFilter, idFilter, filterJob, advancedSearchFilters,
    sortField, sortOrder, freelanceOnly, activityPeriod, activityFrom, activityTo,
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
    activeAdvFilterCount,
    listQueryOptions,
    filteredCandidates,
    sortedCandidates,
    visibleCandidates,
    totalFilteredPages,
    filteredCount,
    PAGE_SIZE,
  };
}
