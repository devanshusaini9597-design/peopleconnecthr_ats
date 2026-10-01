import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  FileBarChart, RefreshCw, Inbox, Building2, UserRound, Copy, MailWarning, Phone,
  BarChart3, TrendingUp,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts';
import { authenticatedFetch } from '../utils/fetchUtils';
import { useToast } from './Toast';
import { useAuth } from '../context/AuthContext';
import PageHeader from './ui/PageHeader';
import AnalyticsPeriodSelect from './analytics/AnalyticsPeriodSelect';
import { StatCard } from './dashboard/DashboardWidgets';
import { CategoryBarChart, CategoryRankList } from './analytics/AnalyticsCharts';
import { DATE_RANGE_LABELS, PIE_COLORS } from './analytics/constants';
import { CHART_TOOLTIP_STYLE, CHART_GRID_STROKE } from './analytics/chartUtils';
import { canAccessMis } from '../utils/misAccess';

const DESK_COLORS = ['#4f46e5', '#0d9488'];

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
    <section className="mb-8 min-w-0">
      <div className="mb-3 min-w-0">
        <h2 className="text-sm font-bold tracking-tight text-stone-900 break-words">{title}</h2>
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

function formatTrendTick(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(dateStr).slice(5);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/**
 * MIS reporting — KPIs, charts, and duplicacy.
 * Owner/admin: organisation-wide. Other employees: only contacts they added.
 */
export default function MisReportsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const isAllowed = canAccessMis(user);

  const [dateRange, setDateRange] = useState('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [report, setReport] = useState(null);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const requestSeq = React.useRef(0);

  const isSelfScope = report?.scope === 'self'
    || (user && !['owner', 'admin'].includes(user.role));
  const isVisibleScope = report?.scope === 'visible';
  const scopeSubtitle = report?.scope === 'organisation'
    ? 'Organisation-wide MIS metrics for the company owner'
    : isVisibleScope
      ? 'Shared directory plus your personal records — other employees’ private desks stay hidden'
      : 'Metrics for contacts you added — not other employees’ records';
  const scopeHint = report?.scope === 'organisation'
    ? 'Period totals use the tracker date when available, otherwise the import timestamp. Charts follow the selected period.'
    : isVisibleScope
      ? 'Totals cover the shared directory and your personal records only. Other employees’ private desks are excluded.'
      : 'Period totals use the date you added each contact. Charts and duplicacy cover only your MIS records.';

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
      setReport(null); // avoid showing previous period while the new one loads
    }
    try {
      const params = new URLSearchParams({ dateRange });
      if (dateRange === 'custom') {
        params.set('from', customFrom);
        params.set('to', customTo);
      }
      // Bust caches so period switches always get fresh aggregates
      params.set('_', String(Date.now()));
      const res = await authenticatedFetch(`/api/mis/reports?${params}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      const data = await res.json().catch(() => ({}));
      if (seq !== requestSeq.current) return; // stale response — ignore
      if (!res.ok) throw new Error(data.message || 'Failed to load MIS reports');
      setReport(data);
      setLastSyncedAt(data.generatedAt ? new Date(data.generatedAt) : new Date());
    } catch (err) {
      if (seq !== requestSeq.current) return;
      if (!silent) {
        toast.error(err.message || 'Failed to load MIS reports');
        setReport(null);
      }
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [isAllowed, dateRange, customFrom, customTo, toast]);

  useEffect(() => { load(); }, [load]);

  // Keep numbers live: refresh on focus and every 2 minutes while the page is open
  useEffect(() => {
    if (!isAllowed) return undefined;
    const onFocus = () => { load({ silent: true }); };
    window.addEventListener('focus', onFocus);
    const id = window.setInterval(() => { load({ silent: true }); }, 120000);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.clearInterval(id);
    };
  }, [isAllowed, load]);

  const totals = report?.totals || {};
  const dup = report?.duplicacy || {};
  const byStatus = Array.isArray(report?.byStatus) ? report.byStatus : [];
  const bySource = Array.isArray(report?.bySource) ? report.bySource : [];
  const trend = Array.isArray(report?.trend) ? report.trend : [];
  const deskMix = Array.isArray(report?.deskMix) ? report.deskMix : [];
  const showLoading = loading && !report;

  const statusChartData = useMemo(
    () => byStatus.map((row) => ({
      label: formatLabel(row.status),
      fullLabel: formatLabel(row.status),
      value: Number(row.count) || 0,
    })),
    [byStatus]
  );

  const sourceChartData = useMemo(
    () => bySource.map((row) => ({
      label: row.source,
      fullLabel: row.source,
      value: Number(row.count) || 0,
    })),
    [bySource]
  );

  const trendChartData = useMemo(
    () => trend.map((row) => ({
      date: row.date,
      label: formatTrendTick(row.date),
      count: Number(row.count) || 0,
    })),
    [trend]
  );

  const deskSlices = useMemo(
    () => deskMix.map((row) => ({
      name: row.label,
      count: Number(row.count) || 0,
    })).filter((row) => row.count > 0),
    [deskMix]
  );

  const deskTotal = deskSlices.reduce((sum, row) => sum + row.count, 0);
  const periodTotal = Number(totals.inPeriod) || deskTotal || 0;

  if (user && !isAllowed) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="page-shell-ats font-sans text-stone-900" role="main" aria-label="MIS Reports">
      <PageHeader
        icon={FileBarChart}
        title="MIS Reports"
        subtitle={scopeSubtitle}
        gradientTitle
      >
        <button
          type="button"
          onClick={() => load()}
          disabled={loading || refreshing}
          className="inline-flex h-10 w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-700 shadow-sm hover:bg-stone-50 disabled:opacity-50"
          title={
            lastSyncedAt
              ? `Last updated ${lastSyncedAt.toLocaleTimeString()}`
              : 'Refresh report'
          }
        >
          <RefreshCw size={15} className={(loading || refreshing) ? 'animate-spin' : ''} />
          Refresh
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,280px)_1fr] gap-4 mb-6 min-w-0">
        <div className="card-ats-bordered p-4 sm:p-5 min-w-0" data-tour="mis-reports-period">
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
        <div className="rounded-xl border border-brand-100/80 bg-gradient-to-r from-brand-50/70 via-white to-white px-4 py-3 text-sm text-stone-600 leading-snug min-w-0 flex flex-col sm:flex-row sm:items-start gap-2">
          <span className="inline-flex items-start gap-2 min-w-0 flex-1">
            <BarChart3 size={16} className="text-brand-600 shrink-0 mt-0.5" />
            <span>
              {scopeHint}
            </span>
          </span>
          {lastSyncedAt ? (
            <span className="text-[11px] font-semibold text-stone-400 tabular-nums shrink-0 sm:pt-0.5">
              Updated {lastSyncedAt.toLocaleTimeString()}
              {refreshing ? ' · refreshing…' : ''}
            </span>
          ) : null}
        </div>
      </div>

      {/* Overview KPIs */}
      <MetricSection
        title="Period overview"
        timeLabel={periodLabel}
        hint={
          isSelfScope
            ? 'Contacts you added in this period'
            : isVisibleScope
              ? 'Shared directory and your personal records in this period'
              : 'Contacts across the organisation directory'
        }
      >
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            icon={Inbox}
            label="Contacts in period"
            value={totals.inPeriod ?? 0}
            caption={
              isSelfScope
                ? `Your all-time total: ${(totals.allTime ?? 0).toLocaleString()}`
                : isVisibleScope
                  ? `All-time visible: ${(totals.allTime ?? 0).toLocaleString()}`
                  : `All-time directory: ${(totals.allTime ?? 0).toLocaleString()}`
            }
            gradient="from-sky-500 to-brand-400"
            loading={showLoading}
            aligned
          />
          <StatCard
            icon={Building2}
            label={isSelfScope || isVisibleScope ? 'Shared desk' : 'Organisation'}
            value={totals.companyInPeriod ?? 0}
            caption={
              isSelfScope
                ? 'Your contacts saved to the shared directory'
                : isVisibleScope
                  ? 'Shared directory contacts in period'
                  : 'Shared directory contacts in period'
            }
            gradient="from-indigo-500 to-blue-400"
            loading={showLoading}
            aligned
          />
          <StatCard
            icon={UserRound}
            label="Personal records"
            value={totals.personalInPeriod ?? 0}
            caption={
              isSelfScope
                ? 'Your personal-desk contacts in period'
                : 'Employee-owned contacts in period'
            }
            gradient="from-brand-500 to-teal-500"
            loading={showLoading}
            aligned
          />
          <StatCard
            icon={Copy}
            label="Duplicate phone groups"
            value={dup.phoneDuplicateGroups ?? 0}
            caption={`${Number(dup.phoneDuplicateRows || 0).toLocaleString()} contacts share a phone`}
            gradient="from-amber-500 to-orange-400"
            loading={showLoading}
            aligned
          />
        </div>
      </MetricSection>

      {/* Charts — status + desk mix */}
      <MetricSection
        title="Status & desk mix"
        timeLabel={periodLabel}
        hint="Same layout style as the dashboard cohort charts"
      >
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 sm:gap-6 min-w-0">
          <div className="xl:col-span-3 card-ats-bordered p-4 sm:p-6 relative overflow-hidden min-w-0">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
            <h3 className="text-sm font-bold text-stone-900">Status breakdown</h3>
            <p className="text-xs text-stone-500 mt-0.5 mb-4">
              How contacts in {periodLabel} are distributed by MIS status.
            </p>
            {showLoading ? (
              <div className="h-64 flex items-center justify-center text-sm text-stone-400">Loading…</div>
            ) : statusChartData.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] gap-4 items-start">
                <CategoryBarChart data={statusChartData} limit={10} name="Contacts" height={280} />
                <CategoryRankList data={statusChartData} limit={10} total={periodTotal} />
              </div>
            ) : (
              <p className="text-sm text-stone-500 py-10 text-center">
                {isSelfScope ? 'No contacts you added in this period.' : 'No MIS contacts in this period.'}
              </p>
            )}
          </div>

          <div className="xl:col-span-2 card-ats-bordered p-4 sm:p-6 relative overflow-hidden min-w-0 bg-gradient-to-b from-white to-indigo-50/30">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 to-blue-400" />
            <h3 className="text-sm font-bold text-stone-900">Desk mix</h3>
            <p className="text-xs text-stone-500 mt-0.5 mb-4">
              Shared directory versus personal records in this period.
            </p>
            {showLoading ? (
              <div className="h-56 flex items-center justify-center text-sm text-stone-400">Loading…</div>
            ) : deskSlices.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 items-center min-w-0">
                <div className="relative h-56 mx-auto w-full max-w-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={deskSlices}
                        dataKey="count"
                        nameKey="name"
                        innerRadius={68}
                        outerRadius={96}
                        paddingAngle={2}
                        stroke="#fff"
                        strokeWidth={2}
                      >
                        {deskSlices.map((slice, index) => (
                          <Cell key={slice.name} fill={DESK_COLORS[index % DESK_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, name) => [`${Number(value).toLocaleString()} contacts`, name]}
                        contentStyle={CHART_TOOLTIP_STYLE}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-2xl font-bold text-stone-900 tabular-nums">{deskTotal.toLocaleString()}</p>
                    <p className="text-[11px] font-medium text-stone-500">contacts</p>
                  </div>
                </div>
                <div className="min-w-0 flex flex-col gap-1">
                  {deskSlices.map((item, index) => {
                    const pct = deskTotal > 0 ? Math.round((item.count / deskTotal) * 100) : 0;
                    return (
                      <div
                        key={item.name}
                        className="w-full min-w-0 grid grid-cols-[0.625rem_minmax(0,1fr)_auto] items-start gap-x-2.5 rounded-xl px-2.5 py-1.5"
                      >
                        <span
                          className="mt-1.5 w-2.5 h-2.5 rounded-full"
                          style={{ background: DESK_COLORS[index % DESK_COLORS.length] }}
                        />
                        <span className="text-sm font-medium text-stone-800 break-words">{item.name}</span>
                        <span className="text-sm font-semibold tabular-nums text-stone-900 whitespace-nowrap">
                          {item.count.toLocaleString()} · {pct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-sm text-stone-500 py-10 text-center">No desk data for this period.</p>
            )}
          </div>
        </div>
      </MetricSection>

      {/* Trend */}
      <MetricSection
        title="Intake trend"
        timeLabel={periodLabel}
        hint={isSelfScope ? 'Contacts you added by day' : 'Contacts added by day'}
      >
        <div className="card-ats-bordered p-4 sm:p-6 relative overflow-hidden min-w-0">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400" />
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={15} className="text-emerald-600" />
            <h3 className="text-sm font-bold text-stone-900">Daily volume</h3>
          </div>
          <p className="text-xs text-stone-500 mb-4">
            Day-by-day contact volume for the selected period.
          </p>
          {showLoading ? (
            <div className="h-56 flex items-center justify-center text-sm text-stone-400">Loading…</div>
          ) : trendChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trendChartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="misTrendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0d9488" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#0d9488" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
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
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.date || ''}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#0d9488"
                  strokeWidth={2.25}
                  fill="url(#misTrendFill)"
                  name="Contacts"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-stone-500 py-10 text-center">No daily trend data for this period.</p>
          )}
        </div>
      </MetricSection>

      {/* Sources */}
      <MetricSection
        title="Sources"
        timeLabel={periodLabel}
        hint="Where contacts in this period came from"
      >
        <div className="card-ats-bordered p-4 sm:p-6 relative overflow-hidden min-w-0">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 to-fuchsia-400" />
          <h3 className="text-sm font-bold text-stone-900">Top sources</h3>
          <p className="text-xs text-stone-500 mt-0.5 mb-4">
            Leading source channels for contacts in {periodLabel}.
          </p>
          {showLoading ? (
            <div className="h-48 flex items-center justify-center text-sm text-stone-400">Loading…</div>
          ) : sourceChartData.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] gap-4 items-start">
              <CategoryBarChart data={sourceChartData} limit={8} name="Contacts" horizontal />
              <CategoryRankList data={sourceChartData} limit={8} total={periodTotal} />
            </div>
          ) : (
            <p className="text-sm text-stone-500 py-10 text-center">No source data for this period.</p>
          )}
        </div>
      </MetricSection>

      {/* Duplicacy */}
      <MetricSection
        title="Duplicacy"
        hint={
          isSelfScope
            ? 'Checks across your MIS records (not limited to the selected period)'
            : isVisibleScope
              ? 'Checks across contacts you can see (not limited to the selected period)'
              : 'Organisation-wide checks (not limited to the selected period)'
        }
      >
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          <StatCard
            icon={Phone}
            label="MIS phone collisions"
            value={dup.phoneDuplicateGroups ?? 0}
            caption={
              isSelfScope
                ? 'Same phone on multiple contacts you added'
                : 'Same phone on multiple MIS contacts'
            }
            gradient="from-rose-500 to-orange-400"
            loading={showLoading}
            aligned
          />
          <StatCard
            icon={MailWarning}
            label="Email already in Candidates"
            value={dup.emailOverlapWithCandidates ?? 0}
            caption={
              isSelfScope
                ? 'Your MIS emails that also exist in ATS'
                : 'MIS emails that also exist in ATS'
            }
            gradient="from-violet-500 to-fuchsia-400"
            loading={showLoading}
            aligned
          />
          <StatCard
            icon={Phone}
            label="Phone already in Candidates"
            value={dup.phoneOverlapWithCandidates ?? 0}
            caption={
              isSelfScope
                ? 'Your MIS phones that also exist in ATS'
                : 'MIS phones that also exist in ATS'
            }
            gradient="from-stone-500 to-stone-600"
            loading={showLoading}
            aligned
          />
        </div>
      </MetricSection>

      {/* Status table */}
      <MetricSection title="Status table" timeLabel={periodLabel} hint="Exact counts by MIS status">
        {showLoading ? (
          <div className="card-ats-bordered p-8 text-center text-sm text-stone-400">Loading…</div>
        ) : byStatus.length === 0 ? (
          <div className="card-ats-bordered p-8 text-center text-sm text-stone-400">
            {isSelfScope ? 'No contacts you added in this period.' : 'No MIS contacts in this period.'}
          </div>
        ) : (
          <div className="card-ats-bordered overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[280px]">
              <thead>
                <tr className="bg-stone-50 text-left text-[11px] uppercase tracking-wider text-stone-500">
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Count</th>
                  <th className="px-4 py-3 font-semibold text-right">Share</th>
                </tr>
              </thead>
              <tbody>
                {byStatus.map((row, index) => {
                  const count = Number(row.count || 0);
                  const share = periodTotal > 0 ? Math.round((count / periodTotal) * 100) : 0;
                  return (
                    <tr key={row.status} className="border-t border-stone-100">
                      <td className="px-4 py-2.5 font-medium text-stone-800">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                          />
                          {formatLabel(row.status)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-stone-700">{count.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-stone-500">{share}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </MetricSection>
    </div>
  );
}
