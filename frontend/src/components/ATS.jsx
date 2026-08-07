import React, { useState, useEffect, useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Briefcase, Info } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useParsing } from '../hooks/useParsing';
import { authenticatedFetch } from '../utils/fetchUtils';
import { useToast } from './Toast';
import usePageTour from '../hooks/usePageTour';
import { useAuth } from '../context/AuthContext';
import { planHasFeature } from '../config/planFeatures';
import { ctcRanges } from '../utils/ctcRanges';

import {
  CAND_TOUR_KEY,
  INITIAL_FORM_STATE,
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
  const { organization } = useAuth();
  const orgPlan = organization?.plan;
  const { onImportComplete } = props || {};

  const [candidatesViewMode] = useState('all');
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [remarkPopover, setRemarkPopover] = useState(null);
  const remarkPopoverTimeoutRef = useRef(null);
  const viewMode = 'all';

  const data = useCandidatesData({ candidatesViewMode, toast });
  const {
    API_URL, candidates, blindMode, setBlindMode, isLoadingInitial, fetchData,
  } = data;

  const filters = useCandidateFilters(candidates);
  const {
    searchQuery, setSearchQuery, filterJob,
    showAdvancedSearch, setShowAdvancedSearch,
    advancedSearchFilters, setAdvancedSearchFilters,
    sortField, setSortField, sortOrder, setSortOrder,
    currentPage, setCurrentPage, clearAdvancedFilters, activeAdvFilterCount,
    filteredCandidates, visibleCandidates, totalFilteredPages,
  } = filters;

  const importer = useCandidateImport({
    toast, fetchData, searchQuery, filterJob, onImportComplete,
  });
  const {
    fileInputRef, autoUploadInputRef, isUploading,
    showColumnMapper, setShowColumnMapper, excelHeaders, setPendingFile,
    handleBulkUpload, handleAutoUpload, handleUploadWithMapping,
  } = importer;

  const { selectedIds, setSelectedIds, toggleSelection, selectAll } = useParsing(async () => {
    await fetchData(1, { search: searchQuery, position: filterJob });
  });

  const bulk = useBulkCandidateActions({
    toast, candidates, selectedIds, setSelectedIds, API_URL,
    searchQuery, filterJob, currentPage, setCurrentPage, fetchData,
  });
  const {
    sendWhatsApp, handleBulkWhatsApp, handleBulkDelete, handleBulkStatusUpdate,
    handleDelete, handleFindDuplicates, dedupeLoading,
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
    setCountryCode, setCountryIso, handleEdit, initialFormState,
  } = form;

  const resume = useResumePreview({ toast });
  const { handleResumePreview, handleResumeDownload } = resume;
  const { tableScrollRef, onTableDragScrollStart, onTableDragScrollMove, onTableDragScrollEnd } = useTableDragScroll();

  useImperativeHandle(ref, () => ({
    triggerAutoImport: () => autoUploadInputRef.current?.click(),
    openAddCandidateModal: () => {
      setEditId(null);
      setFormData(initialFormState);
      setFormErrors({});
      setCountryCode('+91');
      setCountryIso('IN');
      setShowModal(true);
    },
    refreshCandidates: () => fetchData(1, { search: '', position: '' }),
    autoUploadInputRef,
    fileInputRef,
  }));

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setSearchQuery(q);
  }, [searchParams, setSearchQuery]);

  useEffect(() => {
    if (searchParams.get('add') !== '1') return;
    setEditId(null);
    setFormData(INITIAL_FORM_STATE);
    setFormErrors({});
    setCountryCode('+91');
    setCountryIso('IN');
    setShowModal(true);
    const next = new URLSearchParams(searchParams);
    next.delete('add');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, setEditId, setFormData, setFormErrors, setCountryCode, setCountryIso, setShowModal]);

  useEffect(() => {
    fetchData(1, { search: searchQuery || '', position: filterJob || '' });
  }, [candidatesViewMode]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const isAllSelected = filteredCandidates.length > 0 && selectedIds.length === filteredCandidates.length;

  const orderedColumns = useMemo(
    () => buildCandidateTableColumns({
      handleEdit, handleShareClick, handleDelete, handleResumePreview, handleResumeDownload,
      handleSendEmail, sendWhatsApp, blindMode, currentPage, remarkPopoverTimeoutRef,
      setRemarkPopover, orgCandidateFields, candidates,
    }),
    [blindMode, currentPage, orgCandidateFields, candidates, handleEdit, handleShareClick] // eslint-disable-line react-hooks/exhaustive-deps
  );

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
    <div className="page-shell-ats font-sans text-stone-900 animate-page-enter" role="main" aria-label="Candidates">
      <CandidatesPageHeader
        filteredCandidates={filteredCandidates}
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
      />

      <div data-tour="cand-tip" className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="inline-flex items-center gap-1.5 text-brand-700 font-semibold">
          <Info size={14} aria-hidden /> Tip
        </span>
        <span>
          Select rows for bulk email, WhatsApp, status, share, or delete.
          Use <span className="font-semibold text-stone-800">Import → Excel with review</span> to upload a spreadsheet safely.
          Press <span className="font-semibold text-stone-800">?</span> for a tour.
        </span>
      </div>

      {isLoadingInitial && candidates.length === 0 && (
        <div className="h-1 w-full bg-stone-100 rounded-full overflow-hidden" role="progressbar" aria-label="Loading candidates">
          <div className="h-full w-1/3 bg-gradient-to-r from-brand-500 to-teal-400 rounded-full animate-shimmer" />
        </div>
      )}

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
        handleShareClick={handleShareClick}
        handleBulkDelete={handleBulkDelete}
      />

      <div className="card-ats-bordered relative overflow-hidden min-h-[320px]">
        <CandidatesSearchToolbar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          setCurrentPage={setCurrentPage}
          showAdvancedSearch={showAdvancedSearch}
          setShowAdvancedSearch={setShowAdvancedSearch}
          activeAdvFilterCount={activeAdvFilterCount}
          orgPlan={orgPlan}
          toast={toast}
          navigate={navigate}
          filteredCandidates={filteredCandidates}
          setShowDownloadModal={setShowDownloadModal}
          selectedIds={selectedIds}
        />

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
          selectAll={selectAll}
          filteredCandidates={filteredCandidates}
          isAllSelected={isAllSelected}
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
        />

        <CandidatesPagination
          visibleCandidates={visibleCandidates}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          filteredCandidates={filteredCandidates}
          totalFilteredPages={totalFilteredPages}
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
        remarkPopover={remarkPopover}
        remarkPopoverTimeoutRef={remarkPopoverTimeoutRef}
        setRemarkPopover={setRemarkPopover}
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
      />
    </div>
  );
});

ATS.displayName = 'ATS';
export default ATS;
