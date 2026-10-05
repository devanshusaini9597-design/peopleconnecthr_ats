import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Briefcase, Mail, Users, UserRound } from 'lucide-react';
import { authenticatedFetch } from '../../utils/fetchUtils';

const ICONS = {
  users: Users,
  jobs: Briefcase,
  candidates: UserRound,
  emails: Mail,
};

const PLAN_LABEL = {
  free_trial: 'Free trial',
  starter: 'Starter',
  professional: 'Premium',
  enterprise: 'Custom',
};

function Meter({ row }) {
  const Icon = ICONS[row.key] || Users;
  const unlimited = Boolean(row.unlimited);
  const used = Number(row.used || 0);
  const limit = Number(row.limit || 0);
  const pct = unlimited || limit <= 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const hot = !unlimited && pct >= 85;

  return (
    <div className="min-w-0 px-5 py-5 sm:px-6 sm:py-6">
      <div className="flex items-center gap-2 text-stone-500">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-950 text-white">
          <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
        </span>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">{row.label}</p>
      </div>
      <p className="mt-5 flex items-baseline gap-2">
        <span className="text-[2rem] font-semibold leading-none tabular-nums tracking-tight text-stone-950">
          {used.toLocaleString('en-IN')}
        </span>
        <span className="text-sm font-medium text-stone-400">
          / {unlimited ? '∞' : limit.toLocaleString('en-IN')}
        </span>
      </p>
      <div className="mt-4 h-1 overflow-hidden rounded-full bg-stone-100">
        {unlimited ? (
          <div className="h-full w-full bg-[repeating-linear-gradient(90deg,#d6d3d1_0_8px,transparent_8px_14px)]" />
        ) : (
          <div
            className={`h-full rounded-full ${hot ? 'bg-rose-500' : 'bg-stone-950'}`}
            style={{ width: `${Math.max(pct, 3)}%` }}
          />
        )}
      </div>
      <p className="mt-2.5 text-xs leading-snug text-stone-500">
        {unlimited
          ? 'No ceiling on this plan'
          : `${Number(row.remaining || 0).toLocaleString('en-IN')} left`}
        {row.note ? ` · ${row.note}` : ''}
      </p>
    </div>
  );
}

/** Owner dashboard only. The route is also owner-only. */
export default function PlanUsageCard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authenticatedFetch('/api/profile/plan-usage');
        const body = await res.json();
        if (!cancelled && res.ok && body.success) setData(body);
      } catch {
        /* the hiring dashboard still works if this request fails */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!data?.meters?.length) return null;
  const plan = PLAN_LABEL[data.plan] || 'Your plan';

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-stone-200/90 bg-white shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_24px_50px_-28px_rgba(28,25,23,0.35)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/70 to-transparent" />
      <div className="grid lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className="relative flex flex-col justify-between gap-6 border-b border-stone-100 bg-[radial-gradient(120%_90%_at_0%_0%,rgba(16,185,129,0.14),transparent_58%),linear-gradient(180deg,#f7faf8,#ffffff)] p-6 lg:border-b-0 lg:border-r">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-800">Owner</p>
            <h2 className="mt-3 text-[1.65rem] font-semibold leading-none tracking-tight text-stone-950">{plan}</h2>
            <p className="mt-3 text-sm leading-relaxed text-stone-500">
              Live seats, jobs, candidates, and mail against this workspace plan.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/billing')}
            className="inline-flex w-fit items-center gap-1.5 rounded-full bg-stone-950 px-4 py-2 text-xs font-semibold text-white transition hover:bg-stone-800"
          >
            Open billing
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          {data.meters.map((row, index) => (
            <div
              key={row.key}
              className={
                index === 0
                  ? ''
                  : 'border-t border-stone-100 sm:border-t-0 sm:border-l xl:border-l'
              }
            >
              <Meter row={row} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
