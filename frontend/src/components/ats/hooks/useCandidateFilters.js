import { useState, useMemo, useEffect, useCallback } from 'react';
import { EMPTY_ADVANCED_FILTERS, PAGE_SIZE } from '../atsConstants';
import { getCTCRank, is100PercentCorrect } from '../utils/candidateFormatters';

export function useCandidateFilters(candidates = []) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState('all');
  const [filterJob, setFilterJob] = useState('');
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [advancedSearchFilters, setAdvancedSearchFilters] = useState({ ...EMPTY_ADVANCED_FILTERS });
  const [sortField, setSortField] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showOnlyCorrect, setShowOnlyCorrect] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const clearAdvancedFilters = useCallback(() => {
    setAdvancedSearchFilters({ ...EMPTY_ADVANCED_FILTERS });
  }, []);

  const activeAdvFilterCount = Object.values(advancedSearchFilters).filter(Boolean).length;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, searchScope, advancedSearchFilters, showOnlyCorrect]);

  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      const q = searchQuery.trim().toLowerCase();
      let matchesSearch = true;
      if (q) {
        if (searchScope === 'spoc') matchesSearch = (c.spoc || '').toLowerCase().includes(q);
        else if (searchScope === 'name') matchesSearch = (c.name || '').toLowerCase().includes(q);
        else if (searchScope === 'email') matchesSearch = (c.email || '').toLowerCase().includes(q);
        else if (searchScope === 'position') matchesSearch = (c.position || '').toLowerCase().includes(q);
        else if (searchScope === 'location') matchesSearch = (c.location || '').toLowerCase().includes(q);
        else if (searchScope === 'company') matchesSearch = (c.companyName || '').toLowerCase().includes(q);
        else if (searchScope === 'client') matchesSearch = (c.client || '').toLowerCase().includes(q);
        else {
          matchesSearch =
            (c.name || '').toLowerCase().includes(q) ||
            (c.position || '').toLowerCase().includes(q) ||
            (c.email || '').toLowerCase().includes(q) ||
            (c.location || '').toLowerCase().includes(q) ||
            (c.companyName || '').toLowerCase().includes(q) ||
            (c.contact || '').toLowerCase().includes(q) ||
            (c.spoc || '').toLowerCase().includes(q);
        }
      }

      const adv = advancedSearchFilters;
      const matchesAdvPosition = adv.position
        ? (c.position?.toLowerCase() === adv.position.toLowerCase())
        : true;
      const matchesAdvCompany = adv.companyName
        ? (c.companyName?.toLowerCase().includes(adv.companyName.toLowerCase()) || false)
        : true;
      const matchesAdvLocation = adv.location
        ? (c.location?.toLowerCase().includes(adv.location.toLowerCase()) || false)
        : true;
      const candidateExp = parseFloat(c.experience) || 0;
      const expMin = adv.expMin ? parseFloat(adv.expMin) : null;
      const expMax = adv.expMax ? parseFloat(adv.expMax) : null;
      const matchesExpRange =
        (expMin === null || candidateExp >= expMin) &&
        (expMax === null || candidateExp <= expMax);
      const candidateCTCRank = getCTCRank(c.ctc);
      const ctcMinRank = adv.ctcMin ? getCTCRank(adv.ctcMin) : null;
      const ctcMaxRank = adv.ctcMax ? getCTCRank(adv.ctcMax) : null;
      const matchesCTCRange =
        (ctcMinRank === null || candidateCTCRank >= ctcMinRank) &&
        (ctcMaxRank === null || candidateCTCRank <= ctcMaxRank);
      const candidateExpCTCRank = getCTCRank(c.expectedCtc);
      const expectedCtcMinRank = adv.expectedCtcMin ? getCTCRank(adv.expectedCtcMin) : null;
      const expectedCtcMaxRank = adv.expectedCtcMax ? getCTCRank(adv.expectedCtcMax) : null;
      const matchesExpectedCTCRange =
        (expectedCtcMinRank === null || candidateExpCTCRank >= expectedCtcMinRank) &&
        (expectedCtcMaxRank === null || candidateExpCTCRank <= expectedCtcMaxRank);
      const matchesDate = adv.date ? (c.date?.includes(adv.date) || false) : true;
      const matchesAdvanced =
        matchesAdvPosition && matchesAdvCompany && matchesAdvLocation &&
        matchesExpRange && matchesCTCRange && matchesExpectedCTCRange && matchesDate;
      const matchesCorrect = showOnlyCorrect ? is100PercentCorrect(c) : true;
      return matchesSearch && matchesAdvanced && matchesCorrect;
    });
  }, [candidates, searchQuery, searchScope, advancedSearchFilters, showOnlyCorrect]);

  const sortedCandidates = useMemo(() => {
    const sorted = [...filteredCandidates];
    sorted.sort((a, b) => {
      let valA;
      let valB;
      switch (sortField) {
        case 'name': valA = (a.name || '').toLowerCase(); valB = (b.name || '').toLowerCase(); break;
        case 'email': valA = (a.email || '').toLowerCase(); valB = (b.email || '').toLowerCase(); break;
        case 'position': valA = (a.position || '').toLowerCase(); valB = (b.position || '').toLowerCase(); break;
        case 'location': valA = (a.location || '').toLowerCase(); valB = (b.location || '').toLowerCase(); break;
        case 'company': valA = (a.companyName || '').toLowerCase(); valB = (b.companyName || '').toLowerCase(); break;
        case 'status': valA = (a.status || '').toLowerCase(); valB = (b.status || '').toLowerCase(); break;
        case 'spoc': valA = (a.spoc || '').toLowerCase(); valB = (b.spoc || '').toLowerCase(); break;
        case 'date':
        default:
          valA = a.createdAt ? new Date(a.createdAt).getTime() : (a.date ? new Date(a.date).getTime() : 0);
          valB = b.createdAt ? new Date(b.createdAt).getTime() : (b.date ? new Date(b.date).getTime() : 0);
          break;
      }
      if (typeof valA === 'string') {
        const cmp = valA.localeCompare(valB);
        return sortOrder === 'asc' ? cmp : -cmp;
      }
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });
    return sorted;
  }, [filteredCandidates, sortField, sortOrder]);

  const totalFilteredPages = Math.max(1, Math.ceil(sortedCandidates.length / PAGE_SIZE) || 1);
  const visibleCandidates = useMemo(() => {
    const startIdx = (currentPage - 1) * PAGE_SIZE;
    return sortedCandidates.slice(startIdx, startIdx + PAGE_SIZE);
  }, [sortedCandidates, currentPage]);

  return {
    searchQuery, setSearchQuery,
    searchScope, setSearchScope,
    filterJob, setFilterJob,
    showAdvancedSearch, setShowAdvancedSearch,
    advancedSearchFilters, setAdvancedSearchFilters,
    sortField, setSortField,
    sortOrder, setSortOrder,
    showOnlyCorrect, setShowOnlyCorrect,
    currentPage, setCurrentPage,
    clearAdvancedFilters,
    activeAdvFilterCount,
    filteredCandidates,
    sortedCandidates,
    visibleCandidates,
    totalFilteredPages,
    PAGE_SIZE,
  };
}
