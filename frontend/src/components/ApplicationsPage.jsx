import React from 'react';
import { Navigate } from 'react-router-dom';
import { Plus, User, Search, GitPullRequest, Kanban, Info } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
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
    isApplicationsRoute,
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

  const PageIcon = isApplicationsRoute ? GitPullRequest : Kanban;

  return (
    <div className="page-shell-ats animate-page-enter">
      <PageHeader
        icon={PageIcon}
        title={pageTitle}
        subtitle={selectedJob ? jobTitle(selectedJob) : (stats.total ? `${stats.total} in pipeline` : pageSubtitle)}
        gradientTitle
      >
        <button type="button" onClick={openAddModal} className="btn-primary flex-1 sm:flex-none">
          <Plus className="w-4 h-4" /> Add Application
        </button>
      </PageHeader>

      <div
        data-tour="apps-tip"
        className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed flex flex-wrap items-center gap-x-3 gap-y-1.5"
      >
        <span className="inline-flex items-center gap-1.5 text-brand-700 font-semibold">
          <Info size={14} /> Tip
        </span>
        <span>
          {isApplicationsRoute
            ? `${stats.total || applications.length} in pipeline · avg time ${stats.avgTime || 'N/A'}. Switch views or filter by stage anytime.`
            : `${stats.total || applications.length} in pipeline · avg time ${stats.avgTime || 'N/A'}. Drag cards across columns to change stage.`}
          {' '}Press <span className="font-semibold text-stone-800">?</span> for a tour.
        </span>
      </div>

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
          <div className="rounded-xl border border-stone-200/90 bg-white shadow-sm p-4 sm:p-5">
            <div className="flex gap-4 overflow-x-auto pb-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="w-[260px] sm:w-[280px] flex-shrink-0 space-y-3">
                  <div className="h-11 skeleton-ats rounded-xl" />
                  <div className="h-28 skeleton-ats rounded-xl" />
                  <div className="h-28 skeleton-ats rounded-xl" />
                </div>
              ))}
            </div>
          </div>
        ) : applications.length === 0 && !searchQuery && stageFilter === 'all' ? (
          <div className="card-ats-bordered">
            <EmptyState
              icon={User}
              tone="brand"
              message="No applications yet"
              subMessage={jobs.length === 0
                ? 'Create a job opening first, then add candidates to the pipeline.'
                : 'Add a candidate to a role or share your careers page. The board updates live when they apply.'}
              action={(
                <button type="button" onClick={openAddModal} className="btn-primary" disabled={jobs.length === 0}>
                  <Plus size={16} /> Add Application
                </button>
              )}
            />
            {jobs.length === 0 && (
              <p className="text-center text-xs text-stone-400 pb-6 -mt-2">
                No open jobs yet — create one from Job Openings first.
              </p>
            )}
          </div>
        ) : filteredApplications.length === 0 ? (
          <div className="card-ats-bordered">
            <EmptyState
              icon={Search}
              tone="amber"
              message="No candidates match"
              subMessage="Clear search or stage filter."
              action={(
                <button type="button" className="btn-secondary" onClick={clearFilters}>
                  Clear filters
                </button>
              )}
            />
          </div>
        ) : viewMode === 'kanban' ? (
          <div className="rounded-xl border border-stone-200/90 bg-white shadow-sm overflow-hidden h-[min(70dvh,720px)] min-h-[420px]">
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
          <div className="rounded-xl border border-stone-200/90 bg-white shadow-sm overflow-hidden">
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

      <TourHelpFab
        onClick={() => setTourOpen(true)}
        label="Take a tour"
        title={isApplicationsRoute ? 'Take a tour of Applications' : 'Take a tour of Pipeline Board'}
      />
      <ProductTour
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        steps={tourSteps}
        storageKey={tourKey}
      />

      <style dangerouslySetInnerHTML={{
        __html: `
        .scrollbar-thin::-webkit-scrollbar { width: 5px; height: 5px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #d6d3d1; border-radius: 20px; }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: #a8a29e; }
      ` }}
      />
    </div>
  );
}
