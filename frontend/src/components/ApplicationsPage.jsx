import React from 'react';
import { Plus, Target, User, Search, Briefcase, GitPullRequest, Kanban } from 'lucide-react';
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

export default function ApplicationsPage() {
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
  } = useApplications();

  const PageIcon = isApplicationsRoute ? GitPullRequest : Kanban;

  return (
    <div className="content-fill-ats animate-page-enter bg-stone-50/40 overflow-hidden max-md:h-auto max-md:min-h-0 max-md:overflow-visible">
      <div className="flex-shrink-0 px-4 sm:px-6 lg:px-8 pt-5 sm:pt-6 pb-1 space-y-3 max-w-7xl mx-auto w-full">
        <PageHeader
          icon={PageIcon}
          title={pageTitle}
          subtitle={selectedJob ? jobTitle(selectedJob) : pageSubtitle}
          gradientTitle
        >
          <button type="button" onClick={openAddModal} className="btn-primary flex-1 sm:flex-none">
            <Plus className="w-4 h-4" /> Add Application
          </button>
        </PageHeader>

        <div data-tour="apps-tip" className="rounded-xl border border-brand-200/60 bg-gradient-to-r from-brand-50/70 via-white to-teal-50/40 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-[13px] text-stone-600 leading-relaxed">
          {selectedJobId
            ? (isApplicationsRoute
              ? `${stats.total || applications.length} in pipeline · avg time ${stats.avgTime || 'N/A'}. Use list actions for email / call, or switch to board to drag stages.`
              : `${stats.total || applications.length} in pipeline · avg time ${stats.avgTime || 'N/A'}. Drag cards across columns to change stage — drop zones highlight as you hover.`)
            : (isApplicationsRoute
              ? 'Select a job to browse applications. Add an application anytime.'
              : 'Select a job to open the kanban board. Drag candidates across stages once loaded.')}
          {' '}Press <span className="font-semibold text-stone-800">?</span> for a tour.
        </div>

        <ApplicationsFilters
          selectedJobId={selectedJobId}
          setSelectedJobId={setSelectedJobId}
          jobOptions={jobOptions}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          stageFilter={stageFilter}
          setStageFilter={setStageFilter}
          viewMode={viewMode}
          setViewMode={setViewMode}
          clearFilters={clearFilters}
        />
      </div>

      {/* Main — on small screens grow with page scroll so board/list is never clipped away */}
      <div
        data-tour="apps-workspace"
        className="flex-1 overflow-hidden relative flex min-h-0 mt-3 max-md:flex-none max-md:min-h-[min(72vh,640px)] max-md:overflow-visible pb-6 md:pb-0"
      >
        {!selectedJobId ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
            <div className="relative mb-6">
              <div className="absolute inset-0 rounded-full bg-brand-200/40 blur-2xl scale-150" />
              <div className="relative w-20 h-20 rounded-full border-2 border-dashed border-brand-200 bg-gradient-to-br from-brand-50 to-white flex items-center justify-center">
                <Target className="w-9 h-9 text-brand-400" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-stone-800 tracking-tight mb-2">Select a Job</h2>
            <p className="text-sm text-stone-500 max-w-sm leading-relaxed mb-5">
              {isApplicationsRoute
                ? 'Choose a job to browse its applications in list view, or add an application to get started.'
                : 'Choose a job from the dropdown to view its hiring pipeline, or add an application to get started.'}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" onClick={openAddModal} className="btn-primary" disabled={jobs.length === 0}>
                <Plus size={16} /> Add Application
              </button>
            </div>
            {jobs.length === 0 && (
              <EmptyState
                icon={Briefcase}
                tone="violet"
                compact
                message="No open jobs yet"
                subMessage="Post a role from Job Openings first."
                className="mt-2"
              />
            )}
          </div>
        ) : loading ? (
          <div className="flex-1 p-4 sm:p-6 flex gap-4 sm:gap-5 overflow-x-auto">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="w-[280px] sm:w-[300px] flex-shrink-0 space-y-3">
                <div className="h-11 skeleton-ats rounded-xl" />
                <div className="h-28 skeleton-ats rounded-xl" />
                <div className="h-28 skeleton-ats rounded-xl" />
              </div>
            ))}
          </div>
        ) : applications.length === 0 && !searchQuery && stageFilter === 'all' ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="card-ats-bordered w-full max-w-md">
              <EmptyState
                icon={User}
                tone="brand"
                message="No applications yet"
                subMessage="Add a candidate to this role or share your careers page."
                action={
                  <button type="button" onClick={openAddModal} className="btn-primary">
                    <Plus size={16} /> Add Application
                  </button>
                }
              />
            </div>
          </div>
        ) : filteredApplications.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="card-ats-bordered w-full max-w-md">
              <EmptyState
                icon={Search}
                tone="amber"
                message="No candidates match"
                subMessage="Clear search or stage filter."
                action={
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={clearFilters}
                  >
                    Clear filters
                  </button>
                }
              />
            </div>
          </div>
        ) : viewMode === 'kanban' ? (
          <ApplicationsKanban
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
            selectedJob={selectedJob}
          />
        ) : (
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
        )}

        {/* Detail panel */}
        {isPanelOpen && selectedApp && (
          <ApplicationDetailPanel
            selectedApp={selectedApp}
            selectedJob={selectedJob}
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
        jobOptions={jobOptions}
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
