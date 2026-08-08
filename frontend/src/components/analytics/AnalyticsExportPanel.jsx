import React from 'react';
import {
  CheckCircle, ClipboardList, FileSpreadsheet, Calendar, FileText, Check,
  Eye, RefreshCw, Download, Share2,
} from 'lucide-react';
import PremiumSelect from '../ui/PremiumSelect';
import PremiumDatePicker from '../ui/PremiumDatePicker';
import {
  REPORT_TYPE_OPTIONS,
  DATE_RANGE_OPTIONS,
  REPORT_LABELS,
  DATE_RANGE_LABELS,
} from './constants';

export default function AnalyticsExportPanel({
  exportSuccess,
  reportType,
  setReportType,
  dateRange,
  setDateRange,
  customFrom,
  setCustomFrom,
  customTo,
  setCustomTo,
  exportFormat,
  setExportFormat,
  filteredCandidateCount,
  stats,
  handlePreview,
  previewLoading,
  handleExport,
  isExporting,
  openShareModal,
}) {
  return (
    <div className="space-y-6" data-tour="analytics-export">
      {exportSuccess && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm font-semibold">
          <CheckCircle size={18} className="text-emerald-600 flex-shrink-0" />
          Report exported successfully — check your downloads.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* One enterprise export panel */}
        <div className="xl:col-span-2 card-ats-bordered p-5 sm:p-6 relative overflow-hidden space-y-6">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center border border-brand-100">
              <ClipboardList size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900 tracking-tight">Export report</h3>
              <p className="text-xs text-stone-500">Choose type, period, and format in one place</p>
            </div>
          </div>

          <section className="rounded-xl border border-stone-200/90 bg-white shadow-sm p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="h-7 w-7 rounded-lg bg-brand-50 text-brand-700 border border-brand-100 inline-flex items-center justify-center">
                <FileSpreadsheet size={13} strokeWidth={2} />
              </span>
              <div>
                <p className="text-xs font-bold text-stone-800">Report type</p>
                <p className="text-[11px] text-stone-400">What to generate and download</p>
              </div>
            </div>
            <PremiumSelect
              value={reportType}
              onChange={setReportType}
              options={REPORT_TYPE_OPTIONS}
              icon={ClipboardList}
              searchable
              searchPlaceholder="Search reports…"
              placeholder="Select report type"
            />
          </section>

          <section className="rounded-xl border border-stone-200/90 bg-white shadow-sm p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="h-7 w-7 rounded-lg bg-sky-50 text-sky-700 border border-sky-100 inline-flex items-center justify-center">
                <Calendar size={13} strokeWidth={2} />
              </span>
              <div>
                <p className="text-xs font-bold text-stone-800">Date range</p>
                <p className="text-[11px] text-stone-400">Filter the report period</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="min-w-0 sm:col-span-2">
                <label className="label-ats">Period</label>
                <PremiumSelect
                  variant="list"
                  value={dateRange}
                  onChange={setDateRange}
                  options={DATE_RANGE_OPTIONS}
                  icon={Calendar}
                  placeholder="Select period"
                />
              </div>
              {dateRange === 'custom' && (
                <>
                  <div className="min-w-0">
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-600 mb-1.5">
                      <Calendar size={12} className="text-brand-600" /> From
                    </label>
                    <PremiumDatePicker
                      value={customFrom}
                      onChange={setCustomFrom}
                      placeholder="Start date"
                      allowClear
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-600 mb-1.5">
                      <Calendar size={12} className="text-brand-600" /> To
                    </label>
                    <PremiumDatePicker
                      value={customTo}
                      onChange={setCustomTo}
                      placeholder="End date"
                      allowClear
                    />
                  </div>
                </>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-stone-200/90 bg-white shadow-sm p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="h-7 w-7 rounded-lg bg-violet-50 text-violet-700 border border-violet-100 inline-flex items-center justify-center">
                <FileText size={13} strokeWidth={2} />
              </span>
              <div>
                <p className="text-xs font-bold text-stone-800">File format</p>
                <p className="text-[11px] text-stone-400">Output type for download</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setExportFormat('pdf')}
              className={`w-full sm:w-auto min-w-[220px] flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                exportFormat === 'pdf'
                  ? 'border-brand-500 bg-brand-50/80 ring-2 ring-brand-400/40'
                  : 'border-stone-200 hover:border-stone-300'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0 border border-rose-100">
                <FileText size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-stone-900">PDF</h4>
                <p className="text-[11px] text-stone-500">Branded report with charts</p>
              </div>
              {exportFormat === 'pdf' && (
                <span className="w-5 h-5 rounded-full bg-brand-600 text-white inline-flex items-center justify-center flex-shrink-0">
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
            </button>
          </section>
        </div>

        <div className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden h-fit">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <h3 className="text-sm font-bold text-stone-900 tracking-tight mb-4">Export summary</h3>
          <div className="space-y-3 mb-5 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-stone-500">Report</span>
              <span className="font-semibold text-stone-900 text-right text-xs max-w-[160px] truncate">
                {REPORT_LABELS[reportType]}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-stone-500">Format</span>
              <span className="font-semibold text-stone-900">PDF</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-stone-500">Range</span>
              <span className="font-semibold text-stone-900 text-xs text-right">
                {dateRange === 'custom' && customFrom && customTo
                  ? `${new Date(customFrom).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – ${new Date(customTo).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
                  : DATE_RANGE_LABELS[dateRange]}
              </span>
            </div>
            <div className="border-t border-stone-100 pt-3 flex justify-between">
              <span className="text-stone-500">Candidates</span>
              <span className="font-bold text-brand-600 tabular-nums">
                {(filteredCandidateCount !== null ? filteredCandidateCount : stats?.totalCandidates)?.toLocaleString() || 0}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handlePreview}
            disabled={previewLoading || (dateRange === 'custom' && (!customFrom || !customTo))}
            className="btn-secondary w-full mb-2 disabled:opacity-50"
          >
            {previewLoading ? <RefreshCw size={16} className="animate-spin" /> : <Eye size={16} />}
            {previewLoading ? 'Loading…' : 'Preview'}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting || (dateRange === 'custom' && (!customFrom || !customTo))}
              className="btn-primary disabled:opacity-50"
            >
              {isExporting ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
              {isExporting ? '…' : 'Export'}
            </button>
            <button
              type="button"
              onClick={openShareModal}
              disabled={dateRange === 'custom' && (!customFrom || !customTo)}
              className="btn-secondary disabled:opacity-50 !text-emerald-700 !border-emerald-200 hover:!bg-emerald-50"
            >
              <Share2 size={16} /> Share
            </button>
          </div>
          {dateRange === 'custom' && (!customFrom || !customTo) && (
            <p className="text-[11px] text-amber-600 font-medium mt-2 text-center">Select both From and To dates</p>
          )}
        </div>
      </div>
    </div>
  );
}
