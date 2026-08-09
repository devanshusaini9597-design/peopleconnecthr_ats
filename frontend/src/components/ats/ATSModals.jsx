import React from 'react';
import { createPortal } from 'react-dom';
import ConfirmationModal from '../ConfirmationModal';
import ColumnMapper from '../ColumnMapper';
import ProductTour from '../ui/ProductTour';
import TourHelpFab from '../ui/TourHelpFab';
import CandidateFormModal from './CandidateFormModal';
import CandidateEmailModal from './CandidateEmailModal';
import ImportReviewModal from './ImportReviewModal';
import ExportExcelModal from './ExportExcelModal';
import ResumePreviewModal from './ResumePreviewModal';
import ShareCandidateModals from './ShareCandidateModals';
import DedupeModal from './DedupeModal';
import VerifiedEmailModal from './VerifiedEmailModal';
import ImportSharedModals from './ImportSharedModals';
import UploadingOverlay from './UploadingOverlay';
import DuplicatesModal from './legacy/DuplicatesModal';
import CorrectionsModal from './legacy/CorrectionsModal';
import { CAND_TOUR_KEY, CAND_TOUR_STEPS } from './atsConstants';

/**
 * All Candidates-page overlays/modals — keeps ATSPage focused on layout + data wiring.
 */
