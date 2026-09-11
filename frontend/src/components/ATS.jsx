import React, { useState, useEffect, useMemo, forwardRef, useImperativeHandle, useCallback, useRef } from 'react';
import { Briefcase, RefreshCw, Loader2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useParsing } from '../hooks/useParsing';
import { authenticatedFetch } from '../utils/fetchUtils';
import { useToast } from './Toast';
import usePageTour from '../hooks/usePageTour';
import { useAuth } from '../context/AuthContext';
import { planHasFeature } from '../config/planFeatures';
import { ctcRanges } from '../utils/ctcRanges';
import { canViewOrgAnalytics } from '../utils/analyticsScope';
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
  const FREELANCER_REFRESH_MS = 30_000;
  const [freelancerRefreshing, setFreelancerRefreshing] = useState(false);
  const [freelancerLastSynced, setFreelancerLastSynced] = useState(null);
  const listQueryOptionsRef = useRef(null);

  const viewFromUrl = String(searchParams.get('view') || '').toLowerCase();
  const canSeeOrgCandidates = canViewOrgAnalytics(user?.role);
  const employeeScope = useEmployeeAnalyticsScope();
  // Recruiters: default to SPOC desk (mine). Owner/admin/manager: org-wide unless employee selected.
  const candidatesViewMode = isFreelancer
    ? 'mine'
    : employeeScope.userId
      ? 'mine'
      : (viewFromUrl === 'mine' || viewFromUrl === 'shared' || viewFromUrl === 'all'
        ? viewFromUrl
        : (canSeeOrgCandidates ? 'all' : 'mine'));
  const [freelanceOnly, setFreelanceOnly] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const viewMode = candidatesViewMode;

  const data = useCandidatesData({
    candidatesViewMode,
    scopeUserId: employeeScope.userId || '',
    toast,
  });
  const {
    API_URL, candidates, blindMode, setBlindMode, isLoadingInitial, fetchData, fetchMatchingIds,
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
    statusFilter, setStatusFilter,
    idFilter, setIdFilter,
    showAdvancedSearch, setShowAdvancedSearch,
    advancedSearchFilters, setAdvancedSearchFilters,
    activityPeriod, setActivityPeriod,
    activityFrom, setActivityFrom,
    activityTo, setActivityTo,
    sortField, setSortField, sortOrder, setSortOrder,
    currentPage, setCurrentPage, clearAdvancedFilters, activeAdvFilterCount,
    listQueryOptions, filteredCandidates, visibleCandidates, totalFilteredPages, filteredCount,
  } = filters;
  listQueryOptionsRef.current = listQueryOptions;
  const mandateLabel = String(searchParams.get('mandate') || '').trim();

  const refreshFreelancerCandidates = useCallback(async ({ silent = true } = {}) => {
    if (!isFreelancer) return;
    if (silent) setFreelancerRefreshing(true);
    try {
      await fetchData(currentPage, listQueryOptionsRef.current || {});
      setFreelancerLastSynced(new Date());
    } finally {
      setFreelancerRefreshing(false);
    }
  }, [isFreelancer, fetchData, currentPage]);

  useEffect(() => {
    if (!isFreelancer) return undefined;
    let alive = true;
    setFreelancerLastSynced(new Date());
    const tick = () => {
      if (!alive) return;
      refreshFreelancerCandidates({ silent: true }).catch(() => {});
    };
    const id = window.setInterval(tick, FREELANCER_REFRESH_MS);
    const onFocus = () => tick();
    const onVis = () => {
      if (document.visibilityState === 'visible') tick();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      alive = false;
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [isFreelancer, refreshFreelancerCandidates]);

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

  const bulk = useBulkCandidateActions({
    toast, candidates, selectedIds, setSelectedIds, API_URL,
    searchQuery, filterJob, currentPage, setCurrentPage, fetchData,
    isFreelancer,
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
  });
  const {
    setShowModal, setEditId, setFormData, setFormErrors,
    orgCandidateFields, masterPositions,
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
    const period = searchParams.get('period') || '';
    const from = searchParams.get('from') || '';
    const to = searchParams.get('to') || '';
    setActivityPeriod(period);
    setActivityFrom(from);
    setActivityTo(to);
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
    if (q || searchParams.get('ids')) setCurrentPage(1);
  }, [searchParams, isFreelancer, setSearchQuery, setStatusFilter, setIdFilter, setActivityPeriod, setActivityFrom, setActivityTo, setCurrentPage]);

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
    if (!planHasFeature(orgPlan, 'analytics.dei')) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await authenticatedFetch('/api/dei/blind-mode');
        const dataRes = await res.json();
        if (!cancelled && dataRes?.success) setBlindMode(!!dataRes.data?.enabled);
      } catch { /* optional */ }
    })();
    return () => { cancelled = true; };
  }, [orgPlan, setBlindMode]);

  useEffect(() => {
    if (!form.showModal) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [form.showModal]);

  const pageIds = visibleCandidates.map((c) => c._id);
  const isPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
  const isPagePartial = !isPageSelected && pageIds.some((id) => selectedIds.includes(id));
  const isAllFilteredSelected =
    filteredCount > 0
    && selectedIds.length > 0
    && selectedIds.length >= filteredCount;
  const selectionScopeLabel = isAllFilteredSelected
    ? 'all matching results'
    : (isPageSelected && selectedIds.length === pageIds.length ? 'this page' : '');

  const handleSelectAllFiltered = async () => {
    try {
      const { ids, totalCount, capped } = await fetchMatchingIds(listQueryOptions);
      if (!ids.length) {
        toast.warning('No matching candidates to select.');
        return;
      }
      // Replace selection (do not toggle — click again must keep all selected)
      setSelectedIds(ids);
      const matchTotal = totalCount || filteredCount;
      if (capped) {
        toast.warning(
          `Selected ${ids.length.toLocaleString()} of ${matchTotal.toLocaleString()} matches (maximum). Refine filters to target the rest.`,
        );
      } else if (ids.length < matchTotal) {
        toast.info(`Selected ${ids.length.toLocaleString()} of ${matchTotal.toLocaleString()} matches.`);
      } else {
        toast.success(`Selected all ${ids.length.toLocaleString()} matching candidates.`);
      }
    } catch (err) {
      toast.error(err?.message || 'Could not select all matching candidates.');
    }
  };

  const allColumns = useMemo(
    () => buildCandidateTableColumns({
      handleEdit, handleShareClick, handleDelete, handleResumePreview, handleResumeDownload,
      handleSendEmail, sendWhatsApp, blindMode, currentPage,
      orgCandidateFields, candidates, isFreelancer,
    }),
    [blindMode, currentPage, orgCandidateFields, candidates, handleEdit, handleShareClick, isFreelancer] // eslint-disable-line react-hooks/exhaustive-deps
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
        onRefresh={isFreelancer ? () => refreshFreelancerCandidates({ silent: true }) : undefined}
        refreshing={freelancerRefreshing}
        lastSyncedAt={freelancerLastSynced}
        autoRefreshSeconds={isFreelancer ? FREELANCER_REFRESH_MS / 1000 : undefined}
      />

      {!isFreelancer && employeeScope.canSelect ? (
        <div className="mb-4">
          <EmployeeScopeSelect
            value={employeeScope.employeeParam}
            employees={employeeScope.employees}
            onChange={employeeScope.setEmployee}
            loading={employeeScope.loadingEmployees}
          />
        </div>
      ) : null}

      <input type="file" accept=".csv, .xlsx, .xls" ref={fileInputRef} onChange={handleBulkUpload} className="hidden" aria-hidden />
      <input type="file" accept=".csv, .xlsx, .xls" ref={autoUploadInputRef} onChange={handleAutoUpload} className="hidden" aria-hidden />

      <CandidatesBulkToolbar
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
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
          toast={toast}
          filteredCandidates={filteredCandidates}
          filteredCount={filteredCount}
          setShowDownloadModal={setShowDownloadModal}
          selectedIds={selectedIds}
          freelanceOnly={freelanceOnly}
          setFreelanceOnly={setFreelanceOnly}
          isFreelancer={isFreelancer}
          canExportCandidates={canExportCandidates}
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

        {activityPeriod && activityPeriod !== 'all' ? (
          <div className="mx-4 sm:mx-5 mt-3 mb-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-brand-100 bg-brand-50/60 px-3.5 py-2.5">
            <p className="text-xs text-brand-900 min-w-0">
              <span className="font-semibold">Period filter:</span>{' '}
              <span className="tabular-nums">
                {activityPeriod === 'custom' && activityFrom && activityTo
                  ? `${activityFrom} – ${activityTo}`
                  : ({
                    today: 'Today',
                    yesterday: 'Yesterday',
                    week: 'Last 7 Days',
                    month: 'This Month',
                    quarter: 'This Quarter',
                    year: 'This Year',
                  }[activityPeriod] || activityPeriod)}
              </span>
            </p>
            <button
              type="button"
              className="text-xs font-semibold text-brand-700 hover:text-brand-900 flex-shrink-0 self-start sm:self-auto"
              onClick={() => {
                setActivityPeriod('');
                setActivityFrom('');
                setActivityTo('');
                const next = new URLSearchParams(searchParams);
                next.delete('period');
                next.delete('from');
                next.delete('to');
                setSearchParams(next, { replace: true });
              }}
            >
              Clear period
            </button>
          </div>
        ) : null}

        <CandidatesAdvancedFilters
          showAdvancedSearch={showAdvancedSearch}
          activeAdvFilterCount={activeAdvFilterCount}
          clearAdvancedFilters={clearAdvancedFilters}
          advancedSearchFilters={advancedSearchFilters}
          setAdvancedSearchFilters={setAdvancedSearchFilters}
          positionFilterOptions={positionFilterOptions}
          expOptions={expOptions}
          ctcFilterOptions={ctcFilterOptions}
          sortField={sortField}
          setSortField={setSortField}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
          setCurrentPage={setCurrentPage}
        />

        <CandidatesTable
          tableScrollRef={tableScrollRef}
          onTableDragScrollStart={onTableDragScrollStart}
          onTableDragScrollMove={onTableDragScrollMove}
          onTableDragScrollEnd={onTableDragScrollEnd}
          togglePageSelection={togglePageSelection}
          isPageSelected={isPageSelected}
          isPagePartial={isPagePartial}
          orderedColumns={orderedColumns}
          visibleCandidates={visibleCandidates}
          selectedIds={selectedIds}
          toggleSelection={toggleSelection}
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
