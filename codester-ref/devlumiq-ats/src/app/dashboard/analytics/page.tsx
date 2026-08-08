'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, Users, Target, Clock, Activity, Briefcase, ArrowUpRight, CheckCircle2
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import PageShell from '@/components/ui/PageShell';
import StatCard from '@/components/ui/StatCard';
import { useLocale } from '@/components/providers/LocaleProvider';
import { WeeklyChart, PipelineDoughnut } from '@/components/charts/DashboardCharts';

type DashboardSummary = {
  totalCandidates: number;
  thisMonth: number;
  pendingReview: number;
  conversionRate?: number;
  candidateTrend?: number;
  pipeline?: { stage: string; count: number }[];
  topPositions?: { position: string; count: number }[];
  topSources?: { source: string; count: number }[];
  dailySubmissions?: { date: string; count: number }[];
};

const positionColors = [
  { bar: 'from-brand-400 to-brand-600', badge: 'bg-brand-50 text-brand-700' },
  { bar: 'from-blue-400 to-blue-600', badge: 'bg-blue-50 text-blue-700' },
  { bar: 'from-violet-400 to-violet-600', badge: 'bg-violet-50 text-violet-700' },
  { bar: 'from-teal-400 to-teal-600', badge: 'bg-teal-50 text-teal-700' },
  { bar: 'from-amber-400 to-amber-600', badge: 'bg-amber-50 text-amber-700' },
  { bar: 'from-pink-400 to-pink-600', badge: 'bg-pink-50 text-pink-700' },
];

const sourceColors = [
  { bar: 'from-emerald-400 to-emerald-600', badge: 'bg-emerald-50 text-emerald-700' },
  { bar: 'from-sky-400 to-sky-600', badge: 'bg-sky-50 text-sky-700' },
  { bar: 'from-orange-400 to-orange-600', badge: 'bg-orange-50 text-orange-700' },
  { bar: 'from-rose-400 to-rose-600', badge: 'bg-rose-50 text-rose-700' },
  { bar: 'from-indigo-400 to-indigo-600', badge: 'bg-indigo-50 text-indigo-700' },
  { bar: 'from-cyan-400 to-cyan-600', badge: 'bg-cyan-50 text-cyan-700' },
];

