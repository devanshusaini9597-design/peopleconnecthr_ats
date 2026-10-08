import React, { useState, useEffect, useMemo, forwardRef, useImperativeHandle, useCallback, useRef } from 'react';
import { Briefcase, Loader2, Hash } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useParsing } from '../hooks/useParsing';
import { authenticatedFetch } from '../utils/fetchUtils';
import { useToast } from './Toast';
import usePageTour from '../hooks/usePageTour';
import { useAuth } from '../context/AuthContext';
import { canUseFeature } from '../config/planFeatures';
import { ctcRanges } from '../utils/ctcRanges';
import { canViewOrgCandidateBook } from '../utils/analyticsScope';
import useEmployeeAnalyticsScope from '../hooks/useEmployeeAnalyticsScope';
import EmployeeScopeSelect from './analytics/EmployeeScopeSelect';
import { buildAtsHref } from '../utils/atsLinks';

import {
  CAND_TOUR_KEY,
  CANDIDATE_EXPORT_ROLES,
  blankCandidateForm,
} from './ats/atsConstants';
import { useCandidatesData } from './ats/hooks/useCandidatesData';
import { useCandidateFilters } from './ats/hooks/useCandidateFilters';
import { useCandidateImport } from './ats/hooks/useCandidateImport';
import { useCandidateEmail } from './ats/hooks/useCandidateEmail';
import { useCandidateShare } from './ats/hooks/useCandidateShare';
import { useCandidateForm } from './ats/hooks/useCandidateForm';
import { useResumePreview } from './ats/hooks/useResumePreview';
import { useTableDragScroll } from './ats/hooks/useTableDragScroll';
import { useBulkCandidateActions } from './ats/hooks/useBulkCandidateActions';
import { buildCandidateTableColumns } from './ats/candidateTableColumns';
import {
  CANDIDATE_LOCKED_COLUMN_KEYS,
  loadCandidateColumnPrefs,
  saveCandidateColumnPrefs,
  resolveVisibleColumnIds,
} from './ats/candidateColumnPrefs';
import CandidatesPageHeader from './ats/CandidatesPageHeader';
import CandidatesBulkToolbar from './ats/CandidatesBulkToolbar';
import CandidatesSearchToolbar from './ats/CandidatesSearchToolbar';
import CandidatesAdvancedFilters from './ats/CandidatesAdvancedFilters';
import CandidatesTable from './ats/CandidatesTable';
import CandidatesPagination from './ats/CandidatesPagination';
import ATSModals from './ats/ATSModals';

/**
 * Candidates page shell — wires hooks + layout. Modals live in ATSModals.
 */
