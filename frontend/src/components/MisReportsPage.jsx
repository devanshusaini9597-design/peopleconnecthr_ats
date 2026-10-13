import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  FileBarChart, RefreshCw, Inbox, Building2, UserRound, MailWarning, Phone,
  TrendingUp, ShieldAlert, Users, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import {
  Bar, ComposedChart, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell,
} from 'recharts';
import { authenticatedFetch } from '../utils/fetchUtils';
import { useToast } from './Toast';
import { useAuth } from '../context/AuthContext';
import PageHeader from './ui/PageHeader';
import AnalyticsPeriodSelect from './analytics/AnalyticsPeriodSelect';
import EmployeeScopeSelect from './analytics/EmployeeScopeSelect';
import useEmployeeAnalyticsScope from '../hooks/useEmployeeAnalyticsScope';
import { StatCard } from './dashboard/DashboardWidgets';
import { CategoryBarChart } from './analytics/AnalyticsCharts';
import { DATE_RANGE_LABELS, PIE_COLORS } from './analytics/constants';
import { CHART_TOOLTIP_STYLE, CHART_GRID_STROKE } from './analytics/chartUtils';
import { canAccessMis, canViewMisOrgReports } from '../utils/misAccess';
import { useTableDragScroll } from './ats/hooks/useTableDragScroll';

const RISK_TONE = {
  ok: 'border-emerald-200 bg-emerald-50/80 text-emerald-800',
  watch: 'border-amber-200 bg-amber-50/80 text-amber-900',
  high: 'border-rose-200 bg-rose-50/80 text-rose-900',
};
const HOUR_MS = 60 * 60 * 1000;

function outOf(part, whole) {
  const a = Number(part) || 0;
  const b = Number(whole) || 0;
  return `${a.toLocaleString()} of ${b.toLocaleString()}`;
}

/** Horizontal drag-scroll for wide report tables (same pattern as Candidates). */
function DragPane({ className = '', children }) {
  const {
    tableScrollRef,
    onTableDragScrollStart,
    onTableDragScrollMove,
    onTableDragScrollEnd,
  } = useTableDragScroll();
  return (
    <div
      ref={tableScrollRef}
      className={`cand-table-scroll overflow-x-auto overscroll-x-contain select-none min-w-0 max-sm:[-ms-overflow-style:none] max-sm:[scrollbar-width:none] max-sm:[&::-webkit-scrollbar]:hidden ${className}`}
      onPointerDown={onTableDragScrollStart}
      onPointerMove={onTableDragScrollMove}
      onPointerUp={onTableDragScrollEnd}
      onPointerCancel={onTableDragScrollEnd}
    >
      {children}
    </div>
  );
}