export default function AnalyticsPage() {
  const { t } = useLocale();
  const [data, setData] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/dashboard/summary', { credentials: 'include', cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed'))))
      .then((json) => { if (!cancelled) setData(json as DashboardSummary); })
      .catch(() => {
        if (!cancelled) setData({ totalCandidates: 0, thisMonth: 0, pendingReview: 0, conversionRate: 0, topPositions: [], topSources: [], pipeline: [], dailySubmissions: [] });
      });
    return () => { cancelled = true; };
  }, []);

  const d = data ?? { totalCandidates: 0, thisMonth: 0, pendingReview: 0, conversionRate: 0, topPositions: [], topSources: [], pipeline: [], dailySubmissions: [] };

  if (data === null) {
    return (
      <PageShell className="animate-pulse">
        <div className="h-10 w-48 rounded-xl bg-stone-200" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-32 rounded-2xl bg-stone-100" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="h-64 rounded-2xl bg-stone-100" /><div className="h-64 rounded-2xl bg-stone-100" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="h-52 rounded-2xl bg-stone-100" /><div className="h-52 rounded-2xl bg-stone-100" />
        </div>
      </PageShell>
    );
  }

  const statCards = [
    { label: t('analytics.totalCandidates'), value: String(d.totalCandidates), icon: Users, trend: d.candidateTrend, iconClassName: 'text-brand-600 bg-brand-50' },
    { label: t('analytics.thisMonth'), value: String(d.thisMonth), icon: Activity, iconClassName: 'text-emerald-600 bg-emerald-50' },
    { label: t('analytics.conversionRate'), value: `${d.conversionRate ?? 0}%`, icon: Target, iconClassName: 'text-violet-600 bg-violet-50' },
    { label: t('analytics.pendingReview'), value: String(d.pendingReview), icon: Clock, iconClassName: 'text-amber-600 bg-amber-50' },
  ];

  const maxPos = Math.max(...(d.topPositions ?? []).map(p => p.count), 1);
  const maxSrc = Math.max(...(d.topSources ?? []).map(s => s.count), 1);

  return (
    <PageShell>
      {/* --- Section: Analytics Root - start --- */}
      <PageHeader icon={BarChart3} title={t('analytics.title')} subtitle={t('analytics.subtitle')} />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((s) => (
          <StatCard
            key={s.label}
            label={s.label}
            value={s.value}
            icon={s.icon}
            iconClassName={s.iconClassName}
            trend={s.trend}
          />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="rounded-2xl border border-stone-200/80 bg-white p-5 sm:p-6 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-all duration-300">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0"><BarChart3 className="w-4 h-4 text-brand-600" /></div>
            <h2 className="text-base font-bold text-stone-900">{t('analytics.weeklyApplications')}</h2>
          </div>
          <WeeklyChart dailySubmissions={d.dailySubmissions} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="rounded-2xl border border-stone-200/80 bg-white p-5 sm:p-6 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-all duration-300">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0"><Target className="w-4 h-4 text-violet-600" /></div>
            <h2 className="text-base font-bold text-stone-900">{t('analytics.pipelineDistribution')}</h2>
          </div>
          <PipelineDoughnut pipeline={d.pipeline} />
        </motion.div>
      </div>

      {/* Top Positions & Sources with animated bar charts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="rounded-2xl border border-stone-200/80 bg-white p-5 sm:p-6 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-all duration-300">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0"><Briefcase className="w-4 h-4 text-blue-600" /></div>
            <h2 className="text-base font-bold text-stone-900">{t('analytics.topPositions')}</h2>
          </div>
          {(d.topPositions ?? []).length === 0 ? (
            <div className="py-10 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-stone-50 flex items-center justify-center mb-3"><Briefcase className="w-5 h-5 text-stone-300" /></div>
              <p className="text-sm text-stone-400 font-medium">No positions data yet</p>
              <p className="text-xs text-stone-400 mt-1">Add candidates to see top positions</p>
            </div>
          ) : (
            <div className="space-y-4">
              {(d.topPositions ?? []).slice(0, 6).map((p, i) => {
                const pct = Math.round((p.count / maxPos) * 100);
                const c = positionColors[i % positionColors.length];
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1.5 gap-2">
                      <span className="text-sm font-medium text-stone-700 truncate min-w-0 flex-1">{p.position}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-lg flex-shrink-0 ${c.badge}`}>{p.count}</span>
                    </div>
                    <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.75, delay: 0.3 + i * 0.07, ease: [0.25, 0.46, 0.45, 0.94] }}
                        className={`h-full rounded-full bg-gradient-to-r ${c.bar}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="rounded-2xl border border-stone-200/80 bg-white p-5 sm:p-6 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-all duration-300">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0"><ArrowUpRight className="w-4 h-4 text-emerald-600" /></div>
            <h2 className="text-base font-bold text-stone-900">{t('analytics.topSources')}</h2>
          </div>
          {(d.topSources ?? []).length === 0 ? (
            <div className="py-10 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-stone-50 flex items-center justify-center mb-3"><CheckCircle2 className="w-5 h-5 text-stone-300" /></div>
              <p className="text-sm text-stone-400 font-medium">No source data yet</p>
              <p className="text-xs text-stone-400 mt-1">Add candidates with source info</p>
            </div>
          ) : (
            <div className="space-y-4">
              {(d.topSources ?? []).slice(0, 6).map((s, i) => {
                const pct = Math.round((s.count / maxSrc) * 100);
                const c = sourceColors[i % sourceColors.length];
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1.5 gap-2">
                      <span className="text-sm font-medium text-stone-700 truncate min-w-0 flex-1">{s.source}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-lg flex-shrink-0 ${c.badge}`}>{s.count}</span>
                    </div>
                    <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.75, delay: 0.35 + i * 0.07, ease: [0.25, 0.46, 0.45, 0.94] }}
                        className={`h-full rounded-full bg-gradient-to-r ${c.bar}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
      {/* --- Section: Analytics Root - end --- */}

      {/* Advanced analytics add-on (PRO / analyticsPlus) — summary above stays for all plans */}
      <AdvancedAnalyticsSection />
    </PageShell>
  );
}

function AdvancedAnalyticsSection() {
  const [state, setState] = useState<'loading' | 'denied' | 'ok'>('loading');
  const [period, setPeriod] = useState('30d');
  const [adv, setAdv] = useState<{
    stats?: { totalApplicants?: number; avgTimeToHire?: number | null };
    topSources?: { source: string; applicants?: number; hires?: number }[];
    diversityFunnel?: { responses: number; byGender: Record<string, number> } | null;
    timeToHire?: { totalTimeToHire: number | null }[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/analytics/dashboard?period=${period}`, { credentials: 'include' })
      .then(async (res) => {
        if (res.status === 403) {
          if (!cancelled) setState('denied');
          return;
        }
        if (!res.ok) throw new Error('fail');
        const json = await res.json();
        if (!cancelled) {
          setAdv(json);
          setState('ok');
        }
      })
      .catch(() => {
        if (!cancelled) setState('denied');
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  if (state === 'loading') {
    return <div className="h-40 rounded-2xl bg-stone-100 animate-pulse" />;
  }

  if (state === 'denied') {
    return (
      <div className="rounded-2xl border border-dashed border-stone-200 bg-white p-6 text-center">
        <p className="text-sm font-semibold text-stone-800">Advanced analytics</p>
        <p className="text-xs text-stone-500 mt-1">
          Time-to-hire, source effectiveness, and diversity funnel unlock on Professional or with the Analytics Plus add-on.
        </p>
      </div>
    );
  }

  const avgDays =
    adv?.stats?.avgTimeToHire != null
      ? Math.round(Number(adv.stats.avgTimeToHire) / 24)
      : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-stone-900">Advanced reports</h2>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="px-3 py-1.5 text-xs border border-stone-200 rounded-lg"
        >
          <option value="7d">7 days</option>
          <option value="30d">30 days</option>
          <option value="90d">90 days</option>
        </select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <p className="text-xs text-stone-500 font-medium">Applicants (period)</p>
          <p className="text-2xl font-bold text-stone-900 mt-1">{adv?.stats?.totalApplicants ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <p className="text-xs text-stone-500 font-medium">Avg time to hire</p>
          <p className="text-2xl font-bold text-stone-900 mt-1">{avgDays != null ? `${avgDays}d` : '—'}</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <p className="text-xs text-stone-500 font-medium">DEI responses</p>
          <p className="text-2xl font-bold text-stone-900 mt-1">{adv?.diversityFunnel?.responses ?? 0}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <h3 className="text-sm font-bold text-stone-900 mb-3">Source effectiveness</h3>
          <ul className="space-y-2">
            {(adv?.topSources || []).slice(0, 6).map((s) => (
              <li key={s.source} className="flex justify-between text-sm">
                <span className="text-stone-700 capitalize">{s.source}</span>
                <span className="text-stone-500 text-xs">
                  {s.applicants ?? 0} apps · {s.hires ?? 0} hires
                </span>
              </li>
            ))}
            {(adv?.topSources || []).length === 0 && (
              <li className="text-xs text-stone-400">No source metrics yet — they accumulate as candidates move stages.</li>
            )}
          </ul>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <h3 className="text-sm font-bold text-stone-900 mb-3">Diversity funnel (self-ID)</h3>
          <ul className="space-y-1.5">
            {Object.entries(adv?.diversityFunnel?.byGender || {}).map(([k, v]) => (
              <li key={k} className="flex justify-between text-sm">
                <span className="text-stone-600 capitalize">{k.replace(/_/g, ' ')}</span>
                <span className="font-medium text-stone-800">{v}</span>
              </li>
            ))}
            {!adv?.diversityFunnel?.responses && (
              <li className="text-xs text-stone-400">No voluntary self-ID responses yet.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

