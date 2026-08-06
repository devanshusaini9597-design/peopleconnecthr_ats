import React from 'react';
import {
  Calendar as CalendarIcon, X, Plus, Search, Loader2,
  AlertCircle, RefreshCw, Filter, Info,
} from 'lucide-react';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import InterviewsModals from './interviews/InterviewsModals';
import InterviewsResults from './interviews/InterviewsResults';
import useInterviews from './interviews/useInterviews';
import {
  INTERVIEWS_TOUR_KEY,
  INTERVIEWS_TOUR_STEPS,
} from './interviews/constants';

export default function InterviewsPage() {
  const {
    tourOpen,
    setTourOpen,
    tableScrollRef,
    activeTab,
    setActiveTab,
    loading,
    loadError,
    interviews,
    query,
    setQuery,
    showSchedule,
    setShowSchedule,
    scheduling,
    appQuery,
    setAppQuery,
    appResults,
    searchingApps,
    selectedApp,
    setSelectedApp,
    scheduleForm,
    setScheduleForm,
    showScorecard,
    setShowScorecard,
    scorecardTarget,
    recommendation,
    setRecommendation,
    ratings,
    setRatings,
    skillNotes,
    setSkillNotes,
    finalNotes,
    setFinalNotes,
    submittingScorecard,
    templatesLoading,
    selectedTemplateId,
    activeCriteria,
    cancelTarget,
    setCancelTarget,
    cancelling,
    transcriptTarget,
    setTranscriptTarget,
    load,
    filtered,
    calendarGroups,
    openSchedule,
    onTableDragScrollStart,
    onTableDragScrollMove,
    onTableDragScrollEnd,
    handleSchedule,
    handleCancel,
    handleComplete,
    applyTemplateSelection,
    openScorecard,
    templateOptions,
    previewOverall,
    handleScorecard,
    tabs,
  } = useInterviews();

  if (loading) {
    return (
      <div className="page-shell-ats">
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-9 h-9 text-brand-600 animate-spin" />
          <p className="text-sm font-medium text-stone-500">Loading interviews…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell-ats animate-page-enter">
      <PageHeader
        icon={CalendarIcon}
        title="Interviews"
        subtitle="Schedule interviews, join meetings, and submit scorecards."
        gradientTitle
      >
        <button type="button" onClick={openSchedule} className="btn-primary flex-1 sm:flex-none" data-tour="iv-schedule">
          <Plus className="w-4 h-4" /> Schedule interview
        </button>
      </PageHeader>

      <div
        data-tour="iv-tip"
        className="rounded-xl border border-stone-200 bg-white px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-[13px] text-stone-600 leading-relaxed flex flex-wrap items-center gap-x-3 gap-y-1.5"
      >
        <span className="inline-flex items-center gap-1.5 text-brand-700 font-semibold">
          <Info size={14} /> Tip
        </span>
        <span>
          Schedule from here or Pipeline. Use icon actions to join, complete, cancel, or open a scorecard.
          Press <span className="font-semibold text-stone-800">?</span> for a tour.
        </span>
      </div>

      {loadError ? (
        <div className="card-ats-bordered border-red-200/80 bg-red-50/30">
          <EmptyState
            icon={AlertCircle}
            tone="amber"
            message="Couldn’t load interviews"
            subMessage={loadError}
            action={(
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button type="button" onClick={load} className="btn-secondary">
                  <RefreshCw className="w-4 h-4" /> Retry
                </button>
                <button type="button" onClick={openSchedule} className="btn-primary">
                  <Plus className="w-4 h-4" /> Schedule interview
                </button>
              </div>
            )}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <section
            data-tour="iv-filters"
            className="rounded-xl border border-stone-200/90 bg-white shadow-sm relative"
          >
            <div className="absolute inset-x-0 top-0 h-1 rounded-t-xl bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 pointer-events-none" />
            <div className="p-3 sm:p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Filter size={15} className="text-brand-600 flex-shrink-0" />
                <p className="text-sm font-bold text-stone-900 tracking-tight">Find interviews</p>
              </div>
              <div className="flex overflow-x-auto scrollbar-hide gap-1 -mx-1 px-1">
                {tabs.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id)}
                    className={`flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-xl transition-all whitespace-nowrap
                      ${activeTab === id
                        ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200/70'
                        : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50'}`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
              {activeTab !== 'calendar' && (
                <div className="relative max-w-md">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search candidate or role…"
                    className="input-ats input-ats-icon w-full !pr-9"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100"
                      aria-label="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>

          <div data-tour="iv-results" className="card-ats-bordered">
            <div className="p-4 sm:p-6">
              <InterviewsResults
                activeTab={activeTab}
                interviews={interviews}
                filtered={filtered}
                calendarGroups={calendarGroups}
                openSchedule={openSchedule}
                openScorecard={openScorecard}
                setCancelTarget={setCancelTarget}
                handleComplete={handleComplete}
                setTranscriptTarget={setTranscriptTarget}
                tableScrollRef={tableScrollRef}
                onTableDragScrollStart={onTableDragScrollStart}
                onTableDragScrollMove={onTableDragScrollMove}
                onTableDragScrollEnd={onTableDragScrollEnd}
              />
            </div>
          </div>
        </div>
      )}

      <InterviewsModals
        showSchedule={showSchedule}
        setShowSchedule={setShowSchedule}
        scheduling={scheduling}
        handleSchedule={handleSchedule}
        appQuery={appQuery}
        setAppQuery={setAppQuery}
        appResults={appResults}
        searchingApps={searchingApps}
        selectedApp={selectedApp}
        setSelectedApp={setSelectedApp}
        scheduleForm={scheduleForm}
        setScheduleForm={setScheduleForm}
        showScorecard={showScorecard}
        setShowScorecard={setShowScorecard}
        scorecardTarget={scorecardTarget}
        recommendation={recommendation}
        setRecommendation={setRecommendation}
        ratings={ratings}
        setRatings={setRatings}
        skillNotes={skillNotes}
        setSkillNotes={setSkillNotes}
        finalNotes={finalNotes}
        setFinalNotes={setFinalNotes}
        submittingScorecard={submittingScorecard}
        handleScorecard={handleScorecard}
        templatesLoading={templatesLoading}
        selectedTemplateId={selectedTemplateId}
        applyTemplateSelection={applyTemplateSelection}
        activeCriteria={activeCriteria}
        templateOptions={templateOptions}
        previewOverall={previewOverall}
        cancelTarget={cancelTarget}
        setCancelTarget={setCancelTarget}
        cancelling={cancelling}
        handleCancel={handleCancel}
        transcriptTarget={transcriptTarget}
        setTranscriptTarget={setTranscriptTarget}
      />

      <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title="Take a tour of Interviews" />
      <ProductTour
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        steps={INTERVIEWS_TOUR_STEPS}
        storageKey={INTERVIEWS_TOUR_KEY}
      />
    </div>
  );
}
