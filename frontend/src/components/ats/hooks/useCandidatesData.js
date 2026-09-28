import { useState, useCallback, useRef, useEffect } from 'react';
import BASE_API_URL from '../../../config';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../../../utils/fetchUtils';
import { PAGE_SIZE } from '../atsConstants';

export function useCandidatesData({ candidatesViewMode = 'all', scopeUserId = '', toast } = {}) {
  const API_URL = `${BASE_API_URL}/candidates`;
  const JOBS_URL = `${BASE_API_URL}/api/jobs`;

  const [candidates, setCandidates] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isHeaderLoading, setIsHeaderLoading] = useState(false);
  const [isShowingAll, setIsShowingAll] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [totalRecordsInDB, setTotalRecordsInDB] = useState(0);
  const [blindMode, setBlindMode] = useState(false);
  const loadGenRef = useRef(0);
  const jobsLoadedRef = useRef(false);

  const buildParams = useCallback((page, limit, options = {}) => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    const append = (key, value) => {
      const v = String(value ?? '').trim();
      if (v) params.append(key, v);
    };
    append('search', options.search);
    append('searchScope', options.searchScope);
    append('status', options.status);
    append('position', options.position);
    append('location', options.location);
    append('companyName', options.companyName);
    append('skills', options.skills);
    append('product', options.product);
    append('spoc', options.spoc);
    append('client', options.client);
    append('date', options.date);
    append('dateRange', options.dateRange);
    append('customFrom', options.customFrom);
    append('customTo', options.customTo);
    append('list', options.list);
    append('cohort', options.cohort);
    append('expMin', options.expMin);
    append('expMax', options.expMax);
    append('ctcMin', options.ctcMin);
    append('ctcMax', options.ctcMax);
    append('expectedCtcMin', options.expectedCtcMin);
    append('expectedCtcMax', options.expectedCtcMax);
    append('sortField', options.sortField || 'date');
    append('sortOrder', options.sortOrder || 'desc');
    if (options.freelanceOnly) params.append('freelanceOnly', '1');
    if (options.idsOnly) params.append('idsOnly', '1');
    if (options.idSkip) params.append('idSkip', String(options.idSkip));
    if (options.idLimit) params.append('idLimit', String(options.idLimit));
    if (options.ids) {
      const idList = Array.isArray(options.ids)
        ? options.ids
        : String(options.ids || '').split(/[,\s]+/);
      const cleaned = [...new Set(idList.map((id) => String(id || '').trim()).filter(Boolean))];
      if (cleaned.length) params.append('ids', cleaned.join(','));
    }
    append('jobId', options.jobId);
    append('appSource', options.appSource);
    append('candidateCode', options.candidateCode);
    append('applicationCode', options.applicationCode);

    const effectiveView = scopeUserId ? 'mine' : candidatesViewMode;
    params.append('view', effectiveView);
    if (scopeUserId) params.append('userId', String(scopeUserId));
    return params;
  }, [candidatesViewMode, scopeUserId]);

  const parseCandidatesResponse = (res, response) => {
    let candidatesData = [];
    let pages = 1;
    let total = 0;

    if (!res.ok) {
      return { error: response?.message || `Server error (${res.status})`, candidatesData: null };
    }
    if (response?.success === true && Array.isArray(response?.data)) {
      candidatesData = response.data;
      pages = response.pagination?.totalPages || 1;
      total = response.pagination?.totalCount ?? candidatesData.length;
    } else if (response && Array.isArray(response.data)) {
      candidatesData = response.data;
      pages = response.pagination?.totalPages || 1;
      total = response.pagination?.totalCount ?? candidatesData.length;
    } else if (Array.isArray(response)) {
      candidatesData = response;
      pages = 1;
      total = candidatesData.length;
    } else if (response?.success === false) {
      return { error: response.message || 'Server error', candidatesData: null };
    } else {
      candidatesData = [];
      pages = 1;
      total = 0;
    }
    return { candidatesData, pages, total };
  };

  const fetchJobsList = useCallback(async ({ force = false } = {}) => {
    if (!force && jobsLoadedRef.current) return;
    try {
      const raw = localStorage.getItem('userData');
      const role = raw ? JSON.parse(raw)?.role : '';
      if (role === 'freelancer') {
        jobsLoadedRef.current = true;
        setJobs([]);
        return;
      }
    } catch { /* ignore */ }
    try {
      const jobRes = await authenticatedFetch(`${JOBS_URL}?isTemplate=false`);
      if (isUnauthorized(jobRes)) {
        handleUnauthorized();
        return;
      }
      const jobData = await jobRes.json();
      if (Array.isArray(jobData)) setJobs(jobData);
      else if (jobData?.data && Array.isArray(jobData.data)) setJobs(jobData.data);
      jobsLoadedRef.current = true;
    } catch (jobError) {
      console.warn('⚠️ Failed to load jobs:', jobError.message);
    }
  }, [JOBS_URL]);

  /** Server-side page fetch — filters/search run in Mongo, not in the browser. */
  const fetchData = useCallback(async (page = 1, options = {}) => {
    const { silent = false, refreshJobs = false, ...queryOptions } = options;
    const gen = ++loadGenRef.current;
    const pageNum = Math.max(1, Number(page) || 1);
    try {
      if (!silent) {
        setIsLoadingInitial(true);
        setIsLoadingMore(pageNum > 1);
      }

      const params = buildParams(pageNum, PAGE_SIZE, queryOptions);
      const res = await authenticatedFetch(`${API_URL}?${params.toString()}`, { cache: 'no-store' });
      if (gen !== loadGenRef.current) return;

      if (isUnauthorized(res)) {
        handleUnauthorized();
        return;
      }

      let response;
      try {
        response = await res.json();
      } catch (parseErr) {
        console.error('❌ Failed to parse JSON response:', parseErr);
        if (!silent) toast.error('Invalid response from server');
        if (!silent) setCandidates([]);
        return;
      }

      const parsed = parseCandidatesResponse(res, response);
      if (parsed.error) {
        if (!silent) toast.error(parsed.error);
        if (!silent) setCandidates([]);
      } else if (Array.isArray(parsed.candidatesData)) {
        setCandidates(parsed.candidatesData);
        setTotalPages(Math.max(1, parsed.pages || 1));
        setTotalRecordsInDB(parsed.total || 0);
        setCurrentPage(pageNum);
      }

      void fetchJobsList({ force: silent || refreshJobs });
    } catch (error) {
      console.error('❌ Error fetching data:', error);
      if (!silent) toast.error('Failed to load candidates. Please refresh page or check your connection.');
    } finally {
      if (gen === loadGenRef.current) {
        setIsLoadingMore(false);
        setIsLoadingInitial(false);
      }
    }
  }, [API_URL, buildParams, fetchJobsList, toast]);

  useEffect(() => () => {
    loadGenRef.current += 1;
  }, []);

  /** IDs for "select all matching". */
  const fetchMatchingIds = async (options = {}) => {
    const ids = [];
    let skip = 0;
    let totalCount = 0;
    let capped = false;
    const batch = 3000;
    for (let guard = 0; guard < 80; guard += 1) {
      const params = buildParams(1, PAGE_SIZE, { ...options, idsOnly: true, idSkip: skip, idLimit: batch });
      const res = await authenticatedFetch(`${API_URL}?${params.toString()}`, { cache: 'no-store' });
      if (isUnauthorized(res)) {
        handleUnauthorized();
        return { ids: [], totalCount: 0, capped: false };
      }
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message || 'Failed to load matching IDs');
      }
      const chunk = Array.isArray(json?.ids) ? json.ids.map(String) : [];
      ids.push(...chunk);
      totalCount = Number(json?.pagination?.totalCount) || ids.length;
      capped = capped || Boolean(json?.pagination?.capped);
      const hasMore = Boolean(json?.pagination?.hasMore);
      if (!hasMore || !chunk.length) break;
      skip += chunk.length;
    }
    return { ids, totalCount: totalCount || ids.length, capped };
  };

  return {
    API_URL, JOBS_URL,
    candidates, setCandidates, jobs, setJobs,
    currentPage, setCurrentPage, totalPages, setTotalPages,
    isLoadingMore, isHeaderLoading, isShowingAll, setIsShowingAll,
    isLoadingInitial, setIsLoadingInitial, totalRecordsInDB,
    blindMode, setBlindMode, fetchData, fetchMatchingIds,
  };
}
