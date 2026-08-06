import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { remainingOf } from './billingConstants';

export const UsageBar = ({ label, current = 0, max, icon: Icon, tone = 'brand' }) => {
  const unlimited = max == null || max <= 0 || max >= 999999;
  const remaining = remainingOf(current, max);
  const pct = unlimited ? 8 : Math.min(100, Math.round((current / max) * 100));
  const hot = !unlimited && pct >= 85;
  const warm = !unlimited && pct >= 60 && pct < 85;
  const bar =
    hot ? 'bg-red-500' : warm ? 'bg-amber-500' : tone === 'emerald' ? 'bg-emerald-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-brand-500';

  const onMove = (e) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  return (
    <div className="billing-usage-card rounded-2xl border border-stone-200/80 bg-white p-4 sm:p-5" onMouseMove={onMove}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="billing-usage-icon w-9 h-9 rounded-xl bg-stone-50 border border-stone-100 flex items-center justify-center flex-shrink-0">
            <Icon className={`w-4 h-4 ${hot ? 'text-red-500' : 'text-brand-600'}`} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-stone-800 truncate">{label}</p>
            <p className="text-xs text-stone-500 mt-0.5">
              {(current || 0).toLocaleString()}
              <span className="text-stone-400"> / {unlimited ? 'Unlimited' : max.toLocaleString()}</span>
            </p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          {!unlimited && (
            <span className={`text-xs font-bold tabular-nums block ${hot ? 'text-red-600' : warm ? 'text-amber-600' : 'text-stone-500'}`}>
              {pct}%
            </span>
          )}
          {remaining != null && (
            <span className={`text-[11px] font-semibold tabular-nums ${hot ? 'text-red-600' : 'text-emerald-700'}`}>
              {remaining.toLocaleString()} left
            </span>
          )}
          {unlimited && (
            <span className="text-[11px] font-semibold text-stone-400">Unlimited</span>
          )}
        </div>
      </div>
      <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
        <div
          className={`billing-usage-bar-fill h-full rounded-full ${bar} transition-all duration-700 ease-out`}
          style={{ width: `${unlimited ? 12 : pct}%` }}
        />
      </div>
      {hot && (
        <p className="mt-2 text-xs font-medium text-red-600 flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5" /> Approaching limit — upgrade to unlock more
        </p>
      )}
    </div>
  );
};
