import React from 'react';
import {
  CheckCircle, ClipboardList, FileSpreadsheet, FileText, Check,
  Eye, RefreshCw, Download, Share2, BarChart3,
} from 'lucide-react';
import PremiumSelect from '../ui/PremiumSelect';
import {
  REPORT_TYPE_OPTIONS,
  REPORT_LABELS,
  DATE_RANGE_LABELS,
} from './constants';

export default function AnalyticsExportPanel({
  exportSuccess,
  reportType,
  setReportType,
  dateRange,
  customFrom,
  customTo,
  exportFormat,
  setExportFormat,
  filteredCandidateCount,
  stats,
  scopeLabel,
  periodLabel,
  periodReady = true,
  customRangeInvalid = false,
  handlePreview,
  previewLoading,
  handleExport,
  isExporting,
  openShareModal,
}) {
  const candidateCount = stats?.totalCandidates ?? filteredCandidateCount ?? 0;
  const rangeLabel = periodLabel
    || (dateRange === 'custom' && customFrom && customTo
      ? `${new Date(customFrom).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – ${new Date(customTo).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
      : DATE_RANGE_LABELS[dateRange]);
  const actionsDisabled = !periodReady || isExporting || previewLoading;

  return (
    <div className="space-y-5" data-tour="analytics-export">
      {exportSuccess && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm font-semibold">
          <CheckCircle size={18} className="text-emerald-600 flex-shrink-0" />
          Download complete — check your downloads folder.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-5">
        <div className="xl:col-span-2 card-ats-bordered relative overflow-hidden min-w-0">
          <div className="h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />

          <div className="px-4 sm:px-5 py-4 border-b border-stone-100 bg-stone-50/80 flex items-center gap-3 min-w-0">
            <span className="h-9 w-9 rounded-xl bg-brand-50 text-brand-600 border border-brand-100 inline-flex items-center justify-center flex-shrink-0">
              <BarChart3 size={17} strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-stone-900 tracking-tight">Generate report</h3>
              <p className="text-xs text-stone-500 mt-0.5 truncate">PDF summaries or Excel workbooks for the selected period</p>
            </div>
          </div>

          <div className="p-4 sm:p-5 space-y-5">
            <div className="min-w-0">
              <label className="label-ats mb-1.5">Report type</label>
              <PremiumSelect
                value={reportType}
                onChange={setReportType}
                options={REPORT_TYPE_OPTIONS}
                icon={ClipboardList}
                searchable
                searchPlaceholder="Search reports…"
                placeholder="Select report type"
              />
            </div>

            <div>
              <label className="label-ats mb-2">Output format</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { id: 'pdf', label: 'PDF report', desc: 'Branded layout with charts and summary', icon: FileText, tone: 'rose' },
                  { id: 'xlsx', label: 'Excel workbook', desc: 'Native .xlsx file for Microsoft Excel', icon: FileSpreadsheet, tone: 'emerald' },
                ].map((fmt) => {
                  const active = exportFormat === fmt.id;
                  const Icon = fmt.icon;
                  return (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => setExportFormat(fmt.id)}
                      className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all min-w-0 ${
                        active
                          ? 'border-brand-500 bg-brand-50/70 ring-2 ring-brand-400/30'
                          : 'border-stone-200 hover:border-stone-300 bg-white'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                        fmt.tone === 'rose' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                      }`}>
                        <Icon size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold text-stone-900">{fmt.label}</h4>
                        <p className="text-[11px] text-stone-500 mt-0.5">{fmt.desc}</p>
                      </div>
                      {active && (
                        <span className="w-5 h-5 rounded-full bg-brand-600 text-white inline-flex items-center justify-center flex-shrink-0">
                          <Check size={12} strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="text-xs text-stone-500 rounded-lg border border-stone-100 bg-stone-50/60 px-3 py-2.5">
              Period and reporting scope are taken from the filters above.
            </p>
          </div>
        </div>

        <div className="card-ats-bordered relative overflow-hidden h-fit min-w-0">
          <div className="h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <div className="px-4 sm:px-5 py-4 border-b border-stone-100">
            <h3 className="text-sm font-bold text-stone-900 tracking-tight">Export summary</h3>
          </div>

          <div className="p-4 sm:p-5 space-y-3 text-sm">
            {scopeLabel && (
              <div className="flex justify-between gap-3 min-w-0">
                <span className="text-stone-500 flex-shrink-0">Scope</span>
                <span className="font-semibold text-stone-900 text-right text-xs max-w-[60%] truncate">{scopeLabel}</span>
              </div>
            )}
            <div className="flex justify-between gap-3 min-w-0">
              <span className="text-stone-500 flex-shrink-0">Report</span>
              <span className="font-semibold text-stone-900 text-right text-xs truncate">{REPORT_LABELS[reportType]}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-stone-500">Format</span>
              <span className="font-semibold text-stone-900">{exportFormat === 'xlsx' ? 'Excel (.xlsx)' : 'PDF'}</span>
            </div>
            <div className="flex justify-between gap-3 min-w-0">
              <span className="text-stone-500 flex-shrink-0">Period</span>
              <span className="font-semibold text-stone-900 text-xs text-right truncate max-w-[60%]">{rangeLabel}</span>
            </div>
            <div className="border-t border-stone-100 pt-3 flex justify-between items-center gap-3">
              <span className="text-stone-500">Candidates</span>
              <span className="font-bold text-brand-600 tabular-nums text-base">
                {Number(candidateCount).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="px-4 sm:px-5 pb-5 space-y-2">
            <button
              type="button"
              onClick={handlePreview}
              disabled={actionsDisabled}
              className="btn-secondary w-full disabled:opacity-50"
            >
              {previewLoading ? <RefreshCw size={16} className="animate-spin" /> : <Eye size={16} />}
              {previewLoading ? 'Preparing preview…' : 'Preview report'}
            </button>
            <div className={openShareModal ? 'grid grid-cols-1 sm:grid-cols-2 gap-2' : ''}>
              <button
                type="button"
                onClick={handleExport}
                disabled={actionsDisabled}
                className="btn-primary disabled:opacity-50 w-full"
              >
                {isExporting ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
                {isExporting ? 'Exporting…' : `Download ${exportFormat === 'pdf' ? 'PDF' : 'Excel'}`}
              </button>
              {openShareModal ? (
                <button
                  type="button"
                  onClick={openShareModal}
                  disabled={!periodReady}
                  className="btn-secondary disabled:opacity-50 !text-emerald-700 !border-emerald-200 hover:!bg-emerald-50 w-full"
                >
                  <Share2 size={16} /> Share
                </button>
              ) : null}
            </div>
            {customRangeInvalid && (
              <p className="text-[11px] text-red-600 font-medium text-center">End date must be on or after the start date.</p>
            )}
            {dateRange === 'custom' && !periodReady && !customRangeInvalid && (
              <p className="text-[11px] text-amber-600 font-medium text-center">Select a start and end date</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