function formatLabel(status) {
  const raw = String(status || '').trim();
  if (!raw) return '—';
  if (raw === raw.toUpperCase() && raw.includes(' ')) {
    return raw.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
  if (raw === raw.toUpperCase()) return raw.charAt(0) + raw.slice(1).toLowerCase();
  return raw;
}

function MetricSection({ title, timeLabel, hint, children }) {
  return (
    <section className="mb-8 min-w-0 w-full overflow-x-hidden">
      <div className="mb-3 min-w-0">
        <h2 className="text-sm font-bold tracking-tight text-stone-900">{title}</h2>
        <p className="text-xs text-stone-500 mt-0.5 break-words">
          {timeLabel ? <span className="font-semibold text-stone-700">{timeLabel}</span> : null}
          {timeLabel && hint ? ' · ' : null}
          {hint || null}
        </p>
      </div>
      {children}
    </section>
  );
}

function formatTrendTick(dateStr, label) {
  if (label) return label;
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(dateStr).slice(5);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function RiskBadge({ level }) {
  const tone = RISK_TONE[level] || RISK_TONE.ok;
  const Icon = level === 'high' ? ShieldAlert : level === 'watch' ? AlertTriangle : CheckCircle2;
  const text = level === 'high' ? 'Needs attention' : level === 'watch' ? 'Needs review' : 'In order';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
      <Icon size={12} />
      {text}
    </span>
  );
}

function ReportTable({ columns, rows, emptyLabel = 'No rows for this period.' }) {
  if (!rows.length) {
    return (
      <div className="px-4 py-10 text-center text-sm text-stone-500">{emptyLabel}</div>
    );
  }
  return (
    <DragPane>
      <table className="cand-table-drag w-max min-w-full text-left border-collapse select-none border border-stone-200">
        <thead>
          <tr className="bg-stone-100">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={`px-3.5 py-3 text-[11px] font-semibold uppercase tracking-wider text-stone-500 border border-stone-200 whitespace-nowrap ${
                  col.align === 'right' ? 'text-right' : 'text-left'
                }`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-stone-100 bg-white hover:bg-stone-50/80">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-3.5 py-2.5 text-sm border border-stone-100 ${
                    col.align === 'right' ? 'text-right tabular-nums' : 'text-left'
                  } ${col.className || 'text-stone-800'}`}
                >
                  {typeof col.render === 'function' ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </DragPane>
  );
}

/**
 * MIS Reports — role-scoped metrics matching Analytics page layout.
 */
export default function MisReportsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const isAllowed = canAccessMis(user);
  const canSelectEmployee = canViewMisOrgReports(user);
  const employeeScope = useEmployeeAnalyticsScope({ enabled: canSelectEmployee });

  const [dateRange, setDateRange] = useState('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [report, setReport] = useState(null);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [qualityKind, setQualityKind] = useState('');
  const [qualityDetail, setQualityDetail] = useState(null);
  const [qualityLoading, setQualityLoading] = useState(false);
  const requestSeq = React.useRef(0);
  const qualitySeq = React.useRef(0);

  const scopedUserId = canSelectEmployee ? employeeScope.userId : '';
  const isEmployeeScope = report?.scope === 'employee';
  const isOrgScope = report?.scope === 'organisation';
  const isDeskScope = report?.scope === 'desk'
    || report?.scope === 'self'
    || (!report && !canSelectEmployee);
  const isSelfScope = report?.scope === 'self';

  const scopeSubtitle = isOrgScope
    ? 'Organisation MIS performance for the selected period.'
    : isEmployeeScope
      ? `MIS activity for ${report?.meta?.scopedUserName || employeeScope.selectedEmployee?.name || 'the selected employee'}.`
      : 'Organisation directory and your records for the selected period.';

  const periodLabel = report?.periodLabel
    || (dateRange === 'custom' && customFrom && customTo
      ? `${customFrom} → ${customTo}`
      : (DATE_RANGE_LABELS[dateRange] || 'This Month'));

  const load = useCallback(async (opts = {}) => {
    if (!isAllowed) return;
    if (dateRange === 'custom' && (!customFrom || !customTo || customFrom > customTo)) {
      return;
    }
    const silent = Boolean(opts.silent);
    const seq = ++requestSeq.current;
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
      // Keep previous report visible so the page does not flash empty while reloading
    }
    try {
      const params = new URLSearchParams({ dateRange });
      if (dateRange === 'custom') {
        params.set('from', customFrom);
        params.set('to', customTo);
      }
      if (canSelectEmployee && scopedUserId) {
        params.set('userId', scopedUserId);
      }
      params.set('_', String(Date.now()));
      const res = await authenticatedFetch(`/api/mis/reports?${params}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      const data = await res.json().catch(() => ({}));
      if (seq !== requestSeq.current) return;
      if (!res.ok) throw new Error(data.message || 'Failed to load MIS reports');
      setReport(data);
      setLastSyncedAt(data.generatedAt ? new Date(data.generatedAt) : new Date());
    } catch (err) {
      if (seq !== requestSeq.current) return;
      if (!silent) toast.error(err.message || 'Failed to load MIS reports');
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [isAllowed, dateRange, customFrom, customTo, canSelectEmployee, scopedUserId, toast]);

  const loadQuality = useCallback(async (kind) => {
    if (!kind || !canSelectEmployee) {
      setQualityDetail(null);
      return;
    }
    const seq = ++qualitySeq.current;
    setQualityLoading(true);
    try {
      const params = new URLSearchParams({ kind, dateRange });
      if (dateRange === 'custom') {
        params.set('from', customFrom);
        params.set('to', customTo);
      }
      if (scopedUserId) params.set('userId', scopedUserId);
      const res = await authenticatedFetch(`/api/mis/reports/quality?${params}`);
      const data = await res.json().catch(() => ({}));
      if (seq !== qualitySeq.current) return;
      if (!res.ok) throw new Error(data.message || 'Unable to load this review list');
      setQualityDetail(data);
    } catch (err) {
      if (seq !== qualitySeq.current) return;
      toast.error(err.message || 'Unable to load this review list');
      setQualityDetail({ rows: [], total: 0, label: '', kind });
    } finally {
      if (seq === qualitySeq.current) setQualityLoading(false);
    }
  }, [canSelectEmployee, dateRange, customFrom, customTo, scopedUserId, toast]);

  const openQuality = useCallback((kind) => {
    setQualityKind(kind);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (qualityKind) loadQuality(qualityKind);
  }, [qualityKind, loadQuality]);

  // Hourly auto-refresh + refresh when the tab regains focus
  useEffect(() => {
    if (!isAllowed) return undefined;
    const onFocus = () => { load({ silent: true }); };
    window.addEventListener('focus', onFocus);
    const id = window.setInterval(() => { load({ silent: true }); }, HOUR_MS);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.clearInterval(id);
    };
  }, [isAllowed, load]);

  const totals = report?.totals || {};
  const dup = report?.duplicacy || {};
  const quality = report?.quality || {};
  const integrity = report?.integrity || {};
  const showQuality = canSelectEmployee && !isSelfScope;
  const byStatus = Array.isArray(report?.byStatus) ? report.byStatus : [];
  const trend = Array.isArray(report?.trend) ? report.trend : [];
  const employeeMix = Array.isArray(report?.employeeMix) ? report.employeeMix : [];
  const byContributor = Array.isArray(report?.byContributor) ? report.byContributor : [];
  const showLoading = loading && !report;
  const riskLevel = integrity.riskLevel || 'ok';
  const granularity = report?.granularity === 'weekly' ? 'weekly' : 'daily';

  const statusChartData = useMemo(
    () => byStatus.map((row) => ({
      label: formatLabel(row.status),
      fullLabel: formatLabel(row.status),
      value: Number(row.count) || 0,
    })),
    [byStatus]
  );

  const trendChartData = useMemo(
    () => trend.map((row) => ({
      date: row.date,
      endDate: row.endDate,
      label: formatTrendTick(row.date, row.label),
      count: Number(row.count) || 0,
    })),
    [trend]
  );

  const employeeSlices = useMemo(
    () => (employeeMix.length
      ? employeeMix
      : byContributor.map((row) => ({ label: row.name, key: row.userId, count: row.added }))
    )
      .map((row) => ({
        name: row.label || row.name || 'Unknown',
        count: Number(row.count || row.added) || 0,
      }))
      .filter((row) => row.count > 0)
      .slice(0, 10),
    [employeeMix, byContributor]
  );

  const employeeTotal = employeeSlices.reduce((sum, row) => sum + row.count, 0);
  const periodTotal = Number(totals.inPeriod) || employeeTotal || 0;
  const allTimeTotal = Number(totals.allTime) || 0;
  const uploadedN = Number(totals.uploadedInPeriod ?? integrity.trulyNewInPeriod) || 0;
  const priorN = Number(totals.previousPeriod) || 0;
  const deltaCaption = priorN > 0
    ? `${Number(totals.inPeriod || 0).toLocaleString()} this period · ${priorN.toLocaleString()} prior period`
    : null;

  const statusTableRows = useMemo(
    () => byStatus.map((row, index) => ({
      id: String(row.status || index),
      status: formatLabel(row.status),
      count: Number(row.count) || 0,
      color: PIE_COLORS[index % PIE_COLORS.length],
    })),
    [byStatus]
  );

  const employeeTableRows = useMemo(
    () => employeeSlices.map((row, index) => ({
      id: row.name + index,
      name: row.name,
      count: row.count,
      color: PIE_COLORS[index % PIE_COLORS.length],
    })),
    [employeeSlices]
  );

  const teamTableRows = useMemo(
    () => byContributor.map((row) => ({
      id: row.userId,
      name: row.name,
      email: row.email || row.role || '',
      added: Number(row.added) || 0,
      conflicts: Number(row.recycledTrackerDates) || 0,
      risk: row.risk || 'ok',
      userId: row.userId,
    })),
    [byContributor]
  );

  if (user && !isAllowed) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="page-shell-ats animate-page-enter font-sans text-stone-900 overflow-x-hidden min-w-0" role="main" aria-label="MIS Reports">
      <PageHeader
        icon={FileBarChart}
        title="MIS Reports"
        subtitle={scopeSubtitle}
      >
        <button
          type="button"
          onClick={() => load()}
          disabled={loading || refreshing}
          className="btn-secondary"
        >
          <RefreshCw size={16} className={(loading || refreshing) ? 'animate-spin' : ''} />
          Refresh
        </button>
      </PageHeader>

      <p className="text-[12px] text-stone-400 -mt-2 mb-3">
        {loading || refreshing ? (
          <span className="text-brand-600 font-medium">Refreshing figures…</span>
        ) : lastSyncedAt ? (
          `Last updated ${lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        ) : (
          'Current figures'
        )}
        {' · Auto-refresh every hour'}
      </p>

      <section className="card-ats-bordered relative overflow-hidden mb-6 min-w-0" data-tour="mis-reports-filters">
        <div className="h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <div className="p-4 sm:p-5">
          <div className={`grid grid-cols-1 gap-5 min-w-0 ${canSelectEmployee ? 'xl:grid-cols-2' : ''}`}>
            {canSelectEmployee ? (
              <EmployeeScopeSelect
                value={employeeScope.employeeParam}
                employees={employeeScope.employees}
                onChange={employeeScope.setEmployee}
                loading={employeeScope.loadingEmployees}
                statsLoading={loading || refreshing}
                orgDescription="Organisation-wide MIS metrics"
                personDescriptionSuffix="MIS desk"
                personHint="Contacts created by this employee"
              />
            ) : null}
            <AnalyticsPeriodSelect
              dateRange={dateRange}
              setDateRange={setDateRange}
              customFrom={customFrom}
              setCustomFrom={setCustomFrom}
              customTo={customTo}
              setCustomTo={setCustomTo}
              periodLabel={periodLabel}
            />
          </div>
        </div>
      </section>

      {dateRange === 'custom' && customFrom && customTo && customFrom > customTo ? (
        <div className="rounded-xl border border-red-200 bg-red-50/80 px-4 py-2.5 text-[13px] text-red-800 mb-6">
          End date must be on or after the start date.
        </div>
      ) : null}

      <MetricSection
        title="Overview"
        timeLabel={periodLabel}
        hint={isDeskScope && !isOrgScope && !isEmployeeScope
          ? 'Organisation directory and your records'
          : 'Directory activity for this period'}
      >
        <div className={`grid grid-cols-1 min-[420px]:grid-cols-2 gap-3 sm:gap-4 min-w-0 ${isOrgScope || isEmployeeScope ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
          <StatCard
            icon={Inbox}
            label="Contacts in period"
            value={totals.inPeriod ?? 0}
            caption={[
              allTimeTotal ? `${outOf(totals.inPeriod ?? 0, allTimeTotal)} all-time` : null,
              uploadedN ? `${uploadedN.toLocaleString()} uploaded in period` : null,
              deltaCaption,
            ].filter(Boolean).join(' · ')}
            gradient="from-sky-500 to-brand-400"
            loading={showLoading}
            aligned
          />
          <StatCard
            icon={Building2}
            label="Organisation directory"
            value={totals.companyInPeriod ?? 0}
            caption={`${outOf(totals.companyInPeriod ?? 0, periodTotal)} contacts in period`}
            gradient="from-indigo-500 to-blue-400"
            loading={showLoading}
            aligned
          />
          <StatCard
            icon={UserRound}
            label={isOrgScope || isEmployeeScope ? 'Employee records' : 'My records'}
            value={totals.personalInPeriod ?? 0}
            caption={
              isOrgScope || isEmployeeScope
                ? `${outOf(totals.personalInPeriod ?? 0, periodTotal)} from employee desks`
                : 'Contacts you added in this period'
            }
            gradient="from-brand-500 to-teal-500"
            loading={showLoading}
            aligned
          />
          {showQuality ? (
          <StatCard
            icon={ShieldAlert}
            label="Date alignment"
            value={quality.dateAlignment ?? dup.recycledTrackerDates ?? 0}
            caption={`${outOf(quality.dateAlignment ?? dup.recycledTrackerDates ?? 0, periodTotal)} dated in period, imported earlier`}
            gradient="from-amber-500 to-orange-400"
            loading={showLoading}
            aligned
            onClick={() => openQuality('dateAlignment')}
          />
          ) : null}
        </div>
      </MetricSection>

      <MetricSection
        title={isOrgScope ? 'Status distribution' : 'Status distribution'}
        timeLabel={periodLabel}
        hint="Contact lifecycle status for this period"
      >
        <div className={`grid grid-cols-1 gap-4 sm:gap-6 min-w-0 ${isOrgScope ? 'xl:grid-cols-5' : ''}`}>
          <div className={`${isOrgScope ? 'xl:col-span-3' : ''} card-ats-bordered p-4 sm:p-6 relative overflow-hidden min-w-0`}>
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
            <h3 className="text-sm font-bold text-stone-900 mb-4">By status</h3>
            {showLoading ? (
              <div className="h-64 flex items-center justify-center text-sm text-stone-400">Loading…</div>
            ) : statusChartData.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 items-start min-w-0">
                <div className="min-w-0 overflow-hidden">
                  <CategoryBarChart data={statusChartData} limit={10} name="Contacts" height={300} horizontal />
                </div>
                <div className="card-ats-bordered overflow-hidden min-w-0">
                  <ReportTable
                    columns={[
                      {
                        key: 'status',
                        label: 'Status',
                        render: (row) => (
                          <span className="inline-flex items-center gap-2 min-w-0 max-w-[16rem]">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                            <span className="truncate font-medium" title={row.status}>{row.status}</span>
                          </span>
                        ),
                      },
                      {
                        key: 'count',
                        label: 'Contacts',
                        align: 'right',
                        render: (row) => row.count.toLocaleString(),
                      },
                      {
                        key: 'share',
                        label: 'Of period',
                        align: 'right',
                        className: 'text-stone-600',
                        render: (row) => outOf(row.count, periodTotal),
                      },
                    ]}
                    rows={statusTableRows.slice(0, 10)}
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-stone-500 py-10 text-center">No contacts in this period.</p>
            )}
          </div>

          {isOrgScope ? (
            <div className="xl:col-span-2 card-ats-bordered p-4 sm:p-6 relative overflow-hidden min-w-0">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 to-blue-400" />
              <h3 className="text-sm font-bold text-stone-900 mb-4">By employee</h3>
              {showLoading ? (
                <div className="h-56 flex items-center justify-center text-sm text-stone-400">Loading…</div>
              ) : employeeSlices.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 min-w-0">
                  <div className="relative h-48 mx-auto w-full max-w-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={employeeSlices}
                          dataKey="count"
                          nameKey="name"
                          innerRadius={58}
                          outerRadius={84}
                          paddingAngle={2}
                          stroke="#fff"
                          strokeWidth={2}
                        >
                          {employeeSlices.map((slice, index) => (
                            <Cell key={slice.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value, name) => [`${outOf(value, employeeTotal)} contacts`, name]}
                          contentStyle={CHART_TOOLTIP_STYLE}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <p className="text-xl font-bold text-stone-900 tabular-nums">{employeeTotal.toLocaleString()}</p>
                      <p className="text-[11px] font-medium text-stone-500">contacts</p>
                    </div>
                  </div>
                  <div className="card-ats-bordered overflow-hidden min-w-0">
                    <ReportTable
                      columns={[
                        {
                          key: 'name',
                          label: 'Employee',
                          render: (row) => (
                            <span className="inline-flex items-center gap-2 min-w-0 max-w-[12rem]">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                              <span className="truncate font-medium" title={row.name}>{row.name}</span>
                            </span>
                          ),
                        },
                        {
                          key: 'count',
                          label: 'Contacts',
                          align: 'right',
                          render: (row) => outOf(row.count, employeeTotal),
                        },
                      ]}
                      rows={employeeTableRows}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-stone-500 py-10 text-center">No employee activity in this period.</p>
              )}
            </div>
          ) : null}
        </div>
      </MetricSection>

      <MetricSection
        title="Volume trend"
        timeLabel={periodLabel}
        hint={granularity === 'weekly' ? 'Weekly contact volume' : 'Daily contact volume'}
      >
        <div className="card-ats-bordered p-4 sm:p-6 relative overflow-hidden min-w-0">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400" />
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={15} className="text-emerald-600" />
            <h3 className="text-sm font-bold text-stone-900">
              {granularity === 'weekly' ? 'Weekly volume' : 'Daily volume'}
            </h3>
          </div>
          {showLoading ? (
            <div className="h-56 flex items-center justify-center text-sm text-stone-400">Loading…</div>
          ) : trendChartData.length > 0 ? (
            <div className="min-w-0 w-full overflow-hidden">
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={trendChartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID_STROKE} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: '#78716c' }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                    minTickGap={28}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: '#78716c' }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                  />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    formatter={(value) => [`${Number(value).toLocaleString()} contacts`, 'Volume']}
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload;
                      if (!row) return '';
                      if (row.endDate && row.endDate !== row.date) return `${row.date} → ${row.endDate}`;
                      return row.date || '';
                    }}
                  />
                  <Bar dataKey="count" name="Volume" fill="#5eead4" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-stone-500 py-10 text-center">No volume data for this period.</p>
          )}
        </div>
      </MetricSection>

      {isOrgScope ? (
        <MetricSection
          title="Team performance"
          timeLabel={periodLabel}
          hint="Contacts added and date-alignment review by team member"
        >
          <div className="card-ats-bordered overflow-hidden min-w-0">
            {showLoading ? (
              <div className="p-8 text-center text-sm text-stone-400">Loading…</div>
            ) : (
              <ReportTable
                emptyLabel="No team activity in this period."
                columns={[
                  {
                    key: 'member',
                    label: 'Team member',
                    render: (row) => (
                      <button
                        type="button"
                        onClick={() => employeeScope.setEmployee(row.userId)}
                        className="text-left min-w-0 hover:text-brand-700 max-w-[18rem]"
                      >
                        <p className="font-semibold text-stone-900 truncate">{row.name}</p>
                        <p className="text-[11px] text-stone-500 truncate">{row.email}</p>
                      </button>
                    ),
                  },
                  {
                    key: 'added',
                    label: 'Contacts added',
                    align: 'right',
                    render: (row) => outOf(row.added, periodTotal),
                  },
                  {
                    key: 'conflicts',
                    label: 'Date alignment',
                    align: 'right',
                    render: (row) => outOf(row.conflicts, row.added || 0),
                  },
                  {
                    key: 'health',
                    label: 'Health',
                    align: 'right',
                    render: (row) => <RiskBadge level={row.risk} />,
                  },
                ]}
                rows={teamTableRows}
              />
            )}
          </div>
        </MetricSection>
      ) : null}

      {showQuality ? (
      <MetricSection
        title="Directory quality"
        timeLabel={periodLabel}
        hint="Review lists for the selected period. Select a card to open matching records."
      >
        <div className={`mb-4 rounded-xl border px-4 py-3 text-sm flex flex-wrap items-center gap-3 ${RISK_TONE[riskLevel] || RISK_TONE.ok}`}>
          <RiskBadge level={riskLevel} />
          <p className="min-w-0 flex-1 leading-snug text-stone-700">
            Volume uses each contact’s Date field. Import time is used only when Date is blank. Quality review covers the selected period.
          </p>
        </div>

        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 mb-4 min-w-0">
          <StatCard
            icon={ShieldAlert}
            label="Date alignment"
            value={quality.dateAlignment ?? dup.recycledTrackerDates ?? 0}
            caption={`${outOf(quality.dateAlignment ?? dup.recycledTrackerDates ?? 0, periodTotal)} dated in period, imported earlier`}
            gradient="from-amber-500 to-orange-400"
            loading={showLoading}
            aligned
            onClick={() => openQuality('dateAlignment')}
          />
          <StatCard
            icon={Phone}
            label="Shared phone numbers"
            value={quality.sharedPhoneGroups ?? dup.phoneDuplicateGroups ?? 0}
            caption={`${outOf(quality.sharedPhoneGroups ?? dup.phoneDuplicateGroups ?? 0, periodTotal)} shared-number groups in period`}
            gradient="from-stone-500 to-stone-600"
            loading={showLoading}
            aligned
            onClick={() => openQuality('sharedPhone')}
          />
          <StatCard
            icon={MailWarning}
            label="Also in Candidates — email"
            value={quality.directoryOverlapEmail ?? dup.emailOverlapWithCandidates ?? 0}
            caption={`${outOf(quality.directoryOverlapEmail ?? dup.emailOverlapWithCandidates ?? 0, periodTotal)} emails also on Candidates`}
            gradient="from-violet-500 to-fuchsia-400"
            loading={showLoading}
            aligned
            onClick={() => openQuality('directoryOverlapEmail')}
          />
          <StatCard
            icon={Phone}
            label="Also in Candidates — phone"
            value={quality.directoryOverlapPhone ?? dup.phoneOverlapWithCandidates ?? 0}
            caption={`${outOf(quality.directoryOverlapPhone ?? dup.phoneOverlapWithCandidates ?? 0, periodTotal)} numbers also on Candidates`}
            gradient="from-indigo-500 to-blue-400"
            loading={showLoading}
            aligned
            onClick={() => openQuality('directoryOverlapPhone')}
          />
          <StatCard
            icon={Users}
            label="Previously on file"
            value={quality.priorOnFile ?? 0}
            caption={`${outOf(quality.priorOnFile ?? 0, periodTotal)} imported in period, already on file`}
            gradient="from-rose-500 to-orange-400"
            loading={showLoading}
            aligned
            onClick={() => openQuality('priorOnFile')}
          />
          <StatCard
            icon={Users}
            label="Imported in period"
            value={uploadedN}
            caption={`${outOf(uploadedN, periodTotal)} created or imported in period`}
            gradient="from-emerald-500 to-teal-400"
            loading={showLoading}
            aligned
          />
          <StatCard
            icon={AlertTriangle}
            label="Updates to earlier records"
            value={quality.recentUpdates ?? dup.touchedOldContacts ?? 0}
            caption={`${outOf(quality.recentUpdates ?? dup.touchedOldContacts ?? 0, periodTotal)} earlier records updated in period`}
            gradient="from-amber-600 to-stone-500"
            loading={showLoading}
            aligned
            onClick={() => openQuality('recentUpdate')}
          />
        </div>

        {qualityKind ? (
          <div className="card-ats-bordered overflow-hidden min-w-0">
            <div className="px-4 py-3 border-b border-stone-100 bg-stone-50/80 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-stone-900">{qualityDetail?.label || 'Review list'}</h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  {qualityLoading
                    ? 'Loading matching records…'
                    : `${Number(qualityDetail?.total || 0).toLocaleString()} matching record${Number(qualityDetail?.total || 0) === 1 ? '' : 's'}`}
                </p>
              </div>
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => {
                  const params = new URLSearchParams({ desk: 'all', quality: qualityKind });
                  if (dateRange && dateRange !== 'custom') params.set('dateRange', dateRange);
                  if (dateRange === 'custom' && customFrom && customTo) {
                    params.set('dateRange', 'custom');
                    params.set('from', customFrom);
                    params.set('to', customTo);
                  }
                  navigate(`/mis?${params.toString()}`);
                }}
              >
                Open in directory
              </button>
            </div>
            {qualityLoading ? (
              <div className="p-8 text-center text-sm text-stone-400">Loading…</div>
            ) : (
              <ReportTable
                emptyLabel="No matching records for this period."
                columns={[
                  { key: 'name', label: 'Name', render: (row) => <span className="font-medium">{row.name || '—'}</span> },
                  { key: 'email', label: 'Email', className: 'text-stone-600', render: (row) => row.email || '—' },
                  { key: 'phone', label: 'Phone', className: 'text-stone-600', render: (row) => row.phone || '—' },
                  { key: 'recordDate', label: 'Contact date', align: 'right', className: 'text-amber-800 font-semibold', render: (row) => row.recordDate || '—' },
                  { key: 'createdAt', label: 'Imported', align: 'right', className: 'text-stone-500', render: (row) => row.createdAt || '—' },
                ]}
                rows={(qualityDetail?.rows || []).map((row) => ({ ...row, id: row.id }))}
              />
            )}
          </div>
        ) : Array.isArray(dup.samples) && dup.samples.length > 0 ? (
          <div className="card-ats-bordered overflow-hidden min-w-0">
            <div className="px-4 py-3 border-b border-stone-100 bg-stone-50/80">
              <h3 className="text-sm font-bold text-stone-900">Date alignment sample</h3>
              <p className="text-xs text-stone-500 mt-0.5">Contacts dated in this period that were imported earlier. Select a card for the full list.</p>
            </div>
            <ReportTable
              columns={[
                { key: 'name', label: 'Name', render: (row) => <span className="font-medium">{row.name || '—'}</span> },
                { key: 'email', label: 'Email', className: 'text-stone-600', render: (row) => row.email || '—' },
                { key: 'recordDate', label: 'Contact date', align: 'right', className: 'text-amber-800 font-semibold', render: (row) => row.recordDate || '—' },
                { key: 'createdAt', label: 'Imported', align: 'right', className: 'text-stone-500', render: (row) => row.createdAt || '—' },
              ]}
              rows={dup.samples.map((row) => ({ ...row, id: row.id }))}
            />
          </div>
        ) : null}
      </MetricSection>
      ) : null}

      <MetricSection
        title="Status detail"
        timeLabel={periodLabel}
        hint="Full status breakdown for this period"
      >
        <div className="card-ats-bordered overflow-hidden min-w-0">
          {showLoading ? (
            <div className="p-8 text-center text-sm text-stone-400">Loading…</div>
          ) : (
            <ReportTable
              emptyLabel="No contacts in this period."
              columns={[
                {
                  key: 'status',
                  label: 'Status',
                  render: (row) => (
                    <span className="inline-flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                      <span className="font-medium break-words whitespace-normal max-w-[28rem]">{row.status}</span>
                    </span>
                  ),
                },
                {
                  key: 'count',
                  label: 'Contacts',
                  align: 'right',
                  render: (row) => row.count.toLocaleString(),
                },
                {
                  key: 'ofPeriod',
                  label: 'Of period total',
                  align: 'right',
                  className: 'text-stone-600',
                  render: (row) => outOf(row.count, periodTotal),
                },
              ]}
              rows={statusTableRows}
            />
          )}
        </div>
      </MetricSection>
    </div>
  );
}
