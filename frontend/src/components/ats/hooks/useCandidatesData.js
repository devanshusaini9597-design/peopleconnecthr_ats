import { useState, useCallback, useRef } from 'react';
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
    if (options.ids) {
      const idList = Array.isArray(options.ids)
        ? options.ids
        : String(options.ids || '').split(/[,\s]+/);
      const cleaned = [...new Set(idList.map((id) => String(id || '').trim()).filter(Boolean))];
      if (cleaned.length) params.append('ids', cleaned.join(','));
    }

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

  const fetchJobsOnce = async () => {
    if (jobsLoadedRef.current) return;
    // Freelancers use mandates, not the company jobs catalog — skip extra round-trip.
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
  };

  /** Server-side page fetch — filters/search run in Mongo, not in the browser. */
  const fetchData = async (page = 1, options = {}) => {
    const gen = ++loadGenRef.current;
    const pageNum = Math.max(1, Number(page) || 1);
    try {
      setIsLoadingInitial(true);
      setIsLoadingMore(pageNum > 1);

      const params = buildParams(pageNum, PAGE_SIZE, options);
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
        toast.error('Invalid response from server');
        setCandidates([]);
        return;
      }

      const parsed = parseCandidatesResponse(res, response);
      if (parsed.error) {
        toast.error(parsed.error);
        setCandidates([]);
      } else if (Array.isArray(parsed.candidatesData)) {
        setCandidates(parsed.candidatesData);
        setTotalPages(Math.max(1, parsed.pages || 1));
        setTotalRecordsInDB(parsed.total || 0);
        setCurrentPage(pageNum);
      }

      void fetchJobsOnce();
    } catch (error) {
      console.error('❌ Error fetching data:', error);
      toast.error('Failed to load candidates. Please refresh page or check your connection.');
    } finally {
      if (gen === loadGenRef.current) {
        setIsLoadingMore(false);
        setIsLoadingInitial(false);
      }
    }
  };

  /** IDs for "select all matching" (capped server-side). */
  const fetchMatchingIds = async (options = {}) => {
    const params = buildParams(1, PAGE_SIZE, { ...options, idsOnly: true });
    const res = await authenticatedFetch(`${API_URL}?${params.toString()}`, { cache: 'no-store' });
    if (isUnauthorized(res)) {
      handleUnauthorized();
      return { ids: [], totalCount: 0, capped: false };
    }
    const json = await res.json();
    if (!res.ok || json?.success === false) {
      throw new Error(json?.message || 'Failed to load matching IDs');
    }
    const ids = Array.isArray(json?.ids) ? json.ids.map(String) : [];
    return {
      ids,
      totalCount: Number(json?.pagination?.totalCount) || ids.length,
      capped: Boolean(json?.pagination?.capped),
    };
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
