import React from 'react';
import {
  Users, Users2, Target, ArrowRight, ArrowUpRight,
  Briefcase, MapPin, BarChart3, ExternalLink,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import EmptyState from '../ui/EmptyState';
import DEIAnalyticsSection from '../DEIAnalyticsSection';
import { PIPELINE_COLORS } from './constants';
import KpiCard from './KpiCard';
import { CategoryBarChart, CategoryRankList } from './AnalyticsCharts';
import { statusCardStyle, statusCardList } from '../dashboard/statusKpiMeta';
import { buildAtsHref } from '../../utils/atsLinks';

function formatActivityDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusTone(status) {
  if (status === 'Hired' || status === 'Joined') return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80';
  if (status === 'Offer') return 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200/80';
  if (status === 'Interview') return 'bg-violet-50 text-violet-700 ring-1 ring-violet-200/80';
  if (status === 'Rejected' || status === 'Dropped') return 'bg-red-50 text-red-700 ring-1 ring-red-200/80';
  return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/80';
}

export default function AnalyticsLivePanel({
  stats,
  navigate,
  activePipeline,
  isFreelancer = false,
  userId = '',
  periodLabel = 'This Month',
  dateRange = 'month',
  customFrom = '',
  customTo = '',
  tableScrollRef,
  onTableDragScrollStart,
  onTableDragScrollMove,
  onTableDragScrollEnd,
}) {
  const boardPath = isFreelancer ? '/my-pipeline' : '/recruitment';
  const atsView = stats.atsView || (userId || stats.scope === 'employee' ? 'mine' : 'all');
  const employeeId = userId || stats.scopedUserId || '';
  const period = stats.dateRange || dateRange || 'month';
  const from = stats.customFrom || customFrom || '';
  const to = stats.customTo || customTo || '';

  const goAts = (extra = {}) => navigate(buildAtsHref({
    view: atsView,
    employeeId: employeeId || undefined,
    period,
    from: period === 'custom' ? from : undefined,
    to: period === 'custom' ? to : undefined,
    ...extra,
  }));

  const hintLabel = stats.periodLabel || periodLabel;
  const statusCards = statusCardList(stats);
  const pipelineTotal = activePipeline.reduce((n, s) => n + (s.count || 0), 0);

  return (
    <div className="space-y-6">

      <div data-tour="analytics-kpis" className="min-w-0 w-full mb-8 sm:mb-10">
        <div className="grid gap-3 sm:gap-4 min-w-0 w-full grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          <KpiCard
            icon={Users}
            label="Total Candidates"
            value={stats.totalCandidates || 0}
            gradient="from-brand-500 to-teal-400"
            onClick={() => goAts()}
          />
          {statusCards.map((item, index) => {
            const style = statusCardStyle(item.stage, index);
            return (
              <KpiCard
                key={item.stage}
                icon={style.icon}
                label={item.stage}
                value={item.count || 0}
                gradient={style.gradient}
                onClick={() => goAts({ status: String(item.stage).toUpperCase() })}
              />
            );
          })}
        </div>
      </div>

      <div data-tour="analytics-charts" className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 card-ats-bordered p-4 sm:p-6 relative overflow-hidden min-w-0 transition-shadow duration-300 hover:shadow-md">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <div className="flex items-center justify-between gap-3 mb-5 min-w-0">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-stone-900 tracking-tight truncate">CV Submissions</h3>
              <p className="text-xs text-stone-500 mt-0.5 truncate">
                {stats.chartLabel || hintLabel}
                {stats.chartDays ? ` · ${stats.chartDays} days` : ''}
              </p>
            </div>
          </div>
          {stats.dailySubmissions && stats.dailySubmissions.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={stats.dailySubmissions} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px', boxShadow:'0 4px 12px rgba(0,0,0,0.08)' }}
                  labelStyle={{ fontWeight: 700 }}
                />
                <Area type="monotone" dataKey="count" stroke="#4f46e5" strokeWidth={2.5} fill="url(#colorCount)" name="Submissions" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              icon={BarChart3}
              tone="violet"
              compact
              message="No submissions in this period"
              subMessage={`Try a different time period to see trends.`}
              className="h-48"
            />
          )}
        </div>

        <div className="card-ats-bordered p-4 sm:p-6 relative overflow-hidden min-w-0 transition-shadow duration-300 hover:shadow-md">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 to-fuchsia-400" />
          <div className="flex items-center justify-between gap-2 mb-5 min-w-0">
            <h3 className="text-sm font-bold text-stone-900 tracking-tight truncate">Pipeline Overview</h3>
            <button type="button" onClick={() => navigate(boardPath)} className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 transition-all hover:gap-1.5 flex-shrink-0">
              Board <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-3">
            {stats.pipeline?.map((stage) => {
              const percent = stats.totalCandidates > 0 ? Math.round((stage.count / stats.totalCandidates) * 100) : 0;
              const color = PIPELINE_COLORS[stage.stage] || '#6b7280';
              return (
                <button key={stage.stage} type="button" onClick={() => goAts({ status: String(stage.stage).toUpperCase() })} className="w-full text-left group/stage rounded-lg p-1 -mx-1 hover:bg-stone-50 transition-colors min-w-0">
                  <div className="flex justify-between items-center gap-2 mb-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-xs font-medium text-stone-700 group-hover/stage:text-stone-900 truncate">{stage.stage}</span>
                    </div>
                    <span className="text-xs font-bold text-stone-900 tabular-nums flex-shrink-0">{stage.count}</span>
                  </div>
                  <div className="w-full bg-stone-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${Math.max(percent, 2)}%`, backgroundColor: color }} />
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-stone-100 grid grid-cols-2 gap-3">
            <div className="text-center p-2 bg-green-50 rounded-lg min-w-0">
              <p className="text-lg font-bold text-green-700 tabular-nums">
                {(stats.pipeline?.find(s => s.stage === 'Hired')?.count || 0) + (stats.pipeline?.find(s => s.stage === 'Joined')?.count || 0)}
              </p>
              <p className="text-[10px] font-semibold text-green-600 uppercase truncate">Hired / Joined</p>
            </div>
            <div className="text-center p-2 bg-red-50 rounded-lg min-w-0">
              <p className="text-lg font-bold text-red-700 tabular-nums">{stats.rejectionRate || 0}%</p>
              <p className="text-[10px] font-semibold text-red-600 uppercase truncate">Rejection Rate</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="card-ats-bordered p-4 sm:p-6 relative overflow-hidden min-w-0 transition-shadow duration-300 hover:shadow-md">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 to-teal-400" />
          <div className="flex items-center justify-between gap-2 mb-4 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <Briefcase size={16} className="text-brand-600 flex-shrink-0" />
              <h3 className="text-sm font-bold text-stone-900 truncate">Top Positions</h3>
            </div>
            <button type="button" onClick={() => goAts()} className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex-shrink-0">View</button>
          </div>
          {stats.topPositions?.length > 0 ? (
            <div className="space-y-1">
              {stats.topPositions.map((pos, idx) => (
                <button
                  key={pos.position}
                  type="button"
                  onClick={() => goAts({ q: pos.position })}
                  className="w-full flex items-start justify-between gap-3 py-2.5 px-3 rounded-xl hover:bg-brand-50/60 transition-all duration-200 group min-w-0"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <span className="w-6 h-6 rounded-lg bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{idx + 1}</span>
                    <span className="text-sm font-medium text-stone-800 break-words text-left leading-snug" title={pos.position}>{pos.position}</span>
                  </div>
                  <span className="text-xs font-bold text-stone-600 bg-stone-100 px-2.5 py-1 rounded-full flex-shrink-0 tabular-nums mt-0.5">{pos.count}</span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState icon={Briefcase} tone="violet" compact message="No position data" subMessage="Roles will appear as candidates are added." />
          )}
        </div>

        <div className="card-ats-bordered p-4 sm:p-6 relative overflow-hidden min-w-0 transition-shadow duration-300 hover:shadow-md">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-lime-400" />
          <div className="flex items-center justify-between gap-2 mb-4 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <ArrowUpRight size={16} className="text-emerald-600 flex-shrink-0" />
              <h3 className="text-sm font-bold text-stone-900 truncate">Top Sources</h3>
            </div>
            <button type="button" onClick={() => goAts()} className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex-shrink-0">View</button>
          </div>
          {stats.topSources?.length > 0 ? (
            <div className="space-y-1">
              {stats.topSources.map((src, idx) => (
                <button
                  key={src.source}
                  type="button"
                  onClick={() => goAts({ q: src.source })}
                  className="w-full flex items-start justify-between gap-3 py-2.5 px-3 rounded-xl hover:bg-emerald-50/60 transition-all duration-200 group min-w-0"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{idx + 1}</span>
                    <span className="text-sm font-medium text-stone-800 break-words text-left leading-snug" title={src.source}>{src.source}</span>
                  </div>
                  <span className="text-xs font-bold text-stone-600 bg-stone-100 px-2.5 py-1 rounded-full flex-shrink-0 tabular-nums mt-0.5">{src.count}</span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState icon={Target} tone="emerald" compact message="No source data" subMessage="Channels will appear as candidates are sourced." />
          )}
        </div>

        <div className="card-ats-bordered p-4 sm:p-6 relative overflow-hidden min-w-0 transition-shadow duration-300 hover:shadow-md md:col-span-2 lg:col-span-1">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 to-fuchsia-400" />
          <div className="flex items-center gap-2 mb-4 min-w-0">
            <MapPin size={16} className="text-violet-600 flex-shrink-0" />
            <h3 className="text-sm font-bold text-stone-900 truncate">Top Locations</h3>
          </div>
          {stats.locationBreakdown?.length > 0 ? (
            <div className="space-y-1">
              {stats.locationBreakdown.map((loc, idx) => (
                <button
                  key={loc.location}
                  type="button"
                  onClick={() => goAts({ q: loc.location })}
                  className="w-full flex items-start justify-between gap-3 py-2.5 px-3 rounded-xl hover:bg-violet-50/60 transition-all duration-200 group min-w-0"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <span className="w-6 h-6 rounded-lg bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{idx + 1}</span>
                    <span className="text-sm font-medium text-stone-800 break-words text-left leading-snug" title={loc.location}>{loc.location}</span>
                  </div>
                  <span className="text-xs font-bold text-stone-600 bg-stone-100 px-2.5 py-1 rounded-full flex-shrink-0 tabular-nums mt-0.5">{loc.count}</span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState icon={MapPin} tone="sky" compact message="No location data" subMessage="Locations will appear as profiles are completed." />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {activePipeline.length > 0 && (
          <div className="card-ats-bordered p-4 sm:p-6 relative overflow-hidden min-w-0 transition-shadow duration-300 hover:shadow-md">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-5 min-w-0">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-stone-900 tracking-tight">Status Distribution</h3>
                <p className="text-xs text-stone-500 mt-0.5">Candidates by pipeline stage</p>
              </div>
              <span className="inline-flex items-center gap-1.5 self-start text-[11px] font-semibold text-stone-500 bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 flex-shrink-0">
                <BarChart3 size={12} className="text-brand-600" />
                <span className="tabular-nums">{pipelineTotal.toLocaleString()}</span>
                <span>total</span>
              </span>
            </div>
            <div className="w-full min-h-[220px] mb-4 overflow-x-auto">
              <CategoryBarChart
                data={activePipeline.map((s) => ({ label: s.stage, value: s.count }))}
                horizontal
                height={Math.min(320, Math.max(220, activePipeline.length * 36 + 48))}
              />
            </div>
            <div className="space-y-2.5 pt-3 border-t border-stone-100">
              {activePipeline.map((stage) => {
                const pct = pipelineTotal > 0 ? Math.round(((stage.count || 0) / pipelineTotal) * 100) : 0;
                const color = PIPELINE_COLORS[stage.stage] || '#6b7280';
                return (
                  <div key={stage.stage} className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-xs font-medium text-stone-700 min-w-0 flex-1 truncate" title={stage.stage}>{stage.stage}</span>
                    <div className="w-16 sm:w-24 h-1.5 bg-stone-100 rounded-full overflow-hidden flex-shrink-0">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: color }} />
                    </div>
                    <span className="text-xs font-bold text-stone-900 tabular-nums w-8 text-right flex-shrink-0">{stage.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {stats.topSources && stats.topSources.length > 0 && (
          <div className="card-ats-bordered p-4 sm:p-6 relative overflow-hidden min-w-0 transition-shadow duration-300 hover:shadow-md">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-lime-400" />
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-5 min-w-0">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-stone-900 tracking-tight">Source Distribution</h3>
                <p className="text-xs text-stone-500 mt-0.5">Where candidates come from</p>
              </div>
              <span className="inline-flex items-center gap-1.5 self-start text-[11px] font-semibold text-stone-500 bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 flex-shrink-0">
                <Target size={12} className="text-emerald-600" />
                {stats.topSources.length} sources
              </span>
            </div>
            <div className="w-full min-h-[220px] mb-4 overflow-x-auto">
              <CategoryBarChart
                data={stats.topSources.map((s) => ({ label: s.source, fullLabel: s.source, value: s.count }))}
                horizontal
                limit={8}
              />
            </div>
            <CategoryRankList
              data={stats.topSources.map((s) => ({ label: s.source, fullLabel: s.source, value: s.count }))}
              limit={8}
              total={stats.topSources.reduce((n, s) => n + (s.count || 0), 0)}
            />
          </div>
        )}
      </div>

      {stats.recentCandidates?.length > 0 && (
        <div data-tour="analytics-activity" className="card-ats-bordered relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <div className="px-4 sm:px-6 py-4 border-b border-stone-100 bg-stone-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-stone-900 tracking-tight">Recent Activity</h3>
                <span className="inline-flex items-center rounded-full border border-stone-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                  Latest {stats.recentCandidates.length}
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">Newest candidates in the selected period</p>
            </div>
            <button
              type="button"
              onClick={() => goAts()}
              className="btn-secondary !py-2 !text-xs w-full sm:w-auto inline-flex items-center justify-center gap-1.5"
            >
              Open in Candidates <ArrowRight size={12} />
            </button>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-stone-100">
            {stats.recentCandidates.map((c, idx) => (
              <button
                key={c.id || idx}
                type="button"
                onClick={() => goAts(c.name ? { q: c.name } : {})}
                className="w-full text-left px-4 py-3.5 hover:bg-brand-50/40 transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-100 to-teal-100 text-brand-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {c.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-stone-900 truncate">{c.name || '—'}</p>
                      <ExternalLink size={14} className="text-stone-400 flex-shrink-0 mt-0.5" />
                    </div>
                    <p className="text-xs text-stone-500 truncate mt-0.5">{c.position || 'No position'}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold ${statusTone(c.status)}`}>
                        {c.status || '—'}
                      </span>
                      <span className="text-[11px] text-stone-400 tabular-nums">{formatActivityDate(c.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Desktop table */}
          <div
            ref={tableScrollRef}
            className="hidden sm:block overflow-x-auto select-none"
            onMouseDown={onTableDragScrollStart(tableScrollRef)}
            onMouseMove={onTableDragScrollMove}
            onMouseUp={onTableDragScrollEnd}
            onMouseLeave={onTableDragScrollEnd}
          >
            <table className="cand-table-drag w-full min-w-[720px] select-text">
              <thead>
                <tr className="bg-stone-50/80 border-b border-stone-200">
                  <th className="px-4 sm:px-6 py-3 text-left text-[11px] font-bold text-stone-500 uppercase tracking-wider">Candidate</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-[11px] font-bold text-stone-500 uppercase tracking-wider">Position</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-[11px] font-bold text-stone-500 uppercase tracking-wider">Source</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-[11px] font-bold text-stone-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 sm:px-6 py-3 text-right text-[11px] font-bold text-stone-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 sm:px-6 py-3 text-right text-[11px] font-bold text-stone-500 uppercase tracking-wider w-16"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {stats.recentCandidates.map((c, idx) => {
                  const openCandidate = () => goAts(c.name ? { q: c.name } : {});
                  return (
                    <tr
                      key={c.id || idx}
                      className="hover:bg-brand-50/40 transition-colors cursor-pointer group"
                      onClick={openCandidate}
                    >
                      <td className="px-4 sm:px-6 py-3.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-100 to-teal-100 text-brand-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {c.name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <span className="text-sm font-semibold text-stone-900 truncate max-w-[200px]">{c.name || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 text-sm text-stone-600 max-w-[180px] truncate">{c.position || '—'}</td>
                      <td className="px-4 sm:px-6 py-3.5 text-sm text-stone-600 max-w-[140px] truncate">{c.source || '—'}</td>
                      <td className="px-4 sm:px-6 py-3.5">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap ${statusTone(c.status)}`}>
                          {c.status || '—'}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 text-sm text-stone-500 whitespace-nowrap text-right tabular-nums">
                        {formatActivityDate(c.createdAt)}
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 text-right">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-stone-400 group-hover:border-brand-100 group-hover:bg-brand-50 group-hover:text-brand-700 transition-all">
                          <ExternalLink size={14} />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isFreelancer ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="h-9 w-9 rounded-xl bg-brand-50 border border-brand-100 text-brand-700 inline-flex items-center justify-center flex-shrink-0">
              <Users2 size={18} />
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-stone-900 tracking-tight">Diversity & Inclusion</h3>
              <p className="text-xs text-stone-500">Aggregate demographic insights from opt-in responses</p>
            </div>
          </div>
          <DEIAnalyticsSection userId={userId} />
        </div>
      ) : null}

    </div>
  );
}
