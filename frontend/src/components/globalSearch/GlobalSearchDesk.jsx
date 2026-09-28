import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import BASE_API_URL from '../../config';
import { useParsing } from '../../hooks/useParsing';
import { useTableDragScroll } from '../ats/hooks/useTableDragScroll';
import { useBulkCandidateActions } from '../ats/hooks/useBulkCandidateActions';
import { useCandidateEmail } from '../ats/hooks/useCandidateEmail';
import { useCandidateShare } from '../ats/hooks/useCandidateShare';
import { useCandidateForm } from '../ats/hooks/useCandidateForm';
import { useResumePreview } from '../ats/hooks/useResumePreview';
import { buildCandidateTableColumns } from '../ats/candidateTableColumns';
import {
  CANDIDATE_LOCKED_COLUMN_KEYS,
  loadCandidateColumnPrefs,
  saveCandidateColumnPrefs,
  resolveVisibleColumnIds,
} from '../ats/candidateColumnPrefs';
import CandidatesBulkToolbar from '../ats/CandidatesBulkToolbar';
import CandidatesTable from '../ats/CandidatesTable';
import CandidatesPagination from '../ats/CandidatesPagination';
import CandidateFormModal from '../ats/CandidateFormModal';
import CandidateEmailModal from '../ats/CandidateEmailModal';
import EmailCampaignResultModal from '../ats/EmailCampaignResultModal';
import ConfirmationModal from '../ConfirmationModal';
import BulkEditModal from '../ats/BulkEditModal';
import ResumePreviewModal from '../ats/ResumePreviewModal';
import ShareCandidateModals from '../ats/ShareCandidateModals';
import DedupeModal from '../ats/DedupeModal';
import VerifiedEmailModal from '../ats/VerifiedEmailModal';
import { PAGE_SIZE } from '../ats/atsConstants';
import { selectAllMatching, resolveMatchingPeople } from './selectAllMatching';
import EmptyState from '../ui/EmptyState';

