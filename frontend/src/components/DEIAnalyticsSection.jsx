import React, { useEffect, useState } from 'react';
import { Users2, Lock, Loader2, ShieldCheck } from 'lucide-react';
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
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="font-medium text-stone-700 truncate">{label || 'Unspecified'}</span>
        <span className="text-stone-500 text-xs">{total} candidate{total === 1 ? '' : 's'} · {hireRate}% hired</span>
      </div>
      <div className="h-2.5 bg-stone-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-500 via-teal-500 to-brand-700"
          style={{ width: `${widthPct}%` }}
        />
      </div>
    </div>
  );
};

const BreakdownCard = ({ title, rows }) => {
  if (!rows || rows.length === 0) {
    return (
      <div className="card-ats-bordered p-5">
        <h4 className="text-sm font-semibold text-stone-900 mb-3">{title}</h4>
        <p className="text-xs text-stone-400">No self-reported data yet.</p>
      </div>
    );
  }
  const maxTotal = Math.max(...rows.map(r => r.total));
  return (
    <div className="card-ats-bordered p-5">
      <h4 className="text-sm font-semibold text-stone-900 mb-3">{title}</h4>
      {rows.map((r) => <BreakdownBar key={r.label} label={r.label} total={r.total} hired={r.hired} maxTotal={maxTotal} />)}
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
      } finally {
        setLoading(false);
      }
    })();
  }, [organization]);

  if (!organization) return null;

  if (!entitled) {
    return (
      <div className="card-ats-bordered p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
          <Lock className="w-6 h-6 text-amber-600" />
        </div>
        <h3 className="text-base font-bold text-stone-900">Diversity & Inclusion Analytics is an Enterprise add-on</h3>
        <p className="text-sm text-stone-500 mt-1 max-w-md mx-auto">
          Track self-reported demographic funnel breakdown across your pipeline (opt-in, aggregate-only — never shown per-candidate).
        </p>
        <a href="/billing" className="btn-primary inline-flex mt-4">
          Upgrade to Enterprise
        </a>
      </div>
    );
  }

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-stone-400 animate-spin" /></div>;
  }

  if (!data || data.totalCandidates === 0) {
    return (
      <div className="card-ats-bordered">
        <EmptyState icon={Users2} message="No candidates yet to analyze." subMessage="Self-reported demographic data will appear here once candidates opt in." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 bg-gradient-to-r from-brand-50 via-teal-50 to-brand-50 border border-brand-100 rounded-xl p-4">
        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0">
          <Users2 className="w-5 h-5 text-brand-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-stone-900">
            {data.selfReportedCount} of {data.totalCandidates} candidates ({data.selfReportRate}%) have self-reported demographics
          </p>
          <p className="text-xs text-stone-500 flex items-center gap-1 mt-0.5">
            <ShieldCheck className="w-3.5 h-3.5" /> Always opt-in · shown in aggregate only, never next to an individual candidate
          </p>
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
