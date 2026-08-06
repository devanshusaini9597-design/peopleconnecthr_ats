// frontend/src/components/AnalyticsDashboard.jsx
import React from 'react';
import {
  AlertCircle, Download, BarChart3, RefreshCw
} from 'lucide-react';
import PageHeader from './ui/PageHeader';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';

import {
  ANALYTICS_TOUR_KEY,
  ANALYTICS_TOUR_STEPS,
} from './analytics/constants';
import AnalyticsLivePanel from './analytics/AnalyticsLivePanel';
import AnalyticsExportPanel from './analytics/AnalyticsExportPanel';
import AnalyticsModals from './analytics/AnalyticsModals';
import useAnalytics from './analytics/useAnalytics';

const AnalyticsDashboard = () => {
  const {
    navigate,
    tourOpen,
    setTourOpen,
    stats,
    loading,
    error,
    setSearchParams,
    isExporting,
    refreshing,
    activeTab,
    exportFormat,
    setExportFormat,
    reportType,
    setReportType,
    dateRange,
    setDateRange,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    exportSuccess,
    previewData,
    previewLoading,
    showPreview,
    setShowPreview,
    filteredCandidateCount,
    showShareModal,
    setShowShareModal,
    teamMembers,
    selectedMembers,
    setSelectedMembers,
    isLoadingMembers,
    isSharingReport,
    shareMessage,
    setShareMessage,
    tableScrollRef,
    previewScrollRef,
    onTableDragScrollStart,
    onTableDragScrollMove,
    onTableDragScrollEnd,
    fetchStats,
    activePipeline,
    totalActive,
    handleExport,
    handlePreview,
    handleShareReport,
    openShareModal,
    retryFetchStats,
  } = useAnalytics();

  if (loading) {
    return (
      <div className="page-shell-ats animate-page-enter">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl skeleton-ats flex-shrink-0" />
          <div className="space-y-2 flex-1 pt-1">
            <div className="h-7 w-52 skeleton-ats rounded-lg" />
            <div className="h-4 w-72 max-w-full skeleton-ats rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-[118px] skeleton-ats rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2">
          <div className="lg:col-span-2 h-64 skeleton-ats rounded-2xl" />
          <div className="h-64 skeleton-ats rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-shell-ats animate-page-enter">
        <div className="card-ats-bordered p-6 flex flex-col sm:flex-row sm:items-center gap-4 border-red-200 bg-red-50/40">
          <div className="w-11 h-11 rounded-xl bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
            <AlertCircle size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-stone-900">Unable to load analytics</p>
            <p className="text-sm text-red-600 mt-0.5">{error}</p>
          </div>
          <button type="button" onClick={retryFetchStats} className="btn-primary">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-shell-ats animate-page-enter">
        <PageHeader
          icon={BarChart3}
          title="Reports & Analytics"
          subtitle="Recruitment performance overview and data exports."
          gradientTitle
        >
          <button type="button" onClick={() => fetchStats(true)} disabled={refreshing} className="btn-secondary">
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </PageHeader>

        <div data-tour="analytics-tip" className="rounded-xl border border-brand-200/60 bg-gradient-to-r from-brand-50/70 via-white to-teal-50/40 px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed">
          Review KPIs and pipeline trends, then export branded PDFs from Export Data. Drag across table cells to scroll columns — use the scrollbar only to scrub.
          Press <span className="font-semibold text-stone-800">?</span> for a tour.
        </div>

        <div data-tour="analytics-tabs" className="flex items-center gap-1 p-1 bg-stone-100/80 rounded-xl w-full sm:w-auto overflow-x-auto">
          {[
            { id: 'analytics', label: 'Analytics', icon: BarChart3 },
            { id: 'export', label: 'Export Data', icon: Download },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSearchParams({ tab: tab.id })}
                className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                  active ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-brand-600' : ''}`} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ═══════════════ ANALYTICS TAB ═══════════════ */}
        {activeTab === 'analytics' && stats && (
          <AnalyticsLivePanel
            stats={stats}
            totalActive={totalActive}
            navigate={navigate}
            activePipeline={activePipeline}
            tableScrollRef={tableScrollRef}
            onTableDragScrollStart={onTableDragScrollStart}
            onTableDragScrollMove={onTableDragScrollMove}
            onTableDragScrollEnd={onTableDragScrollEnd}
          />
        )}

        {activeTab === 'export' && (
          <AnalyticsExportPanel
            exportSuccess={exportSuccess}
            reportType={reportType}
            setReportType={setReportType}
            dateRange={dateRange}
            setDateRange={setDateRange}
            customFrom={customFrom}
            setCustomFrom={setCustomFrom}
            customTo={customTo}
            setCustomTo={setCustomTo}
            exportFormat={exportFormat}
            setExportFormat={setExportFormat}
            filteredCandidateCount={filteredCandidateCount}
            stats={stats}
            handlePreview={handlePreview}
            previewLoading={previewLoading}
            handleExport={handleExport}
            isExporting={isExporting}
            openShareModal={openShareModal}
          />
        )}
      </div>

      <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title="Take a tour of Analytics" />
      <ProductTour
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        steps={ANALYTICS_TOUR_STEPS}
        storageKey={ANALYTICS_TOUR_KEY}
      />

      <AnalyticsModals
        showPreview={showPreview}
        setShowPreview={setShowPreview}
        previewData={previewData}
        exportFormat={exportFormat}
        handleExport={handleExport}
        navigate={navigate}
        previewScrollRef={previewScrollRef}
        onTableDragScrollStart={onTableDragScrollStart}
        onTableDragScrollMove={onTableDragScrollMove}
        onTableDragScrollEnd={onTableDragScrollEnd}
        showShareModal={showShareModal}
        setShowShareModal={setShowShareModal}
        handleShareReport={handleShareReport}
        isSharingReport={isSharingReport}
        selectedMembers={selectedMembers}
        setSelectedMembers={setSelectedMembers}
        isLoadingMembers={isLoadingMembers}
        teamMembers={teamMembers}
        shareMessage={shareMessage}
        setShareMessage={setShareMessage}
      />
    </>
  );
};

export default AnalyticsDashboard;