export default function GlobalSearchDesk({
  candidates = [],
  jobs = [],
  page,
  setPage,
  totalCount = 0,
  countPending = false,
  countPlus = false,
  hasMore = false,
  loading,
  searchQuery,
  appliedFilters,
  onReload,
  onColumnMeta,
  navigate,
  toast,
  fetchMatching,
  audienceQuery = null,
  dateSort = 'latest',
  onDateSort,
}) {
  const { user } = useAuth();
  const isFreelancer = user?.role === 'freelancer';
  const deskCandidates = useMemo(
    () => (candidates || []).map((c) => ({ ...c, _id: String(c._id) })),
    [candidates],
  );
  const { selectedIds, setSelectedIds, toggleSelection, togglePageSelection } = useParsing(onReload);
  const [matchPool, setMatchPool] = useState([]);
  const [allMatching, setAllMatching] = useState(false);
  const matchPoolRef = useRef([]);
  const audienceRef = useRef({ allMatching: false, count: 0, query: null, entity: 'candidates' });
  const emailPool = matchPool.length ? matchPool : deskCandidates;

  const rememberPool = useCallback((rows) => {
    const next = Array.isArray(rows) ? rows : [];
    matchPoolRef.current = next;
    // Keep React state small — only store up to ~200 rows for UI helpers.
    setMatchPool(next.length > 200 ? next.slice(0, 200) : next);
  }, []);

  const resolveSelected = useCallback(() => resolveMatchingPeople({
    fetchMatching,
    entity: 'candidates',
    matchPool: matchPoolRef.current.length ? matchPoolRef.current : matchPool,
    selectedIds,
    allMatching,
    pageRows: deskCandidates,
    expectedCount: totalCount,
    onHydrated: (loaded) => {
      if (loaded?.rows?.length) {
        matchPoolRef.current = loaded.rows;
        // Do not setSelectedIds to thousands of ids — allMatching covers the UI.
      }
    },
  }), [fetchMatching, matchPool, selectedIds, allMatching, deskCandidates, totalCount]);
  const { tableScrollRef, onTableDragScrollStart, onTableDragScrollMove, onTableDragScrollEnd } = useTableDragScroll();

  useEffect(() => {
    if (!selectedIds.length) {
      setMatchPool([]);
      matchPoolRef.current = [];
      setAllMatching(false);
    }
  }, [selectedIds.length]);

  const fetchData = useCallback(async () => {
    await onReload?.();
  }, [onReload]);

  const candidatesApi = `${BASE_API_URL}/candidates`;
  const form = useCandidateForm({
    toast,
    fetchData,
    searchQuery,
    filterJob: '',
    currentPage: page,
    setCurrentPage: setPage,
    API_URL: candidatesApi,
    jobs,
  });
  const {
    setShowModal, setEditId, setFormData, setFormErrors,
    orgCandidateFields, setCountryCode, setCountryIso, handleEdit, initialFormState, openAddCandidate,
  } = form;

  const bulk = useBulkCandidateActions({
    toast,
    candidates: emailPool,
    selectedIds,
    setSelectedIds,
    API_URL: candidatesApi,
    searchQuery,
    filterJob: '',
    currentPage: page,
    setCurrentPage: setPage,
    fetchData,
    isFreelancer,
    resolveSelectedPeople: resolveSelected,
  });
  const {
    sendWhatsApp, handleBulkWhatsApp, handleBulkDelete, handleBulkStatusUpdate,
    openBulkEdit, handleDelete, bulkStatusOpen, setBulkStatusOpen,
  } = bulk;

  const email = useCandidateEmail({
    toast,
    candidates: emailPool,
    selectedIds,
    setSelectedIds,
    setConfirmModal: bulk.setConfirmModal,
    navigate,
    getBulkAudience: () => {
      const snap = audienceRef.current;
      if (!snap.allMatching || !snap.query) return null;
      return {
        active: true,
        count: snap.count,
        query: { ...snap.query, entity: 'candidates' },
      };
    },
    resolveSelectedPeople: resolveSelected,
  });
  const share = useCandidateShare({
    toast, candidates: emailPool, selectedIds, setSelectedIds, fetchData, searchQuery, filterJob: '',
  });
  const resume = useResumePreview({ toast, viewMode: 'all' });

  const allColumns = useMemo(
    () => buildCandidateTableColumns({
      handleEdit,
      handleShareClick: share.handleShareClick,
      handleDelete,
      handleResumePreview: resume.handleResumePreview,
      handleResumeDownload: resume.handleResumeDownload,
      handleSendEmail: email.handleSendEmail,
      sendWhatsApp,
      blindMode: false,
      currentPage: page,
      orgCandidateFields,
      candidates: deskCandidates,
      isFreelancer,
      jobIdFilter: '',
      dateSort,
      onDateSort,
    }),
    [handleEdit, share.handleShareClick, handleDelete, resume.handleResumePreview, resume.handleResumeDownload, email.handleSendEmail, sendWhatsApp, page, orgCandidateFields, deskCandidates, isFreelancer, dateSort, onDateSort]
  );

  const availableColumnKeys = useMemo(() => allColumns.map((c) => c.key), [allColumns]);
  const [visibleColumnIds, setVisibleColumnIds] = useState(() => {
    const resolved = resolveVisibleColumnIds(availableColumnKeys, loadCandidateColumnPrefs());
    return resolved.visible;
  });

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
    () => allColumns.map((c) => ({
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

  useEffect(() => {
    onColumnMeta?.({
      columnOptions,
      visibleColumnIds,
      setVisibleColumnIds,
      availableColumnKeys,
    });
  }, [columnOptions, visibleColumnIds, availableColumnKeys, onColumnMeta]);

  const pageIds = deskCandidates.map((c) => String(c._id));
  const isPageSelected = allMatching || (pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id)));
  const isPagePartial = !isPageSelected && pageIds.some((id) => selectedIds.includes(id));
  const isAllFilteredSelected =
    allMatching || (totalCount > 0 && selectedIds.length > 0 && selectedIds.length >= totalCount);
  const displayedCount = isAllFilteredSelected && totalCount > selectedIds.length ? totalCount : selectedIds.length;
  audienceRef.current = {
    allMatching,
    count: displayedCount,
    query: audienceQuery,
    entity: 'candidates',
  };
  const totalPages = (countPending || countPlus)
    ? Math.max(1, page + (hasMore ? 1 : 0))
    : Math.max(1, Math.ceil((totalCount || 0) / PAGE_SIZE));

  const handleSelectAllFiltered = () => {
    selectAllMatching({
      pageIds,
      pageRows: deskCandidates,
      setSelectedIds,
      setMatchPool: rememberPool,
      setAllMatching,
      toast,
      expectedCount: totalCount,
      emptyWarning: 'No matching candidates to select.',
      successPrefix: 'Selected',
    });
  };

  if (!loading && deskCandidates.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Search}
          tone="amber"
          message="No matching candidates"
          subMessage="Adjust keywords or filters, or open the MIS tab."
        />
      </div>
    );
  }

  return (
    <>
      <div className="px-4 sm:px-5 pt-3">
        <CandidatesBulkToolbar
          selectedIds={selectedIds}
          displayedCount={displayedCount}
          setSelectedIds={(next) => { setAllMatching(false); setSelectedIds(next); }}
          bulkStatusOpen={bulkStatusOpen}
          setBulkStatusOpen={setBulkStatusOpen}
          startBulkEmailFlow={email.startBulkEmailFlow}
          handleBulkWhatsApp={handleBulkWhatsApp}
          handleBulkStatusUpdate={handleBulkStatusUpdate}
          openBulkEdit={openBulkEdit}
          handleShareClick={share.handleShareClick}
          handleBulkDelete={handleBulkDelete}
          isFreelancer={isFreelancer}
          filteredCount={totalCount}
          isAllFilteredSelected={isAllFilteredSelected}
          selectingAll={false}
          onSelectAllFiltered={handleSelectAllFiltered}
          selectionScopeLabel={isAllFilteredSelected ? 'all matching results' : (isPageSelected ? 'this page' : '')}
        />
      </div>
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
        visibleCandidates={deskCandidates}
        selectedIds={selectedIds}
        toggleSelection={(id) => { setAllMatching(false); toggleSelection(String(id)); }}
        isLoadingInitial={Boolean(loading) && !allMatching}
        viewMode="all"
        searchQuery={searchQuery}
        advancedSearchFilters={appliedFilters}
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
        visibleCandidates={deskCandidates}
        currentPage={page}
        setCurrentPage={setPage}
        filteredCandidates={deskCandidates}
        totalFilteredPages={totalPages}
        totalCount={totalCount}
        countPending={countPending}
        countPlus={countPlus}
      />

      <CandidateFormModal
        showModal={form.showModal}
        formData={form.formData}
        formSection={form.formSection}
        stepDirection={form.stepDirection}
        editId={form.editId}
        orgPlan={user?.organization?.plan}
        jobs={jobs}
        jdForScore={form.jdForScore}
        setJdForScore={form.setJdForScore}
        handleAiScore={form.handleAiScore}
        aiScoreLoading={form.aiScoreLoading}
        aiScoreResult={form.aiScoreResult}
        setShowModal={form.setShowModal}
        goCandidateStep={form.goCandidateStep}
        stepBanner={form.stepBanner}
        formErrors={form.formErrors}
        fieldRefs={form.fieldRefs}
        setFormField={form.setFormField}
        countryIso={form.countryIso}
        setCountryIso={form.setCountryIso}
        setCountryCode={form.setCountryCode}
        formCountryOptions={form.formCountryOptions}
        resolveCountryFromDial={form.resolveCountryFromDial}
        countryCode={form.countryCode}
        handleInputChange={form.handleInputChange}
        formPositionOptions={form.formPositionOptions}
        masterPositions={form.masterPositions}
        masterCtcBands={form.masterCtcBands}
        masterNoticePeriods={form.masterNoticePeriods}
        masterProducts={form.masterProducts}
        setFormData={form.setFormData}
        setQuickList={form.setQuickList}
        formFlsOptions={form.formFlsOptions}
        formExperienceOptions={form.formExperienceOptions}
        formCtcOptions={form.formCtcOptions}
        formExpectedCtcOptions={form.formExpectedCtcOptions}
        formNoticeOptions={form.formNoticeOptions}
        formProductOptions={form.formProductOptions}
        formStatusOptions={form.formStatusOptions}
        formClientOptions={form.formClientOptions}
        masterClients={form.masterClients}
        formSourceOptions={form.formSourceOptions}
        masterSources={form.masterSources}
        orgCandidateFields={form.orgCandidateFields}
        handleAddCandidate={form.handleAddCandidate}
        quickList={form.quickList}
        fetchMasterData={form.fetchMasterData}
        isAutoParsing={form.isAutoParsing}
        countryCodes={form.countryCodes}
        recentStepChangeRef={form.recentStepChangeRef}
        showPanRequiredModal={form.showPanRequiredModal}
        setShowPanRequiredModal={form.setShowPanRequiredModal}
        onClientChange={form.onClientChange}
        masterDataLoading={form.masterDataLoading}
      />
      <CandidateEmailModal
        showEmailModal={email.showEmailModal}
        emailRecipient={email.emailRecipient}
        setShowEmailModal={email.setShowEmailModal}
        bulkEmailRecipients={email.bulkEmailRecipients}
        setBulkEmailRecipients={email.setBulkEmailRecipients}
        bulkAudience={email.bulkAudience}
        setBulkAudience={email.setBulkAudience}
        setSelectedIds={setSelectedIds}
        emailChannel={email.emailChannel}
        setEmailChannel={email.setEmailChannel}
        channelsAvailable={email.channelsAvailable}
        emailSenderInfo={email.emailSenderInfo}
        emailMode={email.emailMode}
        setEmailMode={email.setEmailMode}
        emailCC={email.emailCC}
        setEmailCC={email.setEmailCC}
        emailBCC={email.emailBCC}
        setEmailBCC={email.setEmailBCC}
        teamMembers={form.teamMembers || []}
        ccInput={email.ccInput}
        setCcInput={email.setCcInput}
        bccInput={email.bccInput}
        setBccInput={email.setBccInput}
        showCCPicker={email.showCCPicker}
        setShowCCPicker={email.setShowCCPicker}
        showBCCPicker={email.showBCCPicker}
        setShowBCCPicker={email.setShowBCCPicker}
        emailTemplates={email.emailTemplates}
        emailTemplatesLoading={email.emailTemplatesLoading}
        selectedTemplate={email.selectedTemplate}
        selectEmailTemplate={email.selectEmailTemplate}
        setSelectedTemplate={email.setSelectedTemplate}
        templateVars={email.templateVars}
        setTemplateVars={email.setTemplateVars}
        templateDraftSubject={email.templateDraftSubject}
        setTemplateDraftSubject={email.setTemplateDraftSubject}
        templateDraftBody={email.templateDraftBody}
        setTemplateDraftBody={email.setTemplateDraftBody}
        templateDraftDirty={email.templateDraftDirty}
        setTemplateDraftDirty={email.setTemplateDraftDirty}
        emailType={email.emailType}
        setEmailType={email.setEmailType}
        quickName={email.quickName}
        setQuickName={email.setQuickName}
        quickPosition={email.quickPosition}
        setQuickPosition={email.setQuickPosition}
        quickDepartment={email.quickDepartment}
        setQuickDepartment={email.setQuickDepartment}
        quickJoiningDate={email.quickJoiningDate}
        setQuickJoiningDate={email.setQuickJoiningDate}
        customMessage={email.customMessage}
        setCustomMessage={email.setCustomMessage}
        quickSubject={email.quickSubject}
        setQuickSubject={email.setQuickSubject}
        showQuickPreview={email.showQuickPreview}
        setShowQuickPreview={email.setShowQuickPreview}
        quickPreviewHtml={email.quickPreviewHtml}
        setQuickPreviewHtml={email.setQuickPreviewHtml}
        quickPreviewSubject={email.quickPreviewSubject}
        setQuickPreviewSubject={email.setQuickPreviewSubject}
        loadingPreview={email.loadingPreview}
        setLoadingPreview={email.setLoadingPreview}
        isSendingEmail={email.isSendingEmail}
        sendTemplateEmail={email.sendTemplateEmail}
        sendSingleEmail={email.sendSingleEmail}
        jobs={jobs}
        campaignJobId={email.campaignJobId}
        setCampaignJobId={email.setCampaignJobId}
        campaignJobMeta={email.campaignJobMeta}
        setCampaignJobMeta={email.setCampaignJobMeta}
        toast={toast}
      />
      <EmailCampaignResultModal
        open={Boolean(email.showEmailCampaignResult)}
        result={email.emailCampaignResult}
        onClose={() => {
          email.setShowEmailCampaignResult?.(false);
          email.setEmailCampaignResult?.(null);
        }}
        onViewReports={() => {
          email.setShowEmailCampaignResult?.(false);
          email.setEmailCampaignResult?.(null);
          navigate('/email-reports');
        }}
      />
      <VerifiedEmailModal
        open={email.showVerifiedEmailRequiredModal}
        message={email.verifiedEmailRequiredMessage}
        onClose={() => {
          email.setShowVerifiedEmailRequiredModal(false);
          email.setVerifiedEmailRequiredMessage('');
        }}
      />
      <ConfirmationModal
        isOpen={bulk.confirmModal.isOpen}
        onClose={() => bulk.setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={bulk.confirmModal.onConfirm}
        title={bulk.confirmModal.title}
        message={bulk.confirmModal.message}
        details={bulk.confirmModal.details}
        confirmText={bulk.confirmModal.confirmText}
        type={bulk.confirmModal.type}
        isLoading={bulk.confirmModal.isLoading}
      />
      <BulkEditModal
        open={bulk.bulkEditOpen}
        onClose={() => !bulk.bulkEditLoading && bulk.setBulkEditOpen(false)}
        selectedCount={selectedIds.length}
        onSubmit={bulk.handleBulkEditSubmit}
        isLoading={bulk.bulkEditLoading}
      />
      <ResumePreviewModal
        previewResumeUrl={resume.previewResumeUrl}
        previewBlobUrl={resume.previewBlobUrl}
        previewBlob={resume.previewBlob}
        previewFileKind={resume.previewFileKind}
        previewResumeCandidate={resume.previewResumeCandidate}
        previewResumeError={resume.previewResumeError}
        isPreviewLoading={resume.isPreviewLoading}
        closeResumePreview={resume.closeResumePreview}
        handleResumeDownload={resume.handleResumeDownload}
      />
      <ShareCandidateModals
        showShareModal={share.showShareModal}
        showShareConfirmation={share.showShareConfirmation}
        setShowShareModal={share.setShowShareModal}
        setShowShareConfirmation={share.setShowShareConfirmation}
        selectedCandidatesForShare={share.selectedCandidatesForShare}
        teamMembers={form.teamMembers}
        selectedShareMembers={share.selectedShareMembers}
        setSelectedShareMembers={share.setSelectedShareMembers}
        handleShareCandidate={share.handleShareCandidate}
        isSharingCandidate={share.isSharingCandidate}
        shareCandidate={share.shareCandidate}
        candidates={deskCandidates}
      />
      <DedupeModal
        open={bulk.showDedupeModal}
        dedupeResults={bulk.dedupeResults}
        onClose={() => !bulk.dedupeMerging && bulk.setShowDedupeModal(false)}
        onMerge={bulk.handleMergeDuplicates}
        merging={bulk.dedupeMerging}
      />
    </>
  );
}
