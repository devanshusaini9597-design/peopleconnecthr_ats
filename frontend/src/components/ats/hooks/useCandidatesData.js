import { useState, useCallback, useEffect } from 'react';
import BASE_API_URL from '../../../config';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../../../utils/fetchUtils';

export function useCandidatesData({ candidatesViewMode = "all", toast } = {}) {
  const API_URL = `${BASE_API_URL}/candidates`;
  const JOBS_URL = `${BASE_API_URL}/jobs`;

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

  const fetchData = async (page = 1, options = {}) => {
    try {
      setIsLoadingInitial(true);
      const search = (options.search || '').trim();
      const position = (options.position || '').trim();
      const isSearch = Boolean(search || position);
      
      // ✅ FETCH ALL DATA: Always load all records so filtering/search works across entire DB
      const limit = 50000;
      
      setIsLoadingMore(page > 1 && !isSearch);

      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit)
      });
      if (search) params.append('search', search);
      if (position) params.append('position', position);
      // view=mine (default): own + shared; view=all: all candidates in DB
      params.append('view', candidatesViewMode);

      console.log('📤 Fetching candidates from:', `${API_URL}?${params.toString()}`);
      // Run candidates and jobs in parallel so initial load is faster
      const [res, jobRes] = await Promise.all([
        authenticatedFetch(`${API_URL}?${params.toString()}`, { cache: 'no-store' }),
        authenticatedFetch(`${JOBS_URL}?isTemplate=false`)
      ]);

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

      console.log('🔍 HTTP Status:', res.status, 'OK:', res.ok);
      console.log('🔍 API Response - isSearch:', isSearch, 'limit:', limit, 'page:', page);
      console.log('🔍 API Response:', response);
      console.log('🔍 response.success:', response?.success, 'response.data type:', Array.isArray(response?.data) ? `array[${response.data.length}]` : typeof response?.data);

      // Handle both paginated and raw array formats — only update list on success so failed "View all" doesn't wipe the list
      let candidatesData = [];
      let pages = 1;

      // Check HTTP status first — on failure, keep previous candidates and toast (do not clear)
      if (!res.ok) {
        console.error('❌ HTTP Error:', res.status, response?.message || response?.error);
        toast.error(response?.message || `Server error (${res.status})`);
        candidatesData = null; // signal: do not update state
      }
      // Format 1: Success response with pagination
      else if (response?.success === true && Array.isArray(response?.data)) {
        candidatesData = response.data;
        pages = response.pagination?.totalPages || 1;
        const total = response.pagination?.totalCount ?? candidatesData.length;
        setTotalPages(pages);
        setTotalRecordsInDB(total);
        console.log('✅ Candidates loaded (paginated):', candidatesData.length, 'Total:', total);
      }
      // Format 2: Response with data property (success may be undefined)
      else if (response && Array.isArray(response.data)) {
        candidatesData = response.data;
        pages = response.pagination?.totalPages || 1;
        const total = response.pagination?.totalCount ?? candidatesData.length;
        setTotalPages(pages);
        setTotalRecordsInDB(total);
        console.log('✅ Candidates loaded (data property):', candidatesData.length, 'Total:', total);
      }
      // Format 3: Raw array response (legacy)
      else if (Array.isArray(response)) {
        candidatesData = response;
        setTotalPages(1);
        setTotalRecordsInDB(candidatesData.length);
        console.log('✅ Candidates loaded (raw array):', candidatesData.length);
      }
      // Format 4: Error response
      else if (response?.success === false) {
        console.error('❌ API Error:', response.message);
        toast.error(response.message || 'Server error');
        candidatesData = null;
      }
      // Format 5: Empty or unexpected
      else {
        console.warn('⚠️ Unexpected format - treating as empty result:', response);
        candidatesData = [];
        setTotalPages(1);
        setTotalRecordsInDB(0);
      }

      if (candidatesData !== null && Array.isArray(candidatesData)) {
        if (page === 1) {
          setCandidates(candidatesData);
        } else {
          setCandidates(prev => [...prev, ...candidatesData]);
        }
        setCurrentPage(page);
      }

      // Process jobs (fetched in parallel above)
      try {
        if (isUnauthorized(jobRes)) {
          handleUnauthorized();
          return;
        }
        const jobData = await jobRes.json();
        if (Array.isArray(jobData)) {
          setJobs(jobData);
        } else if (jobData && jobData.data && Array.isArray(jobData.data)) {
          setJobs(jobData.data);
        }
      } catch (jobError) {
        console.warn('⚠️ Failed to load jobs:', jobError.message);
      }
    } catch (error) {
      console.error("❌ Error fetching data:", error);
      toast.error('Failed to load candidates. Please refresh page or check your connection.');
      // Do not clear candidates on network error so "View all" / switch doesn't wipe the list
    } finally {
      setIsLoadingMore(false);
      setIsLoadingInitial(false);
    }
  };

  return {
    API_URL, JOBS_URL,
    candidates, setCandidates, jobs, setJobs,
    currentPage, setCurrentPage, totalPages, setTotalPages,
    isLoadingMore, isHeaderLoading, isShowingAll, setIsShowingAll,
    isLoadingInitial, setIsLoadingInitial, totalRecordsInDB,
    blindMode, setBlindMode, fetchData,
  };
}
