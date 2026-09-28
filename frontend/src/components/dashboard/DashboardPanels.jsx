import React from 'react';
import {
  Users, Briefcase, ArrowRight, UserPlus, FileText, Mail, Kanban,
  BarChart3, Building2, Radio, ChevronRight, GitBranch, CalendarPlus, Calendar, Loader2,
} from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import { StatCard, QuickAction } from './DashboardWidgets';
import { formatTimeAgo, pipelineColors, statusColor, displayStatus } from './dashboardConstants';
import { statusCardStyle, statusCardList } from './statusKpiMeta';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import PremiumSelect from '../ui/PremiumSelect';
import { buildAtsHref } from '../../utils/atsLinks';

function periodIntakeLabel(dateRange, periodLabel) {
  if (dateRange === 'month' || !dateRange) return 'New this month';
  if (dateRange === 'week' || dateRange === '7d') return 'New this week';
  if (dateRange === 'quarter') return 'New this quarter';
  if (dateRange === 'year') return 'New this year';
  if (dateRange === 'custom') return 'New in range';
  return periodLabel ? `New · ${periodLabel}` : 'New this month';
}

const DONUT_COLORS = [
  '#0ea5e9', '#14b8a6', '#f59e0b', '#8b5cf6', '#10b981',
  '#f43f5e', '#6366f1', '#84cc16', '#ec4899', '#64748b',
  '#06b6d4', '#a855f7',
];

function recentCohortMonths(count = 18) {
  const out = [];
  const now = new Date();
  for (let i = 0; i < count; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push({
      key,
      label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    });
  }
  return out;
}

