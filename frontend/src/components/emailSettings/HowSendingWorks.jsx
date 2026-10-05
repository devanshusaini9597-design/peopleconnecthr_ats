import React from 'react';
import { Activity, Gauge, Send } from 'lucide-react';

const PLAN_LABEL = {
  free_trial: 'Free trial',
  starter: 'Starter',
  professional: 'Premium',
  enterprise: 'Custom',
};

export default function HowSendingWorks({ allowance, auditLog = [] }) {
  const unlimited = Boolean(allowance?.unlimited);
  const used = Number(allowance?.used || 0);
  const limit = Number(allowance?.limit || 0);
  const pct = !unlimited && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const plan = PLAN_LABEL[allowance?.plan] || 'Current plan';
  const reset = allowance?.periodStart
    ? (() => {
        const d = new Date(allowance.periodStart);
        if (Number.isNaN(d.getTime())) return null;
        d.setMonth(d.getMonth() + 1);
        return d;
      })()
    : null;

  return (
    <aside className="min-w-0 space-y-4 xl:col-span-4 xl:sticky xl:top-4">
      <div className="card-ats-bordered relative overflow-hidden p-4 sm:p-5">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <h2 className="relative flex items-center gap-2 text-[15px] font-bold text-stone-900">
          <Send className="h-4 w-4 text-brand-600" /> How mail leaves
        </h2>
        <ol className="relative mt-3 space-y-2 text-[13px] leading-relaxed text-stone-600">
          <li>1. Recruiters send from the ATS. Mail uses the allowance on this plan.</li>
          <li>2. Candidate replies come back to Inbox and are saved on the thread. The hiring contact you set is stamped on the mail so the right recruiter owns it.</li>
          <li>3. Enterprise can verify a sending domain so From is noreply@yourcompany.com. Until then, From is the product address.</li>
        </ol>
      </div>

      <div className="card-ats-bordered relative overflow-hidden p-4 sm:p-5">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <h2 className="relative flex items-center gap-2 text-[15px] font-bold text-stone-900">
          <Gauge className="h-4 w-4 text-brand-600" /> Usage
        </h2>
        <p className="relative mt-2 text-sm font-semibold text-stone-900">{plan}</p>
        <p className="relative mt-1 break-words text-sm text-stone-600">
          {unlimited
            ? `${used.toLocaleString()} emails this billing period. No monthly cap.`
            : `${used.toLocaleString()} of ${limit.toLocaleString()} emails this billing period`}
        </p>
        {!unlimited ? (
          <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-stone-100">
            <div className="h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
          </div>
        ) : null}
        {reset && !Number.isNaN(reset.getTime()) ? (
          <p className="relative mt-2 text-[11px] text-stone-400">
            Allowance typically resets around {reset.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}.
          </p>
        ) : null}
      </div>

      <div className="card-ats-bordered relative overflow-hidden p-4 sm:p-5">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <h2 className="relative flex items-center gap-2 text-[15px] font-bold text-stone-900">
          <Activity className="h-4 w-4 text-brand-600" /> Recent changes
        </h2>
        {auditLog.length ? (
          <ul className="relative mt-3 space-y-2.5">
            {auditLog.slice(0, 8).map((row, idx) => (
              <li key={`${row.at}-${idx}`} className="min-w-0 text-xs text-stone-600">
                <p className="break-words font-semibold text-stone-800">{row.detail || row.action}</p>
                <p className="break-words text-stone-400">
                  {row.actorName || 'Administrator'}
                  {row.at ? ` · ${new Date(row.at).toLocaleString()}` : ''}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="relative mt-2 text-xs text-stone-500">No identity or domain changes recorded yet.</p>
        )}
      </div>
    </aside>
  );
}
