import React, { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { BarChart3, TrendingUp, Shield, Calendar, User, Building2 } from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import { CategoryBarChart, CategoryRankList } from './AnalyticsCharts';
import { CHART_TOOLTIP_STYLE, CHART_GRID_STROKE } from './chartUtils';
import { useAuth } from '../../context/AuthContext';
import { resolveOrgLogoSrc } from '../../utils/orgLogo';

const KPI_ACCENTS = ['#0d9488', '#4338ca', '#059669', '#d97706'];

export default function AnalyticsReportPreview({ previewData }) {
  const { organization } = useAuth();
  const pipelineChart = previewData?.pipelineChart || [];
  const trendChart = previewData?.trendChart || [];
  const totalFromChart = useMemo(
    () => pipelineChart.reduce((s, d) => s + (d.value || 0), 0),
    [pipelineChart]
  );
  const chartTitle = previewData?.chartTitle || 'Distribution';
  const logoSrc = resolveOrgLogoSrc(previewData?.orgLogo || organization?.logo);
  const orgName = previewData?.orgName || organization?.name || '';

  if (!previewData) return null;

  return (
    <div className="space-y-0 rounded-xl border border-stone-200 overflow-hidden bg-white shadow-xl">
      {/* Cover band */}
      <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 py-7 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(20,184,166,0.22),transparent_55%)]" />
        <div className="relative flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          <div className="min-w-0 flex-1 flex gap-4">
            {logoSrc ? (
              <div className="shrink-0 rounded-lg bg-white px-3 py-2 shadow-md ring-1 ring-white/20 self-start">
                <img
                  src={logoSrc}
                  alt={orgName ? `${orgName} logo` : 'Company logo'}
                  className="h-9 w-auto max-w-[120px] object-contain"
                />
              </div>
            ) : orgName ? (
              <div className="shrink-0 w-11 h-11 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center self-start">
                <Building2 size={20} className="text-teal-300" />
              </div>
            ) : null}
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-300/90 mb-2">
                Confidential · Internal recruitment report
              </p>
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight leading-tight">{previewData.title}</h3>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-xs text-slate-300">
                {orgName && (
                  <span className="inline-flex items-center gap-1.5 font-medium text-slate-200">
                    {orgName}
                  </span>
                )}
                {previewData.scopeLabel && (
                  <span className="inline-flex items-center gap-1.5">
                    <User size={13} className="text-teal-400" />
                    Scope: {previewData.scopeLabel}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <Calendar size={13} className="text-teal-400" />
                  Period: {previewData.subtitle}
                </span>
              </div>
              {previewData.generatedAt && (
                <p className="text-[11px] text-slate-500 mt-2">
                  Generated {new Date(previewData.generatedAt).toLocaleString('en-IN', {
                    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              )}
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg bg-white/10 border border-white/15 px-3 py-2 text-[11px] text-slate-200 shrink-0">
            <Shield size={14} className="text-teal-300" />
            For internal use only
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-6 bg-gradient-to-b from-stone-50/90 to-white">
        {previewData.summary?.length > 0 && (
          <section>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-stone-400 mb-3">Summary</p>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              {previewData.summary.map((card, i) => (
                <div
                  key={card.label}
                  className="relative rounded-xl border border-stone-200 bg-white p-4 shadow-sm overflow-hidden"
                >
                  <div
                    className="absolute inset-x-0 top-0 h-1"
                    style={{ backgroundColor: KPI_ACCENTS[i % KPI_ACCENTS.length] }}
                  />
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500 pr-2">{card.label}</p>
                  <p className="text-2xl font-bold text-stone-900 tabular-nums mt-2 tracking-tight">{card.value}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {(pipelineChart.length > 0 || trendChart.length > 1) && (
          <section className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            {pipelineChart.length > 0 && (
              <div className="xl:col-span-7 card-ats-bordered p-5 relative overflow-hidden min-w-0">
                <div className="h-1 absolute inset-x-0 top-0 bg-gradient-to-r from-brand-500 to-teal-400" />
                <div className="flex items-center justify-between mb-4 pt-1 gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <BarChart3 size={16} className="text-brand-600 flex-shrink-0" />
                    <h4 className="text-sm font-bold text-stone-900 truncate">{chartTitle}</h4>
                  </div>
                  <span className="text-xs font-semibold text-stone-500 tabular-nums flex-shrink-0">{totalFromChart.toLocaleString()} total</span>
                </div>
                <CategoryBarChart data={pipelineChart} horizontal="auto" limit={10} />
              </div>
            )}

            {pipelineChart.length > 0 && (
              <div className="xl:col-span-5 card-ats-bordered p-5 relative overflow-hidden min-w-0">
                <div className="h-1 absolute inset-x-0 top-0 bg-gradient-to-r from-violet-500 to-indigo-400" />
                <h4 className="text-sm font-bold text-stone-900 mb-4 pt-1">Stage breakdown</h4>
                <CategoryRankList data={pipelineChart} limit={8} total={totalFromChart} />
              </div>
            )}

            {trendChart.length > 1 && (
              <div className="xl:col-span-12 card-ats-bordered p-5 relative overflow-hidden min-w-0">
                <div className="h-1 absolute inset-x-0 top-0 bg-gradient-to-r from-indigo-500 to-brand-500" />
                <div className="flex items-center gap-2 mb-4 pt-1">
                  <TrendingUp size={16} className="text-indigo-600" />
                  <h4 className="text-sm font-bold text-stone-900">Applications over time</h4>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={trendChart} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="reportTrendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4338CA" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="#4338CA" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID_STROKE} />
                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#78716c' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#78716c' }} axisLine={false} tickLine={false} width={32} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Area type="monotone" dataKey="count" stroke="#4338CA" strokeWidth={2.5} fill="url(#reportTrendFill)" name="Applications" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>
        )}

        {previewData.metrics?.length > 0 && (
          <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {previewData.metrics.map((m) => (
              <div key={m.label} className="rounded-xl border border-stone-200 bg-white px-4 py-3">
                <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-wide">{m.label}</p>
                <p className="text-xl font-bold text-stone-900 tabular-nums mt-1">{m.value}</p>
              </div>
            ))}
          </section>
        )}

        {previewData.insights?.length > 0 && (
          <section>
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-stone-400">Executive summary</p>
              <span className="text-[10px] font-semibold text-stone-400 tabular-nums">{previewData.insights.length} insights</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {previewData.insights.map((line, i) => (
                <div
                  key={i}
                  className="relative rounded-xl border border-stone-200 bg-white p-4 pl-5 shadow-sm overflow-hidden"
                >
                  <div className="absolute left-0 inset-y-0 w-1 bg-gradient-to-b from-brand-500 to-teal-400" />
                  <p className="text-[13px] text-stone-700 leading-relaxed">{line}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {!previewData.rows?.length ? (
          <EmptyState icon={BarChart3} tone="brand" compact message="No data for this report" subMessage="Try a wider date range or different scope." />
        ) : (
          <section className="table-shell-ats overflow-hidden">
            <div className="px-5 py-3 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
              <p className="text-xs font-bold text-stone-700 uppercase tracking-wider">Detailed data</p>
              <p className="text-xs text-stone-500 tabular-nums font-medium">
                {previewData.rows.length}{previewData.totalRows ? ` of ${previewData.totalRows.toLocaleString()}` : ''} rows
              </p>
            </div>
            <div className="overflow-x-auto max-h-[42vh]">
              <table className="w-full text-sm min-w-[720px] table-fixed">
                <thead className="bg-stone-100/90 sticky top-0 z-10">
                  <tr>
                    {previewData.headers?.map((h, i) => (
                      <th
                        key={i}
                        className={`px-3 sm:px-4 py-3 text-left text-[11px] font-bold text-stone-600 uppercase tracking-wider border-b border-stone-200 ${
                          i === 0 ? 'w-[28%] min-w-[10rem]' : 'whitespace-nowrap'
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 bg-white">
                  {previewData.rows.map((row, ri) => (
                    <tr key={ri} className="hover:bg-brand-50/30 transition-colors">
                      {row.map((cell, ci) => (
                        <td
                          key={ci}
                          className={`px-3 sm:px-4 py-2.5 text-sm text-stone-700 ${
                            ci === 0
                              ? 'font-medium break-words whitespace-normal leading-snug'
                              : 'whitespace-nowrap tabular-nums'
                          }`}
                          title={cell != null ? String(cell) : undefined}
                        >
                          {cell ?? '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {previewData.totalRows > (previewData.rows?.length || 0) && (
              <div className="px-5 py-3 bg-amber-50 border-t border-amber-200 text-xs text-amber-800">
                Preview shows {previewData.rows.length} of {previewData.totalRows.toLocaleString()} rows. Download the full report for complete data.
              </div>
            )}
          </section>
        )}

        <footer className="mt-6 pt-5 border-t border-stone-200/90">
          <div className="h-0.5 rounded-full bg-gradient-to-r from-brand-500/20 via-teal-400/50 to-brand-500/20 mb-4" />
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {logoSrc ? (
                <img
                  src={logoSrc}
                  alt=""
                  className="h-7 w-auto max-w-[96px] object-contain opacity-90"
                />
              ) : null}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-stone-800 truncate">
                  {orgName || 'Recruitment report'}
                </p>
                <p className="text-[10px] text-stone-500 mt-0.5">
                  Confidential — for authorized use only
                </p>
              </div>
            </div>
            <div className="text-[10px] text-stone-400 sm:text-right leading-relaxed shrink-0">
              {previewData.generatedAt && (
                <p>
                  Generated{' '}
                  {new Date(previewData.generatedAt).toLocaleString('en-IN', {
                    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              )}
              <p className="mt-0.5">Not for distribution outside your organization</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