const ATS = forwardRef((props, ref) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const [tourOpen, setTourOpen] = usePageTour(CAND_TOUR_KEY);
  const { organization, user } = useAuth();
  const isFreelancer = user?.role === 'freelancer';
  const canExportCandidates = CANDIDATE_EXPORT_ROLES.includes(user?.role);
  const orgPlan = organization?.plan;
  const { onImportComplete } = props || {};
  const LIST_REFRESH_MS = 60 * 60 * 1000; // hourly auto-refresh
  const [listRefreshing, setListRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const listQueryOptionsRef = useRef(null);

  const viewFromUrl = String(searchParams.get('view') || '').toLowerCase();
  const canSeeOrgCandidates = canViewOrgCandidateBook(user?.role);
  const employeeScope = useEmployeeAnalyticsScope();
  // Employees always stay on their own desk. Owner/admin may open the org book or one employee.
  const candidatesViewMode = isFreelancer
    ? 'mine'
    : !canSeeOrgCandidates
      ? (viewFromUrl === 'shared' ? 'shared' : 'mine')
      : employeeScope.userId
        ? 'mine'
        : (viewFromUrl === 'mine' || viewFromUrl === 'shared' || viewFromUrl === 'all'
          ? viewFromUrl
          : 'all');
  const [freelanceOnly, setFreelanceOnly] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const viewMode = candidatesViewMode;

  const data = useCandidatesData({
    candidatesViewMode,
    scopeUserId: canSeeOrgCandidates ? (employeeScope.userId || '') : '',
    toast,
  });
  const {
    API_URL, candidates, jobs, blindMode, setBlindMode, isLoadingInitial, fetchData, fetchMatchingIds,
    totalRecordsInDB, totalPages: serverTotalPages,
  } = data;

  const filters = useCandidateFilters(candidates, {
    freelanceOnly: freelanceOnly && !isFreelancer,
    serverMode: true,
    serverTotalCount: totalRecordsInDB,
    serverTotalPages,
  });
  const {
    searchQuery, setSearchQuery, searchScope, setSearchScope, filterJob,
    jobIdFilter, setJobIdFilter,
    jobAppSource, setJobAppSource,
    statusFilter, setStatusFilter,
    idFilter, setIdFilter,
    showAdvancedSearch, setShowAdvancedSearch,
    advancedSearchFilters, setAdvancedSearchFilters,
    activityPeriod, setActivityPeriod,
    activityFrom, setActivityFrom,
    activityTo, setActivityTo,
    sortField, sortOrder, applySortChange,
    currentPage, setCurrentPage, clearAdvancedFilters, applyAdvancedFilters,
    syncActivityFromUrl, filtersDirty, activeAdvFilterCount, appliedFilters,
    listQueryOptions, filteredCandidates, visibleCandidates, totalFilteredPages, filteredCount,
  } = filters;
  const appliedPeriod = appliedFilters?.activityPeriod || '';
  const appliedFrom = appliedFilters?.activityFrom || '';
  const appliedTo = appliedFilters?.activityTo || '';
  const appliedList = appliedFilters?.listKind || '';
  const appliedCohort = appliedFilters?.cohortMonth || '';
  listQueryOptionsRef.current = listQueryOptions;
  const mandateLabel = String(searchParams.get('mandate') || '').trim();

  const refreshCandidates = useCallback(async () => {
    setListRefreshing(true);
    try {
      await fetchData(currentPage, { ...(listQueryOptionsRef.current || {}), silent: true, refreshJobs: true });
      setLastSyncedAt(new Date());
    } finally {
      setListRefreshing(false);
    }
  }, [fetchData, currentPage]);

  const refreshRef = useRef(refreshCandidates);
  refreshRef.current = refreshCandidates;
  const lastSyncedRef = useRef(lastSyncedAt);
  lastSyncedRef.current = lastSyncedAt;

  useEffect(() => {
    const shouldAutoRefresh = () => {
      if (document.visibilityState !== 'visible') return false;
      const last = lastSyncedRef.current;
      if (!last) return true;
      return (Date.now() - new Date(last).getTime()) >= LIST_REFRESH_MS;
    };
    const tick = () => {
      if (!shouldAutoRefresh()) return;
      refreshRef.current().catch(() => {});
    };
    const id = window.setInterval(tick, LIST_REFRESH_MS);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  const importer = useCandidateImport({
    toast, fetchData, searchQuery, filterJob, onImportComplete,
  });
  const {
    fileInputRef, autoUploadInputRef, isUploading,
    showColumnMapper, setShowColumnMapper, excelHeaders, setPendingFile,
    handleBulkUpload, handleAutoUpload, handleUploadWithMapping,
  } = importer;

  const { selectedIds, setSelectedIds, toggleSelection, selectAll, togglePageSelection } = useParsing(async () => {
    await fetchData(1, listQueryOptions);
  });
  const [selectingAll, setSelectingAll] = useState(false);
  const [allMatching, setAllMatching] = useState(false);

  const bulk = useBulkCandidateActions({
    toast, candidates, selectedIds, setSelectedIds, API_URL,
    searchQuery, filterJob, currentPage, setCurrentPage, fetchData,
    isFreelancer,
    refreshList: () => fetchData(currentPage, { ...(listQueryOptionsRef.current || {}), silent: true }),
  });
  const {
    sendWhatsApp, handleBulkWhatsApp, handleBulkDelete, handleBulkStatusUpdate,
    openBulkEdit, handleDelete, handleFindDuplicates, dedupeLoading,
    bulkStatusOpen, setBulkStatusOpen,
  } = bulk;

  const email = useCandidateEmail({
    toast, candidates, selectedIds, setSelectedIds, setConfirmModal: bulk.setConfirmModal, navigate,
  });
  const {
    showVerifiedEmailRequiredModal, setShowVerifiedEmailRequiredModal,
    verifiedEmailRequiredMessage, setVerifiedEmailRequiredMessage,
    startBulkEmailFlow, handleSendEmail,
  } = email;

  const share = useCandidateShare({
    toast, candidates, selectedIds, setSelectedIds, fetchData, searchQuery, filterJob, candidatesViewMode,
  });
  const {
    isImportingShared, isImportingAll,
    handleShareClick, handleImportSharedToMineClick, handleImportAllToMineClick,
  } = share;

  const form = useCandidateForm({
    toast, fetchData, searchQuery, filterJob, currentPage, setCurrentPage, API_URL,
    jobIdFilter,
    jobs,
    viewMode: candidatesViewMode,
  });
  const {
    setShowModal, setEditId, setFormData, setFormErrors,
    orgCandidateFields, masterPositions, masterProducts, masterClients,
    setCountryCode, setCountryIso, handleEdit, initialFormState, openAddCandidate,
  } = form;

  const resume = useResumePreview({ toast, viewMode: candidatesViewMode });
  const { handleResumePreview, handleResumeDownload } = resume;
  const { tableScrollRef, onTableDragScrollStart, onTableDragScrollMove, onTableDragScrollEnd } = useTableDragScroll();

  useImperativeHandle(ref, () => ({
    triggerAutoImport: () => autoUploadInputRef.current?.click(),
    openAddCandidateModal: () => {
      if (typeof openAddCandidate === 'function') openAddCandidate();
      else {
        setEditId(null);
        setFormData(typeof initialFormState === 'function' ? initialFormState() : blankCandidateForm(user?.role));
        setFormErrors({});
        setCountryCode('+91');
        setCountryIso('IN');
        setShowModal(true);
      }
    },
    refreshCandidates: () => fetchData(1, listQueryOptions),
    autoUploadInputRef,
    fileInputRef,
  }));

  useEffect(() => {
    const q = searchParams.get('q');
    // Always sync URL search into the toolbar so header desk search works for freelancers.
    setSearchQuery(q || '');
    setStatusFilter(searchParams.get('status') || '');
    const jobFromUrl = String(searchParams.get('jobId') || '').trim();
    setJobIdFilter((prev) => (prev === jobFromUrl ? prev : jobFromUrl));
    const appSourceFromUrl = String(searchParams.get('appSource') || '').trim().toLowerCase();
    setJobAppSource((prev) => (prev === appSourceFromUrl ? prev : appSourceFromUrl));
    const period = searchParams.get('period') || '';
    const from = searchParams.get('from') || '';
    const to = searchParams.get('to') || '';
    syncActivityFromUrl(period, from, to, searchParams.get('list') || '', searchParams.get('cohort') || '');
    // Freelancer mandate drill-down: ?ids=a,b,c shows only submitted candidates.
    if (isFreelancer) {
      const rawIds = String(searchParams.get('ids') || '').trim();
      const nextIds = rawIds
        ? [...new Set(rawIds.split(/[,\s]+/).map((id) => id.trim()).filter(Boolean))]
        : [];
      setIdFilter((prev) => {
        const prevKey = (Array.isArray(prev) ? prev : []).join(',');
        const nextKey = nextIds.join(',');
        return prevKey === nextKey ? prev : nextIds;
      });
    } else {
      setIdFilter([]);
    }
    if (q || searchParams.get('ids') || searchParams.get('jobId')) setCurrentPage(1);
  }, [searchParams, isFreelancer, setSearchQuery, setStatusFilter, setIdFilter, setJobIdFilter, syncActivityFromUrl, setCurrentPage]);

  useEffect(() => {
    if (searchParams.get('add') !== '1') return;
    if (typeof openAddCandidate === 'function') openAddCandidate();
    else {
      setEditId(null);
      setFormData(typeof initialFormState === 'function' ? initialFormState() : blankCandidateForm(user?.role));
      setFormErrors({});
      setCountryCode('+91');
      setCountryIso('IN');
      setShowModal(true);
    }
    const next = new URLSearchParams(searchParams);
    next.delete('add');
    setSearchParams(next, { replace: true });
    // Only react to the add=1 flag — not to blankForm identity changes while typing
  }, [searchParams.get('add')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handle = setTimeout(() => {
      fetchData(currentPage, listQueryOptions);
    }, 280);
    return () => clearTimeout(handle);
  }, [
    currentPage,
    listQueryOptions,
    candidatesViewMode,
    employeeScope.userId,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setSelectedIds([]);
  }, [listQueryOptions, candidatesViewMode, employeeScope.userId, setSelectedIds]);

  useEffect(() => {
    if (!canUseFeature(orgPlan, 'analytics.dei', {
      isDemo: Boolean(user?.isDemo),
      internalPreviewAccess: Boolean(user?.internalPreviewAccess),
      previewModules: user?.previewModules,
    })) {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await authenticatedFetch('/api/dei/blind-mode');
        const dataRes = await res.json();
        if (!cancelled && dataRes?.success) setBlindMode(!!dataRes.data?.enabled);
      } catch { /* optional */ }
    })();
    return () => { cancelled = true; };
  }, [orgPlan, user?.isDemo, user?.internalPreviewAccess, setBlindMode]);

  useEffect(() => {
    if (!form.showModal) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [form.showModal]);

  const pageIds = visibleCandidates.map((c) => String(c._id));
  const selectedKeys = selectedIds.map(String);
  const isPageSelected = allMatching || (pageIds.length > 0 && pageIds.every((id) => selectedKeys.includes(id)));
  const isPagePartial = !isPageSelected && pageIds.some((id) => selectedKeys.includes(id));
  const isAllFilteredSelected =
    allMatching
    || (filteredCount > 0
    && selectedIds.length > 0
    && selectedIds.length >= filteredCount);
  const displayedCount = isAllFilteredSelected && filteredCount > selectedIds.length ? filteredCount : selectedIds.length;
  const selectionScopeLabel = isAllFilteredSelected
    ? 'all matching results'
    : (isPageSelected && selectedIds.length === pageIds.length ? 'this page' : '');

  const handleSelectAllFiltered = async () => {
    if (selectingAll) return;
    setSelectingAll(true);
    setAllMatching(true);
    if (pageIds.length) {
      setSelectedIds((prev) => [...new Set([...(prev || []).map(String), ...pageIds.map(String)])]);
    }
    toast.success(`Selected all ${Number(filteredCount || pageIds.length).toLocaleString()} matching candidates.`);
    try {
      const { ids, totalCount } = await fetchMatchingIds(listQueryOptions);
      if (!ids.length) {
        setAllMatching(false);
        toast.warning('No matching candidates to select.');
        return;
      }
      setSelectedIds(ids);
      setAllMatching(true);
      const matchTotal = totalCount || filteredCount;
      if (ids.length < matchTotal) {
        toast.info(`Confirmed ${ids.length.toLocaleString()} of ${matchTotal.toLocaleString()} matches.`);
      }
    } catch (err) {
      setAllMatching(false);
      toast.error(err?.message || 'Could not select all matching candidates.');
    } finally {
      setSelectingAll(false);
    }
  };

  const allColumns = useMemo(
    () => buildCandidateTableColumns({
      handleEdit, handleShareClick, handleDelete, handleResumePreview, handleResumeDownload,
      handleSendEmail, sendWhatsApp, blindMode, currentPage,
      orgCandidateFields, candidates, isFreelancer, jobIdFilter,
      whatsAppApiEnabled: canUseFeature(orgPlan, 'integrations.whatsapp'),
    }),
    [blindMode, currentPage, orgCandidateFields, candidates, handleEdit, handleShareClick, isFreelancer, jobIdFilter, orgPlan] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const availableColumnKeys = useMemo(() => allColumns.map((c) => c.key), [allColumns]);

  const [visibleColumnIds, setVisibleColumnIds] = useState(() => {
    const resolved = resolveVisibleColumnIds(availableColumnKeys, loadCandidateColumnPrefs());
    return resolved.visible;
  });

  // Keep prefs in sync when column catalog changes (new custom fields, etc.)
  useEffect(() => {
    setVisibleColumnIds((prev) => {
      const resolved = resolveVisibleColumnIds(availableColumnKeys, {
        visible: prev,
        known: loadCandidateColumnPrefs()?.known || prev,
      });
      return resolved.visible;
    });
  }, [availableColumnKeys.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    saveCandidateColumnPrefs(visibleColumnIds, availableColumnKeys);
  }, [visibleColumnIds, availableColumnKeys]);

  const columnOptions = useMemo(
    () =>
      allColumns.map((c) => ({
        id: c.key,
        label: c.label,
        locked: CANDIDATE_LOCKED_COLUMN_KEYS.includes(c.key),
      })),
    [allColumns]
  );

  const orderedColumns = useMemo(() => {
    const visible = new Set(visibleColumnIds);
    return allColumns.filter((c) => visible.has(c.key));
  }, [allColumns, visibleColumnIds]);

  const selectAllColumns = useCallback(() => {
    setVisibleColumnIds([...availableColumnKeys]);
  }, [availableColumnKeys]);

  const clearAllColumns = useCallback(() => {
    setVisibleColumnIds(
      CANDIDATE_LOCKED_COLUMN_KEYS.filter((k) => availableColumnKeys.includes(k))
    );
  }, [availableColumnKeys]);

  const resetColumns = useCallback(() => {
    setVisibleColumnIds([...availableColumnKeys]);
  }, [availableColumnKeys]);

  const expOptions = useMemo(
    () => [
      { value: '', label: 'Any' },
      ...[...Array(31).keys()].map((num) => ({
        value: String(num),
        label: `${num} ${num === 1 ? 'year' : 'years'}`,
      })),
    ],
    []
  );
  const ctcFilterOptions = useMemo(
    () => [{ value: '', label: 'Any' }, ...ctcRanges.map((range) => ({ value: range, label: range }))],
    []
  );
  const positionFilterOptions = useMemo(
    () => [
      { value: '', label: 'All Positions', icon: Briefcase },
      ...masterPositions.map((pos) => ({ value: pos.name, label: pos.name, icon: Briefcase })),
    ],
    [masterPositions]
  );
  const productFilterOptions = useMemo(() => {
    const seen = new Set();
    const opts = [{ value: '', label: 'All products' }];
    (masterProducts || []).forEach((item) => {
      const name = String(item?.name || '').trim();
      if (!name) return;
      const key = name.toUpperCase();
      if (seen.has(key)) return;
      seen.add(key);
      opts.push({ value: name, label: name });
    });
    return opts;
  }, [masterProducts]);
  const clientFilterOptions = useMemo(() => {
    const seen = new Set();
    const opts = [{ value: '', label: 'All clients' }];
    (masterClients || []).forEach((item) => {
      const name = String(item?.name || item?.clientName || '').trim();
      if (!name) return;
      const key = name.toUpperCase();
      if (seen.has(key)) return;
      seen.add(key);
      opts.push({ value: name, label: name });
    });
    return opts;
  }, [masterClients]);

  return (
    <div className="page-shell-ats font-sans text-stone-900" role="main" aria-label="Candidates">
      <CandidatesPageHeader
        filteredCandidates={filteredCandidates}
        filteredCount={filteredCount}
        showImportMenu={showImportMenu}
        setShowImportMenu={setShowImportMenu}
        orgPlan={orgPlan}
        navigate={navigate}
        toast={toast}
        fileInputRef={fileInputRef}
        candidatesViewMode={candidatesViewMode}
        handleImportAllToMineClick={handleImportAllToMineClick}
        isImportingShared={isImportingShared}
        isImportingAll={isImportingAll}
        handleImportSharedToMineClick={handleImportSharedToMineClick}
        selectedIds={selectedIds}
        handleFindDuplicates={handleFindDuplicates}
        dedupeLoading={dedupeLoading}
        setEditId={setEditId}
        setFormData={setFormData}
        setFormErrors={setFormErrors}
        setCountryCode={setCountryCode}
        setCountryIso={setCountryIso}
        setShowModal={setShowModal}
        isLoadingInitial={isLoadingInitial}
        candidates={candidates}
        isFreelancer={isFreelancer}
        initialFormState={initialFormState}
        openAddCandidate={openAddCandidate}
        onRefresh={refreshCandidates}
        refreshing={listRefreshing}
        lastSyncedAt={lastSyncedAt}
        autoRefreshSeconds={LIST_REFRESH_MS / 1000}
        canExportCandidates={canExportCandidates}
        setShowDownloadModal={setShowDownloadModal}
      />

      {!isFreelancer && canSeeOrgCandidates && employeeScope.canSelect ? (
        <div className="mb-4 rounded-xl border border-stone-200/80 bg-gradient-to-r from-stone-50/90 via-white to-white p-3 sm:p-3.5 shadow-sm shadow-stone-900/5">
          <EmployeeScopeSelect
            value={employeeScope.employeeParam}
            employees={employeeScope.employees}
            onChange={(next) => {
              setFreelanceOnly(false);
              employeeScope.setEmployee(next);
            }}
            loading={employeeScope.loadingEmployees}
          />
          <p className="mt-2 text-[11px] text-stone-500 leading-relaxed max-w-2xl">
            Company desk counts that employee’s own candidates only. Freelancer shares stay separate — use the person icon in the toolbar to view them.
          </p>
          {freelanceOnly ? (
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-indigo-800 bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-1">
              Viewing freelancer shares only — company desk is hidden
            </p>
          ) : null}
        </div>
      ) : null}

      <input type="file" accept=".csv, .xlsx, .xls" ref={fileInputRef} onChange={handleBulkUpload} className="hidden" aria-hidden />
      <input type="file" accept=".csv, .xlsx, .xls" ref={autoUploadInputRef} onChange={handleAutoUpload} className="hidden" aria-hidden />

      <CandidatesBulkToolbar
        selectedIds={selectedIds}
        displayedCount={displayedCount}
        setSelectedIds={(next) => { setAllMatching(false); setSelectedIds(next); }}
        bulkStatusOpen={bulkStatusOpen}
        setBulkStatusOpen={setBulkStatusOpen}
        startBulkEmailFlow={startBulkEmailFlow}
        handleBulkWhatsApp={handleBulkWhatsApp}
        handleBulkStatusUpdate={handleBulkStatusUpdate}
        openBulkEdit={openBulkEdit}
        handleShareClick={handleShareClick}
        handleBulkDelete={handleBulkDelete}
        isFreelancer={isFreelancer}
        filteredCount={filteredCount}
        isAllFilteredSelected={isAllFilteredSelected}
        selectingAll={selectingAll}
        selectionScopeLabel={selectionScopeLabel}
        onSelectAllFiltered={handleSelectAllFiltered}
      />

      <div className="card-ats-bordered relative overflow-hidden min-h-[320px]">
        <CandidatesSearchToolbar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchScope={searchScope}
          setSearchScope={setSearchScope}
          setCurrentPage={setCurrentPage}
          showAdvancedSearch={showAdvancedSearch}
          setShowAdvancedSearch={setShowAdvancedSearch}
          activeAdvFilterCount={activeAdvFilterCount}
          freelanceOnly={freelanceOnly}
          setFreelanceOnly={setFreelanceOnly}
          isFreelancer={isFreelancer}
          statusFilter={statusFilter}
          onClearStatusFilter={() => {
            setStatusFilter('');
            const next = new URLSearchParams(searchParams);
            next.delete('status');
            setSearchParams(next, { replace: true });
          }}
          columnOptions={columnOptions}
          visibleColumnIds={visibleColumnIds}
          onVisibleColumnsChange={setVisibleColumnIds}
          onSelectAllColumns={selectAllColumns}
          onClearAllColumns={clearAllColumns}
          onResetColumns={resetColumns}
          sortField={sortField}
          sortOrder={sortOrder}
          onSortChange={applySortChange}
          isSearching={isLoadingInitial}
          jobs={jobs}
          jobIdFilter={jobIdFilter}
          onJobIdChange={(id) => {
            const nextId = String(id || '').trim();
            setJobIdFilter(nextId);
            setJobAppSource('');
            setCurrentPage(1);
            const next = new URLSearchParams(searchParams);
            if (!nextId || nextId === 'all') {
              next.delete('jobId');
              next.delete('appSource');
            } else next.set('jobId', nextId);
            if (nextId && nextId !== 'all') next.delete('appSource');
            setSearchParams(next, { replace: true });
          }}
        />

        {isFreelancer && Array.isArray(idFilter) && idFilter.length > 0 ? (
          <div className="mx-4 sm:mx-5 mt-3 mb-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-teal-100 bg-teal-50/70 px-3.5 py-2.5">
            <p className="text-xs text-teal-900 min-w-0">
              <span className="font-semibold">Submitted candidates</span>
              {mandateLabel ? (
                <>
                  {' '}for <span className="font-semibold tabular-nums">{mandateLabel}</span>
                </>
              ) : null}
              <span className="text-teal-700/80"> · {idFilter.length} selected</span>
            </p>
            <button
              type="button"
              className="text-xs font-semibold text-teal-800 hover:text-teal-950 flex-shrink-0 self-start sm:self-auto"
              onClick={() => {
                setIdFilter([]);
                const next = new URLSearchParams(searchParams);
                next.delete('ids');
                next.delete('mandate');
                setSearchParams(next, { replace: true });
              }}
            >
              Show all candidates
            </button>
          </div>
        ) : null}

        {!isFreelancer && jobIdFilter ? (
          <div className="mx-4 sm:mx-5 mt-3 mb-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2">
            <p className="text-xs text-stone-700 min-w-0">
              <span className="font-medium text-stone-500">Talent pool</span>
              <span className="mx-1.5 text-stone-300">/</span>
              <span className="font-semibold text-stone-900">
                {jobAppSource === 'careers' || jobAppSource === 'applied'
                  ? 'Careers applicants'
                  : jobAppSource === 'added' || jobAppSource === 'tagged'
                    ? 'Team-tagged'
                    : jobAppSource === 'duplicates' || jobAppSource === 'duplicate'
                      ? 'Unmerged duplicates'
                      : 'This requisition'}
              </span>
              {(() => {
                const looksLikeMongoId = /^[a-f0-9]{24}$/i.test(String(jobIdFilter));
                const job = (jobs || []).find((j) => String(j._id) === String(jobIdFilter) || String(j.jobCode || '').toUpperCase() === String(jobIdFilter).toUpperCase());
                const code = job?.jobCode || (!looksLikeMongoId ? jobIdFilter : '');
                const title = job?.title || job?.role || '';
                return (
                  <>
                    <span className="mx-1.5 text-stone-300">·</span>
                    <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-stone-900">
                      <Hash size={11} className="text-stone-400 flex-shrink-0" strokeWidth={2.25} />
                      {code || 'Loading Job ID…'}
                    </span>
                    {title ? <span className="text-stone-600"> · {title}</span> : null}
                  </>
                );
              })()}
              <span className="text-stone-500"> · {filteredCount} shown</span>
            </p>
            <button
              type="button"
              className="text-xs font-semibold text-stone-700 hover:text-stone-950 flex-shrink-0 self-start sm:self-auto"
              onClick={() => {
                setJobIdFilter('');
                setJobAppSource('');
                const next = new URLSearchParams(searchParams);
                next.delete('jobId');
                next.delete('appSource');
                setSearchParams(next, { replace: true });
              }}
            >
              View all candidates
            </button>
          </div>
        ) : null}

        {(appliedList === 'moved' || appliedList === 'cohort' || (appliedPeriod && appliedPeriod !== 'all')) ? (
          <div className="mx-4 sm:mx-5 mt-3 mb-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-brand-100 bg-brand-50/60 px-3.5 py-2.5">
            <p className="text-xs text-brand-900 min-w-0">
              {appliedList === 'moved' ? (
                <>
                  <span className="font-semibold">Moved to {String(statusFilter || 'this stage').replace(/[_-]+/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}</span>
                  {' in this period. This table is only those people.'}
                </>
              ) : appliedList === 'cohort' ? (
                <>
                  <span className="font-semibold">Added in {appliedCohort}</span>
                  {statusFilter ? `, and in ${String(statusFilter).replace(/[_-]+/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())} today` : ''}.
                  {' This table is only those people.'}
                </>
              ) : (
                <>
                  <span className="font-semibold">Added in this period.</span>
                  {' This table is only people added then, in any stage.'}
                </>
              )}
            </p>
            <button
              type="button"
              className="text-xs font-semibold text-brand-700 hover:text-brand-900 flex-shrink-0 self-start sm:self-auto"
              onClick={() => {
                clearAdvancedFilters();
                setStatusFilter('');
                const next = new URLSearchParams(searchParams);
                next.delete('period');
                next.delete('from');
                next.delete('to');
                next.delete('list');
                next.delete('cohort');
                next.delete('status');
                setSearchParams(next, { replace: true });
              }}
            >
              Show everyone
            </button>
          </div>
        ) : null}

        <CandidatesAdvancedFilters
          showAdvancedSearch={showAdvancedSearch}
          activeAdvFilterCount={activeAdvFilterCount}
          filtersDirty={filtersDirty}
          isSearching={isLoadingInitial}
          onApplyError={(msg) => toast.warning(msg)}
          applyAdvancedFilters={() => {
            const result = applyAdvancedFilters();
            if (!result?.ok) return result;
            const next = new URLSearchParams(searchParams);
            const p = String(activityPeriod || '').trim();
            if (!p || p === 'all') {
              next.delete('period');
              next.delete('from');
              next.delete('to');
            } else {
              next.set('period', p);
              if (p === 'custom') {
                if (activityFrom) next.set('from', activityFrom);
                else next.delete('from');
                if (activityTo) next.set('to', activityTo);
                else next.delete('to');
              } else {
                next.delete('from');
                next.delete('to');
              }
            }
            setSearchParams(next, { replace: true });
            return result;
          }}
          clearAdvancedFilters={() => {
            clearAdvancedFilters();
            const next = new URLSearchParams(searchParams);
            next.delete('period');
            next.delete('from');
            next.delete('to');
            next.delete('list');
            next.delete('cohort');
            next.delete('status');
            setSearchParams(next, { replace: true });
          }}
          advancedSearchFilters={advancedSearchFilters}
          setAdvancedSearchFilters={setAdvancedSearchFilters}
          positionFilterOptions={positionFilterOptions}
          productFilterOptions={productFilterOptions}
          clientFilterOptions={clientFilterOptions}
          expOptions={expOptions}
          ctcFilterOptions={ctcFilterOptions}
          activityPeriod={activityPeriod}
          setActivityPeriod={setActivityPeriod}
          activityFrom={activityFrom}
          setActivityFrom={setActivityFrom}
          activityTo={activityTo}
          setActivityTo={setActivityTo}
        />

        <CandidatesTable
          tableScrollRef={tableScrollRef}
          onTableDragScrollStart={onTableDragScrollStart}
          onTableDragScrollMove={onTableDragScrollMove}
          onTableDragScrollEnd={onTableDragScrollEnd}
          togglePageSelection={(ids) => { setAllMatching(false); togglePageSelection(ids); }}
          isPageSelected={isPageSelected}
          isPagePartial={isPagePartial}
          allMatching={allMatching}
          orderedColumns={orderedColumns}
          visibleCandidates={visibleCandidates}
          selectedIds={selectedIds}
          toggleSelection={(id) => { setAllMatching(false); toggleSelection(id); }}
          isLoadingInitial={isLoadingInitial}
          viewMode={viewMode}
          searchQuery={searchQuery}
          advancedSearchFilters={advancedSearchFilters}
          setEditId={setEditId}
          setFormData={setFormData}
          setFormErrors={setFormErrors}
          setCountryCode={setCountryCode}
          setCountryIso={setCountryIso}
          setShowModal={setShowModal}
          isFreelancer={isFreelancer}
          initialFormState={initialFormState}
          openAddCandidate={openAddCandidate}
        />

        <CandidatesPagination
          visibleCandidates={visibleCandidates}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          filteredCandidates={filteredCandidates}
          totalFilteredPages={totalFilteredPages}
          totalCount={filteredCount}
        />
      </div>

      <ATSModals
        showColumnMapper={showColumnMapper}
        excelHeaders={excelHeaders}
        handleUploadWithMapping={handleUploadWithMapping}
        setShowColumnMapper={setShowColumnMapper}
        setPendingFile={setPendingFile}
        isUploading={isUploading}
        showVerifiedEmailRequiredModal={showVerifiedEmailRequiredModal}
        verifiedEmailRequiredMessage={verifiedEmailRequiredMessage}
        setShowVerifiedEmailRequiredModal={setShowVerifiedEmailRequiredModal}
        setVerifiedEmailRequiredMessage={setVerifiedEmailRequiredMessage}
        form={form}
        email={email}
        filters={filters}
        importer={importer}
        share={share}
        resume={resume}
        bulk={bulk}
        toast={toast}
        fetchData={fetchData}
        tourOpen={tourOpen}
        setTourOpen={setTourOpen}
        candidates={candidates}
        jobs={jobs}
        orgPlan={orgPlan}
        showDownloadModal={showDownloadModal}
        setShowDownloadModal={setShowDownloadModal}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        fetchMatchingIds={fetchMatchingIds}
      />
    </div>
  );
});

ATS.displayName = 'ATS';
export default ATS;
