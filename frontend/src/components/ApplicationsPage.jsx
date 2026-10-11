import React from 'react';
import { Navigate } from 'react-router-dom';
import { Plus, User, Search, Kanban } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import PipelineStageSummary from './ui/PipelineStageSummary';
import { jobTitle } from './applications/constants';
import useApplications from './applications/useApplications';
import ApplicationsFilters from './applications/ApplicationsFilters';
import ApplicationsTable from './applications/ApplicationsTable';
import ApplicationsKanban from './applications/ApplicationsKanban';
import ApplicationDetailPanel from './applications/ApplicationDetailPanel';
import ApplicationsModals from './applications/ApplicationsModals';
import { useAuth } from '../context/AuthContext';

export default function ApplicationsPage() {
  const { user } = useAuth();
  if (user?.role === 'freelancer') {
    return <Navigate to="/my-pipeline" replace />;
  }

  return <ApplicationsPageInner />;
}

function ApplicationsPageInner() {
  const {
    pageTitle,
    pageSubtitle,
    tourKey,
    tourSteps,
    tourOpen,
    setTourOpen,
    hasBackgroundCheck,
    hasEsign,
    enterpriseActionLoading,
    jobs,
    selectedJobId,
    setSelectedJobId,
    applications,
    stats,
    loading,
    searchQuery,
    setSearchQuery,
    stageFilter,
    setStageFilter,
    viewMode,
    setViewMode,
    selectedApp,
    isPanelOpen,
    noteDraft,
    setNoteDraft,
    savingNote,
    isAddModalOpen,
    setIsAddModalOpen,
    addForm,
    setAddForm,
    adding,
    isRejectModalOpen,
    setIsRejectModalOpen,
    rejectReason,
    setRejectReason,
    rejecting,
    isScheduleOpen,
    setIsScheduleOpen,
    scheduleForm,
    setScheduleForm,
    scheduling,
    deleteTarget,
    setDeleteTarget,
    deleting,
    draggedAppId,
    dragOverStage,
    tableScrollRef,
    dragScrollRef,
    openPanel,
    closePanel,
    handleStageChange,
    handleRatingChange,
    handleSaveNote,
    handleReject,
    handleSchedule,
    handleAddApplication,
    handleDeleteApp,
    orderBackgroundCheck,
    sendForEsign,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
    filteredApplications,
    getAppsByStage,
    onTableDragScrollStart,
    onTableDragScrollMove,
    onTableDragScrollEnd,
    openAddModal,
    clearFilters,
    selectedJob,
    jobOptions,
    addJobOptions,
    boardStages,
    stageFilterOptions,
  } = useApplications();

  return (
    <div className="page-shell-ats animate-page-enter">
      <PageHeader
        icon={Kanban}
        title={pageTitle}
        subtitle={
          selectedJob
            ? [
                selectedJob.jobCode,
                jobTitle(selectedJob),
                `${Number(stats.total || selectedJob.applicationCount || 0)} applicants`,
              ].filter(Boolean).join(' · ')
            : (stats.total ? `${stats.total} in the company pipeline` : pageSubtitle)
        }
        gradientTitle
      >
        <button type="button" onClick={openAddModal} className="btn-primary flex-1 sm:flex-none">
          <Plus className="w-4 h-4" /> Add application
        </button>
      </PageHeader>

      {!loading && applications.length > 0 ? (
        <PipelineStageSummary
          stages={boardStages}
          getCount={(stage) => getAppsByStage?.(stage.id)?.length ?? 0}
          stageFilter={stageFilter}
          setStageFilter={setStageFilter}
          total={filteredApplications.length || stats.total || applications.length}
          tourAttr="apps-stage-summary"
          variant="strip"
        />
      ) : null}

      <ApplicationsFilters
        selectedJobId={selectedJobId}
        setSelectedJobId={setSelectedJobId}
        jobOptions={jobOptions}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        stageFilter={stageFilter}
        setStageFilter={setStageFilter}
        stageFilterOptions={stageFilterOptions}
        viewMode={viewMode}
        setViewMode={setViewMode}
        clearFilters={clearFilters}
        resultCount={filteredApplications.length}
        totalCount={stats.total || applications.length}
        loading={loading}
      />

      <div data-tour="apps-workspace" className="relative min-w-0">
        {loading ? (
          <div className="h-[min(70dvh,720px)] min-h-[420px] rounded-2xl border border-stone-200 bg-white skeleton-ats" />
        ) : applications.length === 0 && !searchQuery && stageFilter === 'all' ? (
          <div className="rounded-2xl border border-stone-200/90 bg-white shadow-[var(--shadow-card)] relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
            <EmptyState
              icon={User}
              tone="violet"
              message="No applications yet"
              subMessage={jobs.length === 0
                ? 'Create a job first, then add candidates to this company pipeline.'
                : 'Add a candidate to a role or share your careers page. The board updates when they apply.'}
              action={(
                <button type="button" onClick={openAddModal} className="btn-primary" disabled={jobs.length === 0}>
                  <Plus size={16} /> Add application
                </button>
              )}
            />
          </div>
        ) : filteredApplications.length === 0 ? (
          <div className="rounded-2xl border border-stone-200/90 bg-white shadow-[var(--shadow-card)]">
            <EmptyState
              icon={Search}
              tone="amber"
              message="No matching candidates"
              subMessage="Try a different job, stage, or search term."
              action={(
                <button type="button" className="btn-secondary" onClick={clearFilters}>
                  Reset filters
                </button>
              )}
            />
          </div>
        ) : viewMode === 'kanban' ? (
          <div className="rounded-2xl border border-stone-200/90 bg-white shadow-[var(--shadow-card)] overflow-hidden h-[min(70dvh,720px)] min-h-[420px] relative">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 z-10" />
            <ApplicationsKanban
              stages={boardStages}
              stageFilter={stageFilter}
              getAppsByStage={getAppsByStage}
              dragOverStage={dragOverStage}
              draggedAppId={draggedAppId}
              handleDragOver={handleDragOver}
              handleDrop={handleDrop}
              handleDragStart={handleDragStart}
              handleDragEnd={handleDragEnd}
              openPanel={openPanel}
              handleRatingChange={handleRatingChange}
              handleStageChange={handleStageChange}
              selectedJob={selectedJob}
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-stone-200/90 bg-white shadow-[var(--shadow-card)] overflow-hidden relative">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
            <ApplicationsTable
              filteredApplications={filteredApplications}
              selectedJob={selectedJob}
              openPanel={openPanel}
              clearFilters={clearFilters}
              tableScrollRef={tableScrollRef}
              dragScrollRef={dragScrollRef}
              onTableDragScrollStart={onTableDragScrollStart}
              onTableDragScrollMove={onTableDragScrollMove}
              onTableDragScrollEnd={onTableDragScrollEnd}
            />
          </div>
        )}

        {isPanelOpen && selectedApp && (
          <ApplicationDetailPanel
            selectedApp={selectedApp}
            selectedJob={selectedJob}
            boardStages={boardStages}
            closePanel={closePanel}
            handleStageChange={handleStageChange}
            setScheduleForm={setScheduleForm}
            setIsScheduleOpen={setIsScheduleOpen}
            hasBackgroundCheck={hasBackgroundCheck}
            hasEsign={hasEsign}
            enterpriseActionLoading={enterpriseActionLoading}
            orderBackgroundCheck={orderBackgroundCheck}
            sendForEsign={sendForEsign}
            setIsRejectModalOpen={setIsRejectModalOpen}
            handleRatingChange={handleRatingChange}
            noteDraft={noteDraft}
            setNoteDraft={setNoteDraft}
            setDeleteTarget={setDeleteTarget}
            handleSaveNote={handleSaveNote}
            savingNote={savingNote}
          />
        )}
      </div>

      <ApplicationsModals
        isAddModalOpen={isAddModalOpen}
        setIsAddModalOpen={setIsAddModalOpen}
        adding={adding}
        handleAddApplication={handleAddApplication}
        jobs={jobs}
        addForm={addForm}
        setAddForm={setAddForm}
        jobOptions={addJobOptions}
        isRejectModalOpen={isRejectModalOpen}
        setIsRejectModalOpen={setIsRejectModalOpen}
        rejecting={rejecting}
        handleReject={handleReject}
        rejectReason={rejectReason}
        setRejectReason={setRejectReason}
        selectedApp={selectedApp}
        isScheduleOpen={isScheduleOpen}
        setIsScheduleOpen={setIsScheduleOpen}
        scheduling={scheduling}
        handleSchedule={handleSchedule}
        scheduleForm={scheduleForm}
        setScheduleForm={setScheduleForm}
        deleteTarget={deleteTarget}
        setDeleteTarget={setDeleteTarget}
        deleting={deleting}
        handleDeleteApp={handleDeleteApp}
      />

      <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title="Take a tour of Pipeline" />
      <ProductTour open={tourOpen} onClose={() => setTourOpen(false)} steps={tourSteps} storageKey={tourKey} />
    </div>
  );
}