function MetricSection({ title, timeLabel, hint, action, children }) {
  return (
    <section className="mb-8 min-w-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-3 min-w-0">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold tracking-tight text-stone-900 break-words">{title}</h2>
          <p className="text-xs text-stone-500 mt-0.5 break-words">
            <span className="font-semibold text-stone-700">{timeLabel}</span>
            {hint ? ` · ${hint}` : ''}
          </p>
        </div>
        {action ? <div className="w-full sm:w-64 flex-shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function PeriodPipelineMetrics({
  d,
  navigate,
  periodLabel,
  dateRange,
  customFrom = '',
  customTo = '',
  cohortMonth,
  onCohortMonth,
  cohortLoading = false,
}) {
  const metrics = d.metrics || {};
  const activity = metrics.activity || { stages: [], total: 0 };
  const cohort = metrics.cohort || { stages: [], size: 0, month: cohortMonth, label: '' };
  const stageRows = (cohort.stages || []).map((item) => ({
    stage: item.stage,
    count: Number(item.count ?? item.reached) || 0,
  }));
  const slices = stageRows.filter((item) => item.count > 0);
  const velocity = Array.isArray(metrics.velocity) ? metrics.velocity : [];
  const atsView = d.atsView || (d.scope === 'organization' ? 'all' : 'mine');
  const employeeId = d.scopedUserId || '';
  const activityLabel = dateRange === 'all'
    ? 'All recorded moves'
    : (periodLabel || 'This period');
  const openMoved = (stage) => navigate(buildAtsHref({
    view: atsView,
    employeeId: employeeId || undefined,
    status: String(stage).toUpperCase(),
    period: dateRange || 'month',
    from: dateRange === 'custom' ? customFrom : undefined,
    to: dateRange === 'custom' ? customTo : undefined,
    list: 'moved',
  }));
  const openCohort = (stage) => navigate(buildAtsHref({
    view: atsView,
    employeeId: employeeId || undefined,
    status: String(stage).toUpperCase(),
    list: 'cohort',
    cohort: cohort.month || cohortMonth,
  }));

  return (
    <div className="min-w-0 w-full">
      <MetricSection
        title="Movement"
        timeLabel={activityLabel}
        hint="Candidates who entered each stage in this period."
      >
        <div className="grid gap-4 sm:gap-5 min-w-0 w-full grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          <StatCard
              icon={CalendarPlus}
              label={periodIntakeLabel(dateRange, periodLabel)}
              value={Number(d.thisMonth ?? d.totalCandidates) || 0}
              caption="Record date in this period"
              gradient="from-indigo-500 to-sky-400"
              onClick={() => navigate(buildAtsHref({
                view: atsView,
                employeeId: employeeId || undefined,
                period: dateRange,
                from: dateRange === 'custom' ? customFrom : undefined,
                to: dateRange === 'custom' ? customTo : undefined,
              }))}
            />
          {(activity.stages || []).map((item, index) => {
            const style = statusCardStyle(item.stage, index);
            return (
              <StatCard
                key={`move-${item.stage}`}
                icon={style.icon}
                label={item.label || `Moved to ${item.stage}`}
                value={item.count || 0}
                caption="Entered this stage"
                gradient={style.gradient}
                onClick={() => openMoved(item.stage)}
              />
            );
          })}
        </div>
      </MetricSection>

      <MetricSection
        title="Monthly cohort"
        timeLabel={cohort.label || 'Select a month'}
        hint="Current stage of candidates whose record date is in the selected month."
        action={(
          <PremiumSelect
            compact
            searchable
            variant="list"
            icon={Calendar}
            placeholder="Month"
            searchPlaceholder="Find a month"
            loading={cohortLoading}
            value={cohort.month || cohortMonth || recentCohortMonths(1)[0].key}
            onChange={(month) => onCohortMonth?.(month)}
            options={recentCohortMonths(24).map((month) => ({ value: month.key, label: month.label }))}
          />
        )}
      >
        <div className="card-ats-bordered p-4 sm:p-6 relative min-w-0">
          {cohortLoading ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] bg-white/75">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700">
                <Loader2 size={16} className="animate-spin" />
                Loading
              </span>
            </div>
          ) : null}
          {cohort.size > 0 ? (
            <div className="grid grid-cols-1 xl:grid-cols-[240px_minmax(0,1fr)] gap-6 items-center min-w-0">
              <div className="relative h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={slices}
                      dataKey="count"
                      nameKey="stage"
                      innerRadius={72}
                      outerRadius={104}
                      paddingAngle={2}
                      stroke="#fff"
                      strokeWidth={2}
                      onClick={(entry) => openCohort(entry?.payload?.stage || entry?.stage || entry?.name)}
                      cursor="pointer"
                    >
                      {slices.map((slice, index) => (
                        <Cell key={slice.stage} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, _name, item) => [`${value} out of ${cohort.size}`, item?.payload?.stage || '']}
                      contentStyle={{ borderRadius: 12, border: '1px solid #e7e5e4', fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-2xl font-bold text-stone-900 tabular-nums">{Number(cohort.size).toLocaleString()}</p>
                  <p className="text-[11px] font-medium text-stone-500">records</p>
                </div>
              </div>
              <div className="min-w-0 flex flex-col gap-0.5">
                {stageRows.map((item) => {
                  const colorIndex = slices.findIndex((slice) => slice.stage === item.stage);
                  return (
                  <button
                    key={`cohort-${item.stage}`}
                    type="button"
                    onClick={() => openCohort(item.stage)}
                    className="w-full min-w-0 grid grid-cols-[0.625rem_minmax(0,1fr)_auto] items-start gap-x-2.5 rounded-xl px-2.5 py-1.5 text-left hover:bg-stone-50"
                  >
                    <span className="mt-1.5 w-2.5 h-2.5 rounded-full" style={{ background: colorIndex >= 0 ? DONUT_COLORS[colorIndex % DONUT_COLORS.length] : '#d6d3d1' }} />
                    <span className="text-sm font-medium text-stone-800 whitespace-normal break-words">{item.stage}</span>
                    <span className="text-sm font-semibold tabular-nums text-stone-900 whitespace-nowrap">{item.count} out of {cohort.size}</span>
                  </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-stone-500">No records in this month.</p>
          )}
          {velocity.length > 0 && (
            <div className="mt-5 pt-4 border-t border-stone-100">
              <p className="text-xs font-semibold text-stone-700 mb-2">Average days in stage</p>
              <div className="flex flex-wrap gap-2">
                {velocity.map((item) => (
                  <span key={item.stage} className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-stone-50 border border-stone-200 px-2.5 py-1 text-xs text-stone-700">
                    <span className="font-semibold break-words">{item.stage}</span>
                    <span className="tabular-nums">{item.avgDays}d</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </MetricSection>
    </div>
  );
}

function EnterpriseDashboardMetrics(props) {
  const { d, navigate } = props;
  const snapshot = d.metrics?.snapshot || { stages: [], total: 0 };
  const atsView = d.atsView || (d.scope === 'organization' ? 'all' : 'mine');
  const employeeId = d.scopedUserId || '';
  const openStage = (stage) => navigate(buildAtsHref({
    view: atsView,
    employeeId: employeeId || undefined,
    status: String(stage).toUpperCase(),
    period: 'all',
  }));

  return (
    <div data-tour="dash-kpis" className="min-w-0 w-full mb-8 sm:mb-10">
      <MetricSection
        title="Current pipeline"
        timeLabel="As of today"
        hint="Candidates in each stage right now."
      >
        <div className="grid gap-4 sm:gap-5 min-w-0 w-full grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          <StatCard
            icon={Users}
            label="All candidates"
            value={Number(snapshot.total) || 0}
            caption="All stages"
            gradient="from-brand-500 to-teal-400"
            onClick={() => navigate(buildAtsHref({
              view: atsView,
              employeeId: employeeId || undefined,
              period: 'all',
            }))}
          />
          {(snapshot.stages || []).map((item, index) => {
            const style = statusCardStyle(item.stage, index);
            return (
              <StatCard
                key={`now-${item.stage}`}
                icon={style.icon}
                label={item.stage}
                value={item.count || 0}
                caption="Current stage"
                gradient={style.gradient}
                onClick={() => openStage(item.stage)}
              />
            );
          })}
        </div>
      </MetricSection>
      <PeriodPipelineMetrics {...props} />
    </div>
  );
}

export function DashboardKpis({
  d,
  navigate,
  isFreelancer,
  periodLabel,
  dateRange,
  customFrom = '',
  customTo = '',
  dataFresh = true,
  cohortMonth = '',
  onCohortMonth,
  cohortLoading = false,
}) {
  if (!isFreelancer && d.metrics?.snapshot) {
    return (
      <EnterpriseDashboardMetrics
        d={d}
        navigate={navigate}
        periodLabel={periodLabel}
        dateRange={dateRange}
        customFrom={customFrom}
        customTo={customTo}
        cohortMonth={cohortMonth}
        onCohortMonth={onCohortMonth}
        cohortLoading={cohortLoading}
      />
    );
  }

  const label = periodLabel || 'This Month';
  const statusCards = statusCardList(d);
  const atsView = d.atsView || (d.scope === 'organization' ? 'all' : 'mine');
  const employeeId = d.scopedUserId || '';
  const periodHref = {
    period: dateRange,
    from: dateRange === 'custom' ? customFrom : undefined,
    to: dateRange === 'custom' ? customTo : undefined,
  };
  const goAts = (extra = {}) => navigate(buildAtsHref({
    view: atsView,
    employeeId: employeeId || undefined,
    ...periodHref,
    ...extra,
  }));

  const allTimeTotal = Number(d.totalCandidatesAllTime ?? d.totalCandidates) || 0;
  const periodTotal = Number(d.totalCandidates ?? d.thisMonth) || 0;
  const showPeriodCard = dateRange !== 'all';

  return (
    <div data-tour="dash-kpis" className="min-w-0 w-full mb-8 sm:mb-10">
      <div className="grid gap-4 sm:gap-5 min-w-0 w-full grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
      <StatCard
        icon={Users}
        label="All candidates"
        value={allTimeTotal}
        caption={dataFresh ? 'Complete ATS inventory' : null}
        gradient="from-brand-500 to-teal-400"
        loading={false}
        onClick={() => goAts({ period: 'all' })}
      />
      {showPeriodCard ? (
        <StatCard
          icon={CalendarPlus}
          label={periodIntakeLabel(dateRange, label)}
          value={periodTotal}
          caption={dataFresh ? 'Intake across all stages' : null}
          gradient="from-indigo-500 to-sky-400"
          loading={false}
          onClick={() => goAts({})}
        />
      ) : null}
      {statusCards.map((item, index) => {
        const style = statusCardStyle(item.stage, index);
        return (
          <StatCard
            key={item.stage}
            icon={style.icon}
            label={item.stage}
            value={item.count || 0}
            caption={
            dataFresh
              ? (dateRange === 'all' ? 'Currently in this stage' : (
                dateRange === 'month' || !dateRange
                  ? 'Entered this stage this month'
                  : 'Entered this stage in selected period'
              ))
              : null
          }
            gradient={style.gradient}
            loading={false}
            onClick={() => goAts({ status: String(item.stage).toUpperCase() })}
          />
        );
      })}
      </div>
    </div>
  );
}

export function DashboardMainGrid({ d, navigate, isFreelancer }) {
  const employeeId = d.scopedUserId || '';
  const atsView = d.atsView || (d.scope === 'organization' ? 'all' : 'mine');
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-w-0">
      <div data-tour="dash-recent" className="lg:col-span-2 card-ats-bordered p-5 sm:p-6 relative overflow-x-hidden min-w-0 group/card">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 opacity-80" />
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-stone-900 tracking-tight">Recent Candidates</h2>
          <button
            type="button"
            onClick={() => navigate(buildAtsHref({ view: atsView, employeeId: employeeId || undefined }))}
            className="text-brand-600 hover:text-brand-700 text-sm font-semibold flex items-center gap-1 transition-all hover:gap-1.5"
          >
            View All <ArrowRight size={14} />
          </button>
        </div>
        {(d.recentCandidates || []).length > 0 ? (
          <div className="space-y-0.5">
            {d.recentCandidates.map((c, i) => (
              <button
                key={c.id || i}
                type="button"
                onClick={() => navigate(buildAtsHref({
                  view: atsView,
                  employeeId: employeeId || undefined,
                  q: c.name || undefined,
                }))}
                className="list-row-ats flex-wrap justify-between w-full min-w-0 text-left transition-all duration-200 hover:bg-brand-50/50 hover:pl-4 group/row"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-teal-100 text-brand-700 flex items-center justify-center text-xs font-bold flex-shrink-0 ring-1 ring-brand-200/60 transition-transform duration-300 group-hover/row:scale-105">
                    {(c.name || 'N')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-stone-900 break-words whitespace-normal group-hover/row:text-brand-700 transition-colors">{c.name}</p>
                    <p className="text-xs text-stone-500 break-words whitespace-normal">
                      {c.position || 'Position not set'}{c.source ? ` · ${c.source}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-auto">
                  <span className={`${statusColor(c.status)} whitespace-normal text-center`}>{displayStatus(c.status)}</span>
                  <span className="text-xs text-stone-400 hidden sm:inline whitespace-nowrap">{formatTimeAgo(c.createdAt)}</span>
                  <ChevronRight size={14} className="text-stone-300 opacity-0 group-hover/row:opacity-100 transition-opacity" />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Users}
            tone="brand"
            message="No candidates yet"
            subMessage="Add your first candidate to get started."
            action={
              <button type="button" onClick={() => navigate('/ats?add=1')} className="btn-primary">
                <UserPlus size={16} /> Add Candidate
              </button>
            }
          />
        )}
      </div>

      <div data-tour="dash-actions" className="card-ats-bordered p-5 sm:p-6 relative overflow-x-hidden min-w-0">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <h2 className="text-base font-bold text-stone-900 tracking-tight mb-4">Quick Actions</h2>
        <div className="space-y-2">
          <QuickAction icon={UserPlus} label="Add Candidate" desc="Create a new profile" onClick={() => navigate('/ats?add=1')} tone="bg-brand-50 text-brand-600" />
          <QuickAction
            icon={Users}
            label={isFreelancer ? 'My Candidates' : 'Candidates'}
            desc="Open the ATS directory"
            onClick={() => navigate(buildAtsHref({ view: atsView, employeeId: employeeId || undefined }))}
            tone="bg-sky-50 text-sky-600"
          />
          {isFreelancer ? (
            <QuickAction icon={Briefcase} label="Open Mandates" desc="Jobs you can submit against" onClick={() => navigate('/mandates')} tone="bg-indigo-50 text-indigo-600" />
          ) : (
            <>
              <QuickAction icon={Kanban} label="Pipeline Board" desc="Manage stages and applications" onClick={() => navigate('/recruitment')} tone="bg-violet-50 text-violet-600" />
              <QuickAction icon={FileText} label="Resume Parsing" desc="Upload and parse resumes" onClick={() => navigate('/resume-parsing')} tone="bg-amber-50 text-amber-600" />
              <QuickAction icon={Mail} label="Email Templates" desc="Manage outreach templates" onClick={() => navigate('/email-templates')} tone="bg-emerald-50 text-emerald-600" />
              <QuickAction icon={BarChart3} label="Analytics" desc="Reports & insights" onClick={() => navigate(employeeId ? `/analytics?employee=${encodeURIComponent(employeeId)}` : '/analytics')} tone="bg-fuchsia-50 text-fuchsia-600" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function DashboardLowerGrid({ d, navigate, isFreelancer }) {
  const maxPipeline = Math.max(...(d.pipeline || []).map((p) => p.count), 1);
  const employeeId = d.scopedUserId || '';
  const atsView = d.atsView || (d.scope === 'organization' ? 'all' : 'mine');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
      <div data-tour="dash-pipeline" className="card-ats-bordered p-5 sm:p-6 relative overflow-x-hidden min-w-0">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-stone-900 tracking-tight">Current pipeline</h2>
            <p className="text-xs text-stone-500 mt-0.5">Stage distribution as of today</p>
          </div>
          <button
            type="button"
            onClick={() => navigate(isFreelancer ? '/ats' : '/recruitment')}
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 transition-all hover:gap-1.5"
          >
            Open {isFreelancer ? 'ATS' : 'board'} <ArrowRight size={12} />
          </button>
        </div>
        {(d.pipeline || []).length > 0 ? (
          <div className="space-y-3.5">
            {(d.pipeline || []).map((item) => (
              <button
                key={item.stage}
                type="button"
                onClick={() => navigate(buildAtsHref({
                  view: atsView,
                  status: String(item.stage).toUpperCase(),
                  employeeId: employeeId || undefined,
                  period: 'all',
                }))}
                className="w-full text-left group/pipe rounded-lg p-1.5 -mx-1.5 transition-colors hover:bg-stone-50"
              >
                <div className="flex items-start justify-between gap-3 mb-1.5 min-w-0">
                  <span className="text-sm font-medium text-stone-700 group-hover/pipe:text-stone-900 break-words whitespace-normal min-w-0">{item.stage}</span>
                  <span className="text-sm font-bold text-stone-900 tabular-nums flex items-center gap-1 flex-shrink-0">
                    {item.count}
                    <ChevronRight size={12} className="text-stone-300 opacity-0 group-hover/pipe:opacity-100 transition-opacity" />
                  </span>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`${pipelineColors[item.stage] || 'bg-brand-500'} h-2.5 rounded-full transition-all duration-700 ease-out group-hover/pipe:brightness-110`}
                    style={{ width: `${Math.max((item.count / maxPipeline) * 100, 2)}%` }}
                  />
                </div>
              </button>
            ))}
            {d.pipeline.every((p) => p.count === 0) && (
              <EmptyState
                icon={GitBranch}
                tone="violet"
                compact
                message="No pipeline data yet"
                subMessage="Candidates will appear here as they move through hiring stages."
                action={
                  <button type="button" onClick={() => navigate('/ats?add=1')} className="btn-secondary !text-xs">
                    <UserPlus size={14} /> Add Candidate
                  </button>
                }
              />
            )}
          </div>
        ) : (
          <EmptyState
            icon={Kanban}
            tone="violet"
            compact
            message="No pipeline data yet"
            subMessage="Add candidates to populate your hiring stages."
            action={
              <button type="button" onClick={() => navigate(isFreelancer ? '/ats?add=1' : '/recruitment')} className="btn-secondary !text-xs">
                {isFreelancer ? 'Add Candidate' : 'Open Pipeline Board'}
              </button>
            }
          />
        )}
      </div>

      <div className="space-y-6">
        <div className="card-ats-bordered p-5 sm:p-6 relative overflow-x-hidden min-w-0">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 to-fuchsia-400" />
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-stone-900 tracking-tight flex items-center gap-2">
              <Briefcase size={16} className="text-violet-500" /> Top Positions
            </h2>
            <button
              type="button"
              onClick={() => navigate(buildAtsHref({ view: atsView, employeeId: employeeId || undefined }))}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 transition-all hover:gap-1.5"
            >
              View candidates <ArrowRight size={12} />
            </button>
          </div>
          {(d.topPositions || []).length > 0 ? (
            <div className="space-y-0.5">
              {d.topPositions.map((item, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => navigate(buildAtsHref({
                    view: atsView,
                    employeeId: employeeId || undefined,
                    q: item.position || undefined,
                  }))}
                  className="list-row-ats flex-wrap justify-between w-full min-w-0 text-left group/pos hover:bg-violet-50/50 transition-all duration-200"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="w-6 h-6 bg-violet-50 text-violet-700 border border-violet-200/70 rounded-md text-[11px] font-bold flex items-center justify-center flex-shrink-0 transition-transform group-hover/pos:scale-110">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-stone-800 break-words whitespace-normal">{item.position}</span>
                  </div>
                  <span className="badge-neutral">{item.count}</span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Briefcase}
              tone="violet"
              compact
              message="No positions to display"
              subMessage="Add job positions to track hiring by role."
              action={
                <button type="button" onClick={() => navigate(buildAtsHref({ view: atsView, employeeId: employeeId || undefined }))} className="btn-secondary !text-xs">
                  <Building2 size={14} /> Open Candidates
                </button>
              }
            />
          )}
        </div>

        <div className="card-ats-bordered p-5 sm:p-6 relative overflow-x-hidden min-w-0">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-lime-400" />
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-stone-900 tracking-tight flex items-center gap-2">
              <Radio size={16} className="text-emerald-500" /> Top Sources
            </h2>
            <button
              type="button"
              onClick={() => navigate(buildAtsHref({ view: atsView, employeeId: employeeId || undefined }))}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 transition-all hover:gap-1.5"
            >
              View candidates <ArrowRight size={12} />
            </button>
          </div>
          {(d.topSources || []).length > 0 ? (
            <div className="space-y-0.5">
              {d.topSources.map((item, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => navigate(buildAtsHref({
                    view: atsView,
                    employeeId: employeeId || undefined,
                    q: item.source || undefined,
                  }))}
                  className="list-row-ats flex-wrap justify-between w-full min-w-0 text-left group/src hover:bg-emerald-50/50 transition-all duration-200"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="w-6 h-6 bg-emerald-50 text-emerald-700 border border-emerald-200/70 rounded-md text-[11px] font-bold flex items-center justify-center flex-shrink-0 transition-transform group-hover/src:scale-110">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-stone-800 break-words whitespace-normal">{item.source}</span>
                  </div>
                  <span className="badge-neutral">{item.count}</span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Radio}
              tone="emerald"
              compact
              message="No sources to display"
              subMessage="Candidate sources will appear once assigned."
              action={
                <button type="button" onClick={() => navigate(buildAtsHref({ view: atsView, employeeId: employeeId || undefined }))} className="btn-secondary !text-xs">
                  Open Candidates
                </button>
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