export default function ATSModals(props) {
  const {
    showColumnMapper, excelHeaders, handleUploadWithMapping, setShowColumnMapper, setPendingFile,
    isUploading,
    showVerifiedEmailRequiredModal, verifiedEmailRequiredMessage,
    setShowVerifiedEmailRequiredModal, setVerifiedEmailRequiredMessage,
    remarkPopover, remarkPopoverTimeoutRef, setRemarkPopover,
    form, email, filters, importer, share, resume, bulk, toast, fetchData, tourOpen, setTourOpen,
    candidates, orgPlan,
  } = props;

  return (
    <>
      {showColumnMapper && (
        <ColumnMapper
          excelHeaders={excelHeaders}
          onMapComplete={handleUploadWithMapping}
          onClose={() => {
            setShowColumnMapper(false);
            setPendingFile(null);
          }}
        />
      )}

      <UploadingOverlay isUploading={isUploading} />

      <VerifiedEmailModal
        open={showVerifiedEmailRequiredModal}
        message={verifiedEmailRequiredMessage}
        onClose={() => {
          setShowVerifiedEmailRequiredModal(false);
          setVerifiedEmailRequiredMessage('');
        }}
      />

      {remarkPopover && createPortal(
        <div
          className="fixed z-[9999] w-64 max-w-[90vw] p-3 bg-white text-stone-800 text-xs rounded-lg shadow-xl border border-stone-200 whitespace-normal"
          style={{
            left: Math.max(8, Math.min(remarkPopover.left - 128, typeof window !== 'undefined' ? window.innerWidth - 264 : 0)),
            ...(remarkPopover.showAbove
              ? { top: Math.max(8, remarkPopover.top - 8), transform: 'translateY(-100%)' }
              : { top: remarkPopover.top + 24 }),
          }}
          onMouseEnter={() => { if (remarkPopoverTimeoutRef.current) clearTimeout(remarkPopoverTimeoutRef.current); }}
          onMouseLeave={() => setRemarkPopover(null)}
        >
          <div className="font-semibold text-stone-500 mb-1">Remark</div>
          <div className="leading-relaxed">{remarkPopover.remark}</div>
        </div>,
        document.body
      )}

      <CandidateFormModal
        showModal={form.showModal}
        formData={form.formData}
        formSection={form.formSection}
        editId={form.editId}
        orgPlan={orgPlan}
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
        setFormData={form.setFormData}
        setQuickList={form.setQuickList}
        formFlsOptions={form.formFlsOptions}
        formExperienceOptions={form.formExperienceOptions}
        formCtcOptions={form.formCtcOptions}
        formExpectedCtcOptions={form.formExpectedCtcOptions}
        formNoticeOptions={form.formNoticeOptions}
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
      />

      <CandidateEmailModal
        showEmailModal={email.showEmailModal}
        emailRecipient={email.emailRecipient}
        setShowEmailModal={email.setShowEmailModal}
        bulkEmailRecipients={email.bulkEmailRecipients}
        setBulkEmailRecipients={email.setBulkEmailRecipients}
        setSelectedIds={props.setSelectedIds}
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
        teamMembers={form.teamMembers}
        ccInput={email.ccInput}
        setCcInput={email.setCcInput}
        bccInput={email.bccInput}
        setBccInput={email.setBccInput}
        showCCPicker={email.showCCPicker}
        setShowCCPicker={email.setShowCCPicker}
        showBCCPicker={email.showBCCPicker}
        setShowBCCPicker={email.setShowBCCPicker}
        emailTemplates={email.emailTemplates}
        selectedTemplate={email.selectedTemplate}
        selectEmailTemplate={email.selectEmailTemplate}
        setSelectedTemplate={email.setSelectedTemplate}
        templateVars={email.templateVars}
        setTemplateVars={email.setTemplateVars}
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
        toast={toast}
      />

      <DuplicatesModal
        showDuplicatesModal={importer.showDuplicatesModal}
        duplicateRecords={importer.duplicateRecords}
        setShowDuplicatesModal={importer.setShowDuplicatesModal}
        setShowOnlyCorrect={filters.setShowOnlyCorrect}
        toast={toast}
      />
      <CorrectionsModal
        showCorrectionsModal={importer.showCorrectionsModal}
        correctionRecords={importer.correctionRecords}
        setShowCorrectionsModal={importer.setShowCorrectionsModal}
        toast={toast}
      />

      <ImportReviewModal
        showReviewModal={importer.showReviewModal}
        reviewData={importer.reviewData}
        setShowReviewModal={importer.setShowReviewModal}
        setReviewData={importer.setReviewData}
        setEditingRow={importer.setEditingRow}
        reviewFilter={importer.reviewFilter}
        setReviewFilter={importer.setReviewFilter}
        getFilteredReviewData={importer.getFilteredReviewData}
        editingRow={importer.editingRow}
        handleRevalidateRecord={importer.handleRevalidateRecord}
        handleSaveEditedRecord={importer.handleSaveEditedRecord}
        handleImportReviewed={importer.handleImportReviewed}
        importConfirmation={importer.importConfirmation}
        setImportConfirmation={importer.setImportConfirmation}
      />

      <ExportExcelModal
        showDownloadModal={props.showDownloadModal}
        setShowDownloadModal={props.setShowDownloadModal}
        filteredCandidates={filters.filteredCandidates}
        selectedIds={props.selectedIds}
        toast={toast}
      />

      <ResumePreviewModal
        previewResumeUrl={resume.previewResumeUrl}
        previewBlobUrl={resume.previewBlobUrl}
        previewResumeCandidate={resume.previewResumeCandidate}
        previewResumeError={resume.previewResumeError}
        isPreviewLoading={resume.isPreviewLoading}
        closeResumePreview={resume.closeResumePreview}
        handleResumeDownload={resume.handleResumeDownload}
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

      <ImportSharedModals
        showImportSharedConfirm={share.showImportSharedConfirm}
        setShowImportSharedConfirm={share.setShowImportSharedConfirm}
        getIdsToImportShared={share.getIdsToImportShared}
        handleImportSharedToMine={share.handleImportSharedToMine}
        isImportingShared={share.isImportingShared}
        showImportAllConfirm={share.showImportAllConfirm}
        setShowImportAllConfirm={share.setShowImportAllConfirm}
        handleImportAllToMine={share.handleImportAllToMine}
        isImportingAll={share.isImportingAll}
        importAllSuccess={share.importAllSuccess}
        setImportAllSuccess={share.setImportAllSuccess}
        fetchData={fetchData}
        importSharedSuccess={share.importSharedSuccess}
        setImportSharedSuccess={share.setImportSharedSuccess}
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
        candidates={candidates}
      />

      <DedupeModal
        open={bulk.showDedupeModal}
        dedupeResults={bulk.dedupeResults}
        onClose={() => bulk.setShowDedupeModal(false)}
      />

      <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title="Take a tour of Candidates" />
      <ProductTour
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        steps={CAND_TOUR_STEPS}
        storageKey={CAND_TOUR_KEY}
      />
    </>
  );
}
