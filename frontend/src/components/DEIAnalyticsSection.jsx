import React, { useEffect, useState } from 'react';
import { Users2, Lock, Loader2, ShieldCheck, VenusAndMars, Globe2, Medal, Accessibility } from 'lucide-react';
import EmptyState from './ui/EmptyState';
import { authenticatedFetch } from '../utils/fetchUtils';
import { useAuth } from '../context/AuthContext';
import { planHasFeature } from '../config/planFeatures';

/**
 * Diversity & Inclusion funnel — Add-on (analytics.dei, Enterprise).
 * Self-contained: fetches its own data so it can be dropped into
 * AnalyticsDashboard with a single import + render, without touching that
 * file's existing state/effects.
 */
const BreakdownBar = ({ label, total, hired, maxTotal }) => {
  const widthPct = maxTotal > 0 ? Math.max((total / maxTotal) * 100, 4) : 0;
  const hireRate = total > 0 ? Math.round((hired / total) * 100) : 0;
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center justify-between gap-3 text-sm mb-1.5">
        <span className="font-medium text-stone-700 truncate">{label || 'Unspecified'}</span>
        <span className="text-stone-500 text-xs whitespace-nowrap flex-shrink-0 tabular-nums">
          {total} · {hireRate}% hired
        </span>
      </div>
      <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-500 via-teal-500 to-brand-700"
          style={{ width: `${widthPct}%` }}
        />
      </div>
    </div>
  );
};

const CARD_META = {
  'Gender Identity': { icon: VenusAndMars, accent: 'from-brand-500 to-teal-400' },
  Ethnicity: { icon: Globe2, accent: 'from-teal-500 to-emerald-400' },
  'Veteran Status': { icon: Medal, accent: 'from-amber-500 to-orange-400' },
  'Disability Status': { icon: Accessibility, accent: 'from-sky-500 to-cyan-400' },
};

const BreakdownCard = ({ title, rows }) => {
  const meta = CARD_META[title] || { icon: ShieldCheck, accent: 'from-brand-500 to-teal-400' };
  const Icon = meta.icon;

  if (!rows || rows.length === 0) {
    return (
      <div className="card-ats-bordered relative overflow-hidden min-h-[200px] flex flex-col">
        <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${meta.accent}`} />
        <div className="px-5 pt-5 pb-2 flex items-center gap-2.5">
          <span className="h-8 w-8 rounded-lg bg-stone-50 border border-stone-200 text-stone-600 inline-flex items-center justify-center flex-shrink-0">
            <Icon size={15} strokeWidth={2} />
          </span>
          <h4 className="text-sm font-bold text-stone-900 tracking-tight">{title}</h4>
        </div>
        <div className="flex-1 flex items-center justify-center px-2 pb-2">
          <EmptyState
            icon={ShieldCheck}
            tone="neutral"
            compact
            message="No self-reported data yet"
            subMessage="Appears when candidates opt in."
          />
        </div>
      </div>
    );
  }

  const maxTotal = Math.max(...rows.map((r) => r.total));
  return (
    <div className="card-ats-bordered p-5 relative overflow-hidden">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${meta.accent}`} />
      <div className="flex items-center gap-2.5 mb-4">
        <span className="h-8 w-8 rounded-lg bg-stone-50 border border-stone-200 text-stone-600 inline-flex items-center justify-center flex-shrink-0">
          <Icon size={15} strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-stone-900 tracking-tight">{title}</h4>
          <p className="text-[11px] text-stone-400">{rows.length} categor{rows.length === 1 ? 'y' : 'ies'}</p>
        </div>
      </div>
      {rows.map((r) => (
        <BreakdownBar key={r.label} label={r.label} total={r.total} hired={r.hired} maxTotal={maxTotal} />
      ))}
    </div>
  );
};

const DEIAnalyticsSection = () => {
  const { organization } = useAuth();
  const [loading, setLoading] = useState(true);
  const [entitled, setEntitled] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (organization && !planHasFeature(organization.plan, 'analytics.dei')) {
      setEntitled(false);
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await authenticatedFetch('/api/analytics/dei');
        if (res.status === 403) { setEntitled(false); return; }
        const json = await res.json();
        if (json.success) setData(json.data);
      } catch {
        /* fail gracefully if DEI API is offline */
      } finally {
        setLoading(false);
      }
    })();
  }, [organization]);

  if (!organization) return null;

  if (!entitled) {
    return (
      <div className="card-ats-bordered p-8 text-center relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 to-orange-400" />
        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-3">
          <Lock className="w-5 h-5 text-amber-600" />
        </div>
        <h3 className="text-base font-bold text-stone-900 tracking-tight">Diversity & Inclusion Analytics is an Enterprise add-on</h3>
        <p className="text-sm text-stone-500 mt-1 max-w-md mx-auto leading-relaxed">
          Track self-reported demographic funnel breakdown across your pipeline (opt-in, aggregate-only — never shown per-candidate).
        </p>
        <a href="/billing" className="btn-primary inline-flex mt-4">
          Upgrade to Enterprise
        </a>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="card-ats-bordered p-10 flex justify-center">
        <Loader2 className="w-6 h-6 text-stone-400 animate-spin" />
      </div>
    );
  }

  if (!data || data.totalCandidates === 0) {
    return (
      <div className="card-ats-bordered relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <EmptyState
          icon={Users2}
          tone="brand"
          message="No candidates yet to analyze"
          subMessage="Self-reported demographic data will appear here once candidates opt in."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card-ats-bordered relative overflow-hidden p-4 sm:p-5">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center shrink-0">
            <Users2 className="w-5 h-5 text-brand-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-stone-900">
              {data.selfReportedCount} of {data.totalCandidates} candidates ({data.selfReportRate}%) have self-reported demographics
            </p>
            <p className="text-xs text-stone-500 flex items-center gap-1 mt-0.5">
              <ShieldCheck className="w-3.5 h-3.5 text-brand-600 flex-shrink-0" />
              Always opt-in · aggregate only, never next to an individual candidate
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <BreakdownCard title="Gender Identity" rows={data.breakdowns.genderIdentity} />
        <BreakdownCard title="Ethnicity" rows={data.breakdowns.ethnicity} />
        <BreakdownCard title="Veteran Status" rows={data.breakdowns.veteranStatus} />
        <BreakdownCard title="Disability Status" rows={data.breakdowns.disabilityStatus} />
      </div>
    </div>
  );
};

export default DEIAnalyticsSection;
