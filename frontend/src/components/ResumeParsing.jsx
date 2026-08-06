import React from 'react';
import { Upload, FileText } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import { PARSE_TOUR_KEY, PARSE_TOUR_STEPS } from './resumeParsing/resumeParsingConstants';
import { useResumeParseQueue } from './resumeParsing/useResumeParseQueue';
import { ParseUploadZone } from './resumeParsing/ParseUploadZone';
import { ParseResultsTable } from './resumeParsing/ParseResultsTable';
import { ParseReviewModals } from './resumeParsing/ParseReviewModals';

const ResumeParsing = () => {
  const {
    navigate, toast, tourOpen, setTourOpen,
    fileInputRef, tableScrollRef,
    dragOver, setDragOver,
    uploadedFiles, parsing, results, error,
    editingIdx, reviewIdx, setReviewIdx, statusFilter, setStatusFilter,
    selectedIds, setSelectedIds, editBuffer, addingAll,
    confirmAddAllOpen, setConfirmAddAllOpen,
    addSuccessModal, setAddSuccessModal,
    setCurrentPage,
    handleViewResume, handleDownloadResume,
    handleFileSelect, handleDrop,
    handleCancelEdit, handleSaveEdit, handleEditChange,
    addToCandidate, setRowStatus, setManyStatus, removeRows,
    approvedDataList, pendingCount, approvedCount, rejectedCount, failedCount,
    visibleResults, totalPages, safePage, pageStart, pagedResults,
    openConfirmAddAll, addAllAsCandidates, clearSession,
    openReview, openEditInModal, toggleSelect, allVisibleSelected, toggleSelectVisible,
    reviewResult, reviewStatus,
    onTableDragScrollStart, onTableDragScrollMove, onTableDragScrollEnd,
  } = useResumeParseQueue();

  return (
    <div className="page-shell-ats animate-page-enter">
      <PageHeader
        icon={FileText}
        title="Resume Parsing"
        subtitle="Batch import — extract fields, review, then add to Candidates."
        gradientTitle
      >
        {results.length > 0 && (
          <button type="button" onClick={clearSession} className="btn-secondary flex-1 sm:flex-none" disabled={parsing}>
            Clear queue
          </button>
        )}
        <button
          type="button"
          className="btn-primary flex-1 sm:flex-none"
          disabled={parsing}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={16} /> Upload resumes
        </button>
      </PageHeader>

      <ParseUploadZone
        dragOver={dragOver}
        setDragOver={setDragOver}
        parsing={parsing}
        error={error}
        uploadedFiles={uploadedFiles}
        results={results}
        fileInputRef={fileInputRef}
        handleFileSelect={handleFileSelect}
        handleDrop={handleDrop}
      />

      <ParseResultsTable
        toast={toast}
        results={results}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        pendingCount={pendingCount}
        approvedCount={approvedCount}
        rejectedCount={rejectedCount}
        failedCount={failedCount}
        visibleResults={visibleResults}
        totalPages={totalPages}
        safePage={safePage}
        pageStart={pageStart}
        pagedResults={pagedResults}
        addingAll={addingAll}
        setCurrentPage={setCurrentPage}
        tableScrollRef={tableScrollRef}
        setManyStatus={setManyStatus}
        setRowStatus={setRowStatus}
        removeRows={removeRows}
        openConfirmAddAll={openConfirmAddAll}
        openReview={openReview}
        toggleSelect={toggleSelect}
        allVisibleSelected={allVisibleSelected}
        toggleSelectVisible={toggleSelectVisible}
        handleViewResume={handleViewResume}
        handleDownloadResume={handleDownloadResume}
        onTableDragScrollStart={onTableDragScrollStart}
        onTableDragScrollMove={onTableDragScrollMove}
        onTableDragScrollEnd={onTableDragScrollEnd}
      />

      <ParseReviewModals
        navigate={navigate}
        toast={toast}
        reviewIdx={reviewIdx}
        setReviewIdx={setReviewIdx}
        reviewResult={reviewResult}
        reviewStatus={reviewStatus}
        editingIdx={editingIdx}
        editBuffer={editBuffer}
        handleCancelEdit={handleCancelEdit}
        handleSaveEdit={handleSaveEdit}
        handleEditChange={handleEditChange}
        openEditInModal={openEditInModal}
        setRowStatus={setRowStatus}
        removeRows={removeRows}
        addToCandidate={addToCandidate}
        handleViewResume={handleViewResume}
        handleDownloadResume={handleDownloadResume}
        confirmAddAllOpen={confirmAddAllOpen}
        setConfirmAddAllOpen={setConfirmAddAllOpen}
        approvedDataList={approvedDataList}
        addingAll={addingAll}
        addAllAsCandidates={addAllAsCandidates}
        addSuccessModal={addSuccessModal}
        setAddSuccessModal={setAddSuccessModal}
      />

      <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title="Take a tour of Resume Parsing" />
      <ProductTour
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        steps={PARSE_TOUR_STEPS}
        storageKey={PARSE_TOUR_KEY}
      />
    </div>
  );
};

export default ResumeParsing;
