import React from 'react';
import {
  Users, Users2, Calendar, Target, Clock, ArrowRight, ArrowUpRight,
  Briefcase, MapPin, BarChart3, ExternalLink, X,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';
import EmptyState from '../ui/EmptyState';
import DEIAnalyticsSection from '../DEIAnalyticsSection';
import { PIPELINE_COLORS, PIE_COLORS } from './constants';
import KpiCard from './KpiCard';

export default function AnalyticsLivePanel({
  stats,
  totalActive,
  navigate,
  activePipeline,
  tableScrollRef,
  onTableDragScrollStart,
  onTableDragScrollMove,
  onTableDragScrollEnd,
}) {
  return (
    <div className="space-y-6">

      <div data-tour="analytics-kpis" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={Users}
          label="Total Candidates"
          value={stats.totalCandidates?.toLocaleString() || 0}
          sub={`${totalActive} active in pipeline`}
          gradient="from-brand-500 to-teal-400"
          onClick={() => navigate('/ats')}
        />
        <KpiCard
          icon={Calendar}
          label="Added This Month"
          value={stats.thisMonth || 0}
          trend={stats.candidateTrend}
          gradient="from-emerald-500 to-lime-400"
          onClick={() => navigate('/ats')}
        />
        <KpiCard
          icon={Target}
          label="Conversion Rate"
          value={`${stats.conversionRate || 0}%`}
          sub="Offer + Hired + Joined"
          gradient="from-cyan-500 to-sky-400"
          onClick={() => navigate('/applications')}
        />
        <KpiCard
          icon={Clock}
          label="Pending Review"
          value={stats.pendingReview || 0}
          sub="Applied + Screening"
          gradient="from-amber-500 to-orange-400"
          onClick={() => navigate('/applications')}
        />
      </div>

      <div data-tour="analytics-charts" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card-ats-bordered p-5 sm:p-6 relative overflow-hidden transition-shadow duration-300 hover:shadow-md">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-stone-900 tracking-tight">Daily CV Submissions</h3>
              <p className="text-xs text-stone-500 mt-0.5">Last 7 days activity</p>
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
              message="No submission data"
              subMessage="No candidate submissions in the last 7 days."
              className="h-48"
            />
          )}
        </div>

        <div className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden transition-shadow duration-300 hover:shadow-md">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 to-fuchsia-400" />
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-stone-900 tracking-tight">Pipeline Overview</h3>
            <button type="button" onClick={() => navigate('/recruitment')} className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 transition-all hover:gap-1.5">
              Board <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-3">
            {stats.pipeline?.map((stage) => {
              const percent = stats.totalCandidates > 0 ? Math.round((stage.count / stats.totalCandidates) * 100) : 0;
              const color = PIPELINE_COLORS[stage.stage] || '#6b7280';
              const route = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Joined'].includes(stage.stage)
                ? '/applications'
                : '/ats';
              return (
                <button key={stage.stage} type="button" onClick={() => navigate(route)} className="w-full text-left group/stage rounded-lg p-1 -mx-1 hover:bg-stone-50 transition-colors">
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-xs font-medium text-stone-700 group-hover/stage:text-stone-900">{stage.stage}</span>
                    </div>
                    <span className="text-xs font-bold text-stone-900">{stage.count}</span>
                  </div>
                  <div className="w-full bg-stone-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${Math.max(percent, 2)}%`, backgroundColor: color }} />
                  </div>
                </button>
              );
            })}
          </div>
          {/* Summary */}
          <div className="mt-4 pt-4 border-t border-stone-100 grid grid-cols-2 gap-3">
            <div className="text-center p-2 bg-green-50 rounded-lg">
              <p className="text-lg font-bold text-green-700">
                {(stats.pipeline?.find(s => s.stage === 'Hired')?.count || 0) + (stats.pipeline?.find(s => s.stage === 'Joined')?.count || 0)}
              </p>
              <p className="text-[10px] font-semibold text-green-600 uppercase">Hired / Joined</p>
            </div>
            <div className="text-center p-2 bg-red-50 rounded-lg">
              <p className="text-lg font-bold text-red-700">{stats.rejectionRate || 0}%</p>
              <p className="text-[10px] font-semibold text-red-600 uppercase">Rejection Rate</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden transition-shadow duration-300 hover:shadow-md">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 to-teal-400" />
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Briefcase size={16} className="text-brand-600" />
              <h3 className="text-sm font-bold text-stone-900">Top Positions</h3>
            </div>
            <button type="button" onClick={() => navigate('/ats')} className="text-xs font-semibold text-brand-600 hover:text-brand-700">View</button>
          </div>
          {stats.topPositions?.length > 0 ? (
            <div className="space-y-1">
              {stats.topPositions.map((pos, idx) => (
                <button
                  key={pos.position}
                  type="button"
                  onClick={() => navigate(`/ats?q=${encodeURIComponent(pos.position)}`)}
                  className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-brand-50/60 transition-all duration-200 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center transition-transform group-hover:scale-110">{idx + 1}</span>
                    <span className="text-sm font-medium text-stone-800 truncate">{pos.position}</span>
                  </div>
                  <span className="text-xs font-bold text-stone-600 bg-stone-100 px-2.5 py-1 rounded-full">{pos.count}</span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState icon={Briefcase} tone="violet" compact message="No position data yet" subMessage="Hiring by role will show up here." />
          )}
        </div>

        <div className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden transition-shadow duration-300 hover:shadow-md">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-lime-400" />
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ArrowUpRight size={16} className="text-emerald-600" />
              <h3 className="text-sm font-bold text-stone-900">Top Sources</h3>
            </div>
            <button type="button" onClick={() => navigate('/ats')} className="text-xs font-semibold text-brand-600 hover:text-brand-700">View</button>
          </div>
          {stats.topSources?.length > 0 ? (
            <div className="space-y-1">
              {stats.topSources.map((src, idx) => (
                <button
                  key={src.source}
                  type="button"
                  onClick={() => navigate(`/ats?q=${encodeURIComponent(src.source)}`)}
                  className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-emerald-50/60 transition-all duration-200 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center transition-transform group-hover:scale-110">{idx + 1}</span>
                    <span className="text-sm font-medium text-stone-800 truncate">{src.source}</span>
                  </div>
                  <span className="text-xs font-bold text-stone-600 bg-stone-100 px-2.5 py-1 rounded-full">{src.count}</span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState icon={Target} tone="emerald" compact message="No source data yet" subMessage="Track referrals, job boards, and channels here." />
          )}
        </div>

        <div className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden transition-shadow duration-300 hover:shadow-md">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 to-fuchsia-400" />
          <div className="flex items-center gap-2 mb-4">
            <MapPin size={16} className="text-violet-600" />
            <h3 className="text-sm font-bold text-stone-900">Top Locations</h3>
          </div>
          {stats.locationBreakdown?.length > 0 ? (
            <div className="space-y-1">
              {stats.locationBreakdown.map((loc, idx) => (
                <button
                  key={loc.location}
                  type="button"
                  onClick={() => navigate(`/ats?q=${encodeURIComponent(loc.location)}`)}
                  className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-violet-50/60 transition-all duration-200 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center transition-transform group-hover:scale-110">{idx + 1}</span>
                    <span className="text-sm font-medium text-stone-800 truncate">{loc.location}</span>
                  </div>
                  <span className="text-xs font-bold text-stone-600 bg-stone-100 px-2.5 py-1 rounded-full">{loc.count}</span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState icon={MapPin} tone="sky" compact message="No location data" subMessage="Candidate locations will appear as you add profiles." />
          )}
        </div>
      </div>

      {/* ── Row 4: Pipeline Chart + Source Pie ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {activePipeline.length > 0 && (
          <div className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden min-w-0 transition-shadow duration-300 hover:shadow-md">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
            <div className="flex items-start justify-between gap-3 mb-5">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-stone-900 tracking-tight">Status Distribution</h3>
                <p className="text-xs text-stone-500 mt-0.5">Candidates by pipeline stage</p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-stone-500 bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 flex-shrink-0">
                <BarChart3 size={12} className="text-brand-600" />
                {activePipeline.reduce((n, s) => n + (s.count || 0), 0)} total
              </span>
            </div>
            <div className="w-full h-[220px] min-h-[220px] mb-4">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={activePipeline} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                  <XAxis
                    dataKey="stage"
                    tick={{ fontSize: 10, fill: '#78716c' }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    height={36}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#78716c' }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: '10px', border: '1px solid #e7e5e4', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                    cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} name="Candidates" maxBarSize={48}>
                    {activePipeline.map((entry, i) => (
                      <Cell key={entry.stage || i} fill={PIPELINE_COLORS[entry.stage] || PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2.5 pt-3 border-t border-stone-100">
              {activePipeline.map((stage) => {
                const max = Math.max(...activePipeline.map((s) => s.count || 0), 1);
                const pct = Math.round(((stage.count || 0) / max) * 100);
                const color = PIPELINE_COLORS[stage.stage] || '#6b7280';
                return (
                  <div key={stage.stage} className="flex items-center gap-3 min-w-0">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-xs font-medium text-stone-700 w-20 flex-shrink-0 truncate">{stage.stage}</span>
                    <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden min-w-0">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: color }} />
                    </div>
                    <span className="text-xs font-bold text-stone-900 tabular-nums w-6 text-right flex-shrink-0">{stage.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {stats.topSources && stats.topSources.length > 0 && (
          <div className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden min-w-0 transition-shadow duration-300 hover:shadow-md">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-lime-400" />
            <div className="flex items-start justify-between gap-3 mb-5">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-stone-900 tracking-tight">Source Distribution</h3>
                <p className="text-xs text-stone-500 mt-0.5">Where candidates come from</p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-stone-500 bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 flex-shrink-0">
                <Target size={12} className="text-emerald-600" />
                {stats.topSources.length} sources
              </span>
            </div>
            <div className="w-full h-[220px] min-h-[220px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie
                    data={stats.topSources}
                    cx="50%"
                    cy="50%"
                    innerRadius={54}
                    outerRadius={88}
                    dataKey="count"
                    nameKey="source"
                    paddingAngle={3}
                  >
                    {stats.topSources.map((s, i) => (
                      <Cell key={s.source || i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #e7e5e4', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center mt-1 pt-3 border-t border-stone-100">
              {stats.topSources.map((s, i) => (
                <div key={s.source} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-[11px] text-stone-600 font-medium">{s.source}</span>
                  <span className="text-[11px] text-stone-400 tabular-nums">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Row 5: Recent Activity Table ── */}
      {stats.recentCandidates?.length > 0 && (
        <div data-tour="analytics-activity" className="table-shell-ats relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <div className="px-5 sm:px-6 py-4 border-b border-stone-100 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-stone-900">Recent Activity</h3>
              <p className="text-xs text-stone-500 mt-0.5">Latest candidates added to the system</p>
            </div>
            <button type="button" onClick={() => navigate('/ats')} className="text-xs font-semibold text-brand-600 hover:text-brand-700 inline-flex items-center gap-1 transition-all hover:gap-1.5 flex-shrink-0">
              View all <ArrowRight size={12} />
            </button>
          </div>
          <div
            ref={tableScrollRef}
            className="cand-table-scroll overflow-x-auto select-none"
            onMouseDown={onTableDragScrollStart(tableScrollRef)}
            onMouseMove={onTableDragScrollMove}
            onMouseUp={onTableDragScrollEnd}
            onMouseLeave={onTableDragScrollEnd}
          >
            <table className="cand-table-drag w-full min-w-[720px] select-text">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200">
                  <th className="px-4 sm:px-6 py-3 text-left text-[11px] font-bold text-stone-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-[11px] font-bold text-stone-500 uppercase tracking-wider whitespace-nowrap">Candidate</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-[11px] font-bold text-stone-500 uppercase tracking-wider whitespace-nowrap">Position</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-[11px] font-bold text-stone-500 uppercase tracking-wider whitespace-nowrap">Source</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-[11px] font-bold text-stone-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-[11px] font-bold text-stone-500 uppercase tracking-wider whitespace-nowrap">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {stats.recentCandidates.map((c, idx) => {
                  const openCandidate = () => navigate(c.name ? `/ats?q=${encodeURIComponent(c.name)}` : '/ats');
                  return (
                    <tr
                      key={c.id || idx}
                      className="hover:bg-brand-50/40 transition-colors"
                    >
                      <td className="px-4 sm:px-6 py-3.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={openCandidate}
                          className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-brand-100 bg-brand-50/80 text-brand-700 shadow-sm hover:bg-brand-100 hover:border-brand-200 transition-all"
                          title="Open in Candidates"
                        >
                          <ExternalLink size={15} strokeWidth={2} />
                        </button>
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-100 to-teal-100 text-brand-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {c.name?.charAt(0)?.toUpperCase()}
                          </div>
                          <span className="text-sm font-semibold text-stone-900 truncate max-w-[180px]">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 text-sm text-stone-600 whitespace-nowrap">{c.position || '—'}</td>
                      <td className="px-4 sm:px-6 py-3.5 text-sm text-stone-600 whitespace-nowrap">{c.source || '—'}</td>
                      <td className="px-4 sm:px-6 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
                          c.status === 'Hired' || c.status === 'Joined' ? 'bg-emerald-100 text-emerald-700' :
                          c.status === 'Offer' ? 'bg-cyan-100 text-cyan-700' :
                          c.status === 'Interview' ? 'bg-violet-100 text-violet-700' :
                          c.status === 'Rejected' || c.status === 'Dropped' ? 'bg-red-100 text-red-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>{c.status}</span>
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 text-sm text-stone-500 whitespace-nowrap">
                        {new Date(c.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════ DIVERSITY & INCLUSION (add-on) ═══════════════ */}
      <div className="space-y-3">
        <div className="flex items-center gap-2.5">
          <span className="h-9 w-9 rounded-xl bg-brand-50 border border-brand-100 text-brand-700 inline-flex items-center justify-center">
            <Users2 size={18} />
          </span>
          <div>
            <h3 className="text-base font-bold text-stone-900 tracking-tight">Diversity & Inclusion</h3>
            <p className="text-xs text-stone-500">Opt-in demographic funnel (aggregate only)</p>
          </div>
        </div>
        <DEIAnalyticsSection />
      </div>

    </div>
  );
}
