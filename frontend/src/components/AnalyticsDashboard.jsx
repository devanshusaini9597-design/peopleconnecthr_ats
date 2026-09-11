// frontend/src/components/AnalyticsDashboard.jsx
import React from 'react';
import {
  AlertCircle, BarChart3, RefreshCw
} from 'lucide-react';
import PageHeader from './ui/PageHeader';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import { useAuth } from '../context/AuthContext';

import {
  ANALYTICS_TOUR_KEY,
  ANALYTICS_TOUR_STEPS,
} from './analytics/constants';
import AnalyticsLivePanel from './analytics/AnalyticsLivePanel';
import AnalyticsExportPanel from './analytics/AnalyticsExportPanel';
import AnalyticsControlPanel from './analytics/AnalyticsControlPanel';
import AnalyticsModals from './analytics/AnalyticsModals';
import { AnalyticsInlineLoader, AnalyticsPanelOverlay, AnalyticsPanelSkeleton } from './analytics/AnalyticsPanelLoader';
import useAnalytics from './analytics/useAnalytics';

const AnalyticsDashboard = () => {
  const { user } = useAuth();
  const isFreelancer = user?.role === 'freelancer';
  const {
    navigate,
    tourOpen,
    setTourOpen,
    stats,
    loading,
    statsLoading,
    error,
    setActiveTab,
    employeeScope,
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
    periodLabel,
    periodReady,
    customRangeInvalid,
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
    handleExport,
    handlePreview,
    handleShareReport,
    openShareModal,
    retryFetchStats,
  } = useAnalytics();

  const scopeLabel = employeeScope.canSelect
    ? (employeeScope.selectedEmployee?.name || (employeeScope.employeeParam === 'all' ? 'All employees' : 'Employee desk'))
    : 'My desk';

  if (loading) {
    return (
      <div className="page-shell-ats animate-page-enter">
        <PageHeader
          icon={BarChart3}
          title="Reports & Analytics"
          subtitle={isFreelancer
            ? 'Hiring metrics for candidates on your desk.'
            : employeeScope.canSelect
              ? 'Hiring performance across your organization or a selected employee.'
              : 'Hiring performance and data exports for your desk.'}
        />
        <div className="rounded-lg border border-stone-200 bg-white h-[120px] skeleton-ats" />
        <AnalyticsInlineLoader label="Loading analytics…" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <div key={i} className="h-[118px] skeleton-ats rounded-2xl" />)}
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
          subtitle={isFreelancer
            ? 'Hiring metrics for candidates on your desk.'
            : employeeScope.canSelect
              ? 'Hiring performance across your organization or a selected employee.'
              : 'Hiring performance and data exports for your desk.'}
        >
          <button type="button" onClick={() => fetchStats(true)} disabled={refreshing} className="btn-secondary">
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </PageHeader>

        <div className="space-y-2">
          <AnalyticsControlPanel
            employeeScope={employeeScope}
            isFreelancer={isFreelancer}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            statsLoading={statsLoading}
            dateRange={dateRange}
            setDateRange={setDateRange}
            customFrom={customFrom}
            setCustomFrom={setCustomFrom}
            customTo={customTo}
            setCustomTo={setCustomTo}
            periodLabel={stats?.periodLabel || periodLabel}
          />
          {statsLoading && (
            <AnalyticsInlineLoader label={`Updating metrics for ${stats?.periodLabel || periodLabel}…`} />
          )}
        </div>

        {dateRange === 'custom' && customRangeInvalid && (
          <div className="rounded-xl border border-red-200 bg-red-50/80 px-4 py-2.5 text-[13px] text-red-800">
            End date must be on or after the start date.
          </div>
        )}

        {dateRange === 'custom' && !periodReady && !customRangeInvalid && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-2.5 text-[13px] text-amber-800">
            Select a start and end date to load analytics for this range.
          </div>
        )}

        {/* ═══════════════ ANALYTICS TAB ═══════════════ */}
        {(isFreelancer || activeTab === 'analytics') && periodReady && (
          <div className="relative min-h-[320px]">
            {statsLoading && !stats && <AnalyticsPanelSkeleton />}
            {statsLoading && stats && <AnalyticsPanelOverlay label={`Updating ${stats.periodLabel || periodLabel}…`} />}
            {!stats && !statsLoading && <AnalyticsPanelSkeleton />}
            {stats && (
              <div className={statsLoading ? 'opacity-40 pointer-events-none select-none' : ''}>
                <AnalyticsLivePanel
                  stats={stats}
                  navigate={navigate}
                  activePipeline={activePipeline}
                  isFreelancer={isFreelancer}
                  userId={employeeScope.userId}
                  periodLabel={stats.periodLabel || periodLabel}
                  dateRange={dateRange}
                  customFrom={customFrom}
                  customTo={customTo}
                  tableScrollRef={tableScrollRef}
                  onTableDragScrollStart={onTableDragScrollStart}
                  onTableDragScrollMove={onTableDragScrollMove}
                  onTableDragScrollEnd={onTableDragScrollEnd}
                />
              </div>
            )}
          </div>
        )}

        {!isFreelancer && activeTab === 'export' && (
          <div className="relative">
            {statsLoading && <AnalyticsInlineLoader label="Updating export summary…" />}
            <AnalyticsExportPanel
            exportSuccess={exportSuccess}
            reportType={reportType}
            setReportType={setReportType}
            dateRange={dateRange}
            customFrom={customFrom}
            customTo={customTo}
            exportFormat={exportFormat}
            setExportFormat={setExportFormat}
            filteredCandidateCount={filteredCandidateCount}
            stats={stats}
            scopeLabel={scopeLabel}
            periodLabel={stats?.periodLabel || periodLabel}
            periodReady={periodReady}
            customRangeInvalid={customRangeInvalid}
            handlePreview={handlePreview}
            previewLoading={previewLoading}
            handleExport={handleExport}
            isExporting={isExporting}
            openShareModal={isFreelancer ? undefined : openShareModal}
          />
          </div>
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
        previewLoading={previewLoading}
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
