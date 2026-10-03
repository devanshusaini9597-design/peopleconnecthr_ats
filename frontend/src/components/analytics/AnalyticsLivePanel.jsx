import React, { useRef } from 'react';
import {
  Users, Target, Timer, UserX, Briefcase, MapPin, BarChart3, ArrowRight,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import EmptyState from '../ui/EmptyState';
import DEIAnalyticsSection from '../DEIAnalyticsSection';
import { PIPELINE_COLORS } from './constants';
import KpiCard from './KpiCard';
import { buildAtsHref } from '../../utils/atsLinks';
import { guardTableCopy } from '../../utils/tableCopyGuard';
import { useAuth } from '../../context/AuthContext';
import { canUseFeature } from '../../config/planFeatures';

function formatTimeToHire(days) {
  if (days == null || Number.isNaN(Number(days))) return '—';
  const value = Number(days);
  if (value < 1) return 'Same day';
  return `${value} days`;
}

export default function AnalyticsLivePanel({
  stats,
  navigate,
  isFreelancer = false,
  userId = '',
  periodLabel = 'This Month',
  dateRange = 'month',
  customFrom = '',
  customTo = '',
  onTableDragScrollStart,
  onTableDragScrollMove,
  onTableDragScrollEnd,
}) {
  const { organization, user } = useAuth();
  const showDei = canUseFeature(organization?.plan, 'analytics.dei', {
    internalPreviewAccess: Boolean(user?.internalPreviewAccess),
  });
  const atsView = stats.atsView || (userId || stats.scope === 'employee' ? 'mine' : 'all');
  const employeeId = userId || stats.scopedUserId || '';
  const period = stats.dateRange || dateRange || 'month';
  const from = stats.customFrom || customFrom || '';
  const to = stats.customTo || customTo || '';
  const hintLabel = stats.periodLabel || periodLabel;
  const analysis = stats.analysis || {};
  const funnel = Array.isArray(analysis.funnel) ? analysis.funnel : [];
  const sources = Array.isArray(analysis.sources) ? analysis.sources : [];
  const positions = Array.isArray(analysis.positions) ? analysis.positions : [];
  const aging = Array.isArray(analysis.aging) ? analysis.aging : [];
  const velocity = Array.isArray(analysis.velocity) ? analysis.velocity : [];
  const intake = Number(analysis.intake ?? stats.totalCandidates) || 0;
  const agingTotal = aging.reduce((sum, row) => sum + (row.count || 0), 0);

  const goAts = (extra = {}) => navigate(buildAtsHref({
    view: atsView,
    employeeId: employeeId || undefined,
    period,
    from: period === 'custom' ? from : undefined,
    to: period === 'custom' ? to : undefined,
    ...extra,
  }));

  return (
    <div className="space-y-6">
      <div data-tour="analytics-kpis" className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-stone-500 mb-3">
          Hiring performance · {hintLabel}
        </p>
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 min-w-0 items-stretch">
          <KpiCard
            icon={Users}
            label="Candidates added"
            value={intake}
            caption="People whose record date is in this period"
            gradient="from-brand-500 to-teal-400"
            onClick={() => goAts()}
          />
          <KpiCard
            icon={Target}
            label="Hired or joined"
            value={Number(analysis.hired) || 0}
            caption="Of those people, now in Hired or Joined"
            gradient="from-emerald-500 to-lime-400"
            onClick={() => goAts()}
          />
          <KpiCard
            icon={Timer}
            label="Time to hire"
            value={formatTimeToHire(analysis.timeToHireDays)}
            caption={analysis.timeToHireSamples
              ? `Average of ${Number(analysis.timeToHireSamples).toLocaleString()} hires with a hire date`
              : 'Shown when a hire date is stored'}
            gradient="from-violet-500 to-fuchsia-400"
          />
          <KpiCard
            icon={UserX}
            label="Rejected or dropped"
            value={Number(analysis.rejected) || 0}
            caption="Of those people, now in Rejected or Dropped"
            gradient="from-rose-500 to-orange-400"
            onClick={() => goAts()}
          />
        </div>
      </div>

      <div data-tour="analytics-charts" className="grid grid-cols-1 xl:grid-cols-5 gap-4 sm:gap-6">
        <div className="xl:col-span-3 card-ats-bordered p-4 sm:p-6 relative overflow-hidden min-w-0">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <h3 className="text-sm font-bold text-stone-900">Hiring funnel</h3>
          <p className="text-xs text-stone-500 mt-0.5 mb-4 break-words">
            Where the {intake.toLocaleString()} people added in {hintLabel} sit today. The count is the number of people. The percentage is their share of that group.
          </p>
          {funnel.some((row) => row.count > 0) ? (
            <div className="space-y-3">
              {funnel.map((row) => {
                const color = PIPELINE_COLORS[row.stage] || '#78716c';
                return (
                  <button
                    key={row.stage}
                    type="button"
                    onClick={() => goAts({ status: String(row.stage).toUpperCase(), list: 'added' })}
                    className="w-full text-left rounded-lg px-1 py-1 hover:bg-stone-50"
                  >
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <span className="text-xs font-medium text-stone-700 truncate">{row.stage}</span>
                      <span className="text-xs font-bold text-stone-900 tabular-nums flex-shrink-0">
                        {row.count.toLocaleString()} · {row.share}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
                      <div
                        className="h-2 rounded-full"
                        style={{ width: `${row.count > 0 ? Math.max(row.share, 2) : 0}%`, backgroundColor: color }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={BarChart3} tone="violet" compact message="No candidates in this period" subMessage="Choose another period to see the funnel." />
          )}
        </div>

        <div className="xl:col-span-2 card-ats-bordered p-4 sm:p-6 relative overflow-hidden min-w-0 bg-gradient-to-b from-white to-violet-50/40">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 to-fuchsia-400" />
          <h3 className="text-sm font-bold text-stone-900">Stage duration</h3>
          <p className="text-xs text-stone-500 mt-0.5 mb-4 break-words">
            Average days a person stayed in a stage before the next recorded move. People still sitting in a stage are not included.
          </p>
          {velocity.length > 0 ? (
            <div className="space-y-3">
              {velocity.map((row) => {
                const maxDays = Math.max(...velocity.map((item) => Number(item.avgDays) || 0), 1);
                const width = Math.max(8, Math.round(((Number(row.avgDays) || 0) / maxDays) * 100));
                return (
                  <div key={row.stage} className="rounded-2xl border border-violet-100 bg-white px-3.5 py-3 shadow-sm shadow-violet-100/60 min-w-0">
                    <div className="flex items-start justify-between gap-3 min-w-0">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-stone-900 break-words">{row.stage}</p>
                        <p className="text-[11px] text-stone-500 mt-0.5">{Number(row.samples).toLocaleString()} completed moves</p>
                      </div>
                      <p className="text-lg font-bold text-violet-800 tabular-nums flex-shrink-0">{formatTimeToHire(row.avgDays)}</p>
                    </div>
                    <div className="mt-2.5 h-1.5 rounded-full bg-violet-50 overflow-hidden">
                      <div className="h-1.5 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={Timer} tone="violet" compact message="No completed stage moves yet" subMessage="Stage duration appears after a candidate moves to the next stage." />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="card-ats-bordered p-4 sm:p-6 relative overflow-hidden min-w-0">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 to-orange-400" />
          <h3 className="text-sm font-bold text-stone-900">Open candidate aging</h3>
          <p className="text-xs text-stone-500 mt-0.5 mb-4 break-words">How long people have remained in their current open stage. Hired, joined, rejected, and dropped are excluded. This is as of today, not the selected period.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {aging.map((row) => (
              <div key={row.label} className="rounded-xl bg-stone-50 border border-stone-100 px-3 py-3 text-center">
                <p className="text-xl font-bold text-stone-900 tabular-nums">{row.count.toLocaleString()}</p>
                <p className="text-[11px] font-semibold text-stone-500 mt-1">{row.label}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-stone-400 mt-3">{agingTotal.toLocaleString()} open candidates with a stage date</p>
        </div>

        <div className="card-ats-bordered p-4 sm:p-6 relative overflow-hidden min-w-0">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 to-teal-400" />
          <h3 className="text-sm font-bold text-stone-900">Candidates added over time</h3>
          <p className="text-xs text-stone-500 mt-0.5 mb-4 break-words">{stats.chartLabel || hintLabel}{stats.chartDays ? ` · ${stats.chartDays} days` : ''}</p>
          {stats.dailySubmissions?.some((row) => row.count > 0) ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={stats.dailySubmissions} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="intakeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#78716c' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#78716c' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e7e5e4', fontSize: 12 }} />
                <Area type="monotone" dataKey="count" stroke="#0f766e" strokeWidth={2.5} fill="url(#intakeFill)" name="Added" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={BarChart3} tone="brand" compact message="No intake in this window" />
          )}
        </div>
      </div>

      <div data-tour="analytics-activity" className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <QualityTable
          title="Source performance"
          hint={`People added in ${hintLabel} who have a source, and how many are hired or joined now.`}
          nameLabel="Source"
          rows={sources}
          nameKey="source"
          empty="No source data for this period"
          onOpen={(name) => goAts({ q: name })}
          onTableDragScrollStart={onTableDragScrollStart}
          onTableDragScrollMove={onTableDragScrollMove}
          onTableDragScrollEnd={onTableDragScrollEnd}
        />
        <QualityTable
          title="Role performance"
          hint={`People added in ${hintLabel} who have a role, and how many are hired or joined now.`}
          nameLabel="Role"
          rows={positions}
          nameKey="position"
          empty="No role data for this period"
          onOpen={(name) => goAts({ q: name })}
          onTableDragScrollStart={onTableDragScrollStart}
          onTableDragScrollMove={onTableDragScrollMove}
          onTableDragScrollEnd={onTableDragScrollEnd}
        />
      </div>

      <div className="card-ats-bordered p-4 sm:p-6 relative overflow-hidden min-w-0">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 to-fuchsia-400" />
        <div className="flex items-center gap-2 mb-4">
          <MapPin size={16} className="text-violet-600" />
          <div>
            <h3 className="text-sm font-bold text-stone-900">Locations</h3>
            <p className="text-xs text-stone-500">{hintLabel}</p>
          </div>
        </div>
        {stats.locationBreakdown?.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {stats.locationBreakdown.map((loc) => (
              <button
                key={loc.location}
                type="button"
                onClick={() => goAts({ q: loc.location })}
                className="flex items-center justify-between gap-3 rounded-xl border border-stone-100 px-3 py-2.5 text-left hover:bg-violet-50/50"
              >
                <span className="text-sm font-medium text-stone-800 truncate">{loc.location}</span>
                <span className="text-xs font-bold text-stone-600 tabular-nums">{loc.count}</span>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState icon={MapPin} tone="sky" compact message="No location data" />
        )}
      </div>

      {!isFreelancer && showDei ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-stone-900">Diversity & inclusion</h3>
              <p className="text-xs text-stone-500">Aggregate opt-in demographics. No individual rows.</p>
            </div>
            <button type="button" onClick={() => navigate('/analytics?tab=export')} className="text-xs font-semibold text-brand-700 inline-flex items-center gap-1">
              Export <ArrowRight size={12} />
            </button>
          </div>
          <DEIAnalyticsSection userId={userId} />
        </div>
      ) : null}
    </div>
  );
}

function QualityTable({
  title,
  hint,
  nameLabel,
  rows,
  nameKey,
  empty,
  onOpen,
  onTableDragScrollStart,
  onTableDragScrollMove,
  onTableDragScrollEnd,
}) {
  const scrollRef = useRef(null);
  return (
    <div className="card-ats-bordered relative min-w-0 overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-lime-400" />
      <div className="p-4 sm:p-6 pb-3">
        <div className="flex items-center gap-2 mb-1 min-w-0">
          <Briefcase size={16} className="text-emerald-600 flex-shrink-0" />
          <h3 className="text-sm font-bold text-stone-900 break-words">{title}</h3>
        </div>
        <p className="text-xs text-stone-500 break-words">{hint}</p>
      </div>
      {rows.length > 0 ? (
        <div
          ref={scrollRef}
          className="overflow-x-auto select-none px-2 sm:px-4 pb-4 cursor-grab"
          onCopy={guardTableCopy}
          onMouseDown={onTableDragScrollStart?.(scrollRef)}
          onMouseMove={onTableDragScrollMove}
          onMouseUp={onTableDragScrollEnd}
          onMouseLeave={onTableDragScrollEnd}
        >
          <table className="cand-table-drag w-full min-w-[680px] text-sm">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wide text-stone-500 border-b border-stone-200">
                <th className="text-left py-2.5 px-3 whitespace-nowrap">{nameLabel}</th>
                <th className="text-right py-2.5 px-3 whitespace-nowrap">Candidates added</th>
                <th className="text-right py-2.5 px-3 whitespace-nowrap">Hired or joined</th>
                <th className="text-right py-2.5 px-3 whitespace-nowrap">Hire rate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row[nameKey]} className="border-b border-stone-100 last:border-0">
                  <td className="py-3 px-3 min-w-[180px]">
                    <button type="button" onClick={() => onOpen(row[nameKey])} className="text-left font-medium text-stone-800 hover:text-brand-700 break-words">
                      {row[nameKey]}
                    </button>
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-stone-700 whitespace-nowrap">{Number(row.total).toLocaleString()}</td>
                  <td className="py-3 px-3 text-right tabular-nums text-stone-700 whitespace-nowrap">{Number(row.hired).toLocaleString()}</td>
                  <td className="py-3 px-3 text-right tabular-nums font-semibold text-stone-900 whitespace-nowrap">{row.hireRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-4 sm:px-6 pb-6">
          <EmptyState icon={Briefcase} tone="emerald" compact message={empty} />
        </div>
      )}
    </div>
  );
}
