import React from 'react';
import {
  CreditCard, Zap, Users, Briefcase, Receipt, Sparkles,
  Layers, ClipboardList, Calendar, Clock, Gauge,
} from 'lucide-react';

/** KPI strip + upgrade steps + hero subscription card */
export function BillingOverview({
  currentPlan,
  trialDaysLeft,
  periodDaysLeft,
  remUsers,
  remJobs,
  remCandidates,
  status,
  organization,
  planDisplayName,
  currentPlanMeta,
  includedFeatureCount,
  canUpgrade,
  portalLoading,
  cancelBusy,
  onScrollToPlans,
  onPortal,
  onCancel,
}) {
  return (
    <>
      {/* KPI strip — days + remaining */}
      <div data-tour="billing-kpis" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-stone-200 bg-white px-4 py-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold text-stone-900 tabular-nums leading-none">
              {trialDaysLeft != null
                ? trialDaysLeft
                : periodDaysLeft != null
                  ? periodDaysLeft
                  : '—'}
            </p>
            <p className="text-[11px] text-stone-500 mt-1 truncate">
              {currentPlan === 'free_trial'
                ? 'Days left in trial'
                : periodDaysLeft != null
                  ? 'Days until renewal'
                  : 'Billing cycle'}
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white px-4 py-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold text-stone-900 tabular-nums leading-none">
              {remUsers == null ? '∞' : remUsers}
            </p>
            <p className="text-[11px] text-stone-500 mt-1 truncate">Seats remaining</p>
          </div>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white px-4 py-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center flex-shrink-0">
            <Briefcase className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold text-stone-900 tabular-nums leading-none">
              {remJobs == null ? '∞' : remJobs}
            </p>
            <p className="text-[11px] text-stone-500 mt-1 truncate">Jobs remaining</p>
          </div>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white px-4 py-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <Gauge className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold text-stone-900 tabular-nums leading-none">
              {remCandidates == null ? '∞' : remCandidates.toLocaleString()}
            </p>
            <p className="text-[11px] text-stone-500 mt-1 truncate">Candidates remaining</p>
          </div>
        </div>
      </div>

      {/* How to upgrade */}
      <div className="grid sm:grid-cols-3 gap-3">
        {[
          {
            step: '1',
            icon: Gauge,
            title: 'Check capacity',
            body: 'Review days left and remaining seats, jobs, and candidates above.',
            tone: 'bg-brand-50 text-brand-600',
          },
          {
            step: '2',
            icon: Zap,
            title: 'Choose a plan',
            body: 'Scroll to plans — Starter ($29) or Professional ($99). Enterprise is sales-quoted.',
            tone: 'bg-sky-50 text-sky-600',
          },
          {
            step: '3',
            icon: CreditCard,
            title: 'Checkout on Stripe',
            body: 'Pay securely. Limits and feature gates update automatically after payment.',
            tone: 'bg-violet-50 text-violet-600',
          },
        ].map(({ step, icon: Icon, title, body, tone }) => (
          <div key={title} className="rounded-xl border border-stone-200 bg-white px-4 py-3.5 relative">
            <span className="absolute top-3 right-3 text-[11px] font-bold text-stone-300 tabular-nums">STEP {step}</span>
            <div className={`w-9 h-9 rounded-xl ${tone} flex items-center justify-center mb-2.5`}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-sm font-bold text-stone-900">{title}</p>
            <p className="text-[12px] text-stone-500 mt-1 leading-relaxed">{body}</p>
          </div>
        ))}
      </div>

      {/* Hero subscription card */}
      <section
        data-tour="billing-current"
        className="billing-hero relative overflow-hidden rounded-3xl border border-stone-800/10 bg-stone-950 text-white shadow-xl"
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 -right-16 w-80 h-80 rounded-full bg-brand-500/25 blur-3xl" />
          <div className="absolute -bottom-28 -left-10 w-72 h-72 rounded-full bg-teal-400/15 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
              backgroundSize: '22px 22px',
            }}
          />
        </div>

        <div className="relative z-10 p-6 sm:p-8 lg:p-10 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="billing-hero-chip inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-brand-200">
                <Sparkles className="w-3.5 h-3.5" /> Current plan
              </span>
              {currentPlan === 'free_trial' && trialDaysLeft != null && (
                <span className="billing-hero-chip inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 border border-amber-300/30 px-3 py-1 text-xs font-semibold text-amber-200">
                  <Calendar className="w-3.5 h-3.5" />
                  {trialDaysLeft} day{trialDaysLeft === 1 ? '' : 's'} left in trial
                </span>
              )}
              {status?.subscription?.cancelAtPeriodEnd && (
                <span className="billing-hero-chip inline-flex items-center gap-1.5 rounded-full bg-red-400/15 border border-red-300/30 px-3 py-1 text-xs font-semibold text-red-200">
                  Cancels {status.subscription.currentPeriodEnd
                    ? new Date(status.subscription.currentPeriodEnd).toLocaleDateString()
                    : 'at period end'}
                </span>
              )}
              {status?.subscription?.status && status.subscription.status !== 'active' && (
                <span className="billing-hero-chip inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 border border-amber-300/30 px-3 py-1 text-xs font-semibold text-amber-200 capitalize">
                  {status.subscription.status.replace(/_/g, ' ')}
                </span>
              )}
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ letterSpacing: '-0.03em' }}>
              {planDisplayName}
            </h2>
            <p className="mt-2 text-stone-400 text-sm sm:text-base max-w-xl leading-relaxed">
              {status?.subscription?.subscriptionId
                ? 'Paid subscription active. Manage payment method, invoices, and cancellation in the Stripe portal.'
                : currentPlan === 'free_trial'
                  ? `You’re on a trial${trialDaysLeft != null ? ` with ${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'} left` : ''}. Upgrade before it ends to keep Professional-level access.`
                  : 'Usage meters show remaining capacity. Upgrade anytime for higher ceilings and more features.'}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {[
                { icon: Layers, label: `${includedFeatureCount} entitlements` },
                { icon: ClipboardList, label: remJobs == null ? 'Unlimited jobs' : `${remJobs} jobs left` },
                { icon: Users, label: remUsers == null ? 'Unlimited seats' : `${remUsers} seats left` },
              ].map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="billing-hero-chip inline-flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 text-xs font-medium text-stone-300"
                >
                  <Icon className="w-3.5 h-3.5 text-brand-300" /> {label}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-end gap-3 flex-shrink-0">
            {currentPlanMeta?.price != null && (
              <div className="text-left sm:text-right lg:text-right">
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                  {currentPlan === 'free_trial' ? 'After trial' : 'Monthly'}
                </p>
                <p className="text-3xl font-bold tabular-nums">
                  {currentPlan === 'free_trial' ? (
                    <span className="text-2xl">from $29<span className="text-base font-medium text-stone-400">/mo</span></span>
                  ) : (
                    <>
                      ${currentPlanMeta.price}
                      <span className="text-base font-medium text-stone-400">/mo</span>
                    </>
                  )}
                </p>
                {status?.subscription?.currentPeriodEnd && (
                  <p className="text-xs text-stone-500 mt-1">
                    Renews {new Date(status.subscription.currentPeriodEnd).toLocaleDateString()}
                    {periodDaysLeft != null ? ` · ${periodDaysLeft}d left` : ''}
                  </p>
                )}
                {currentPlan === 'free_trial' && (status?.planExpiresAt || organization?.planExpiresAt) && (
                  <p className="text-xs text-amber-200/80 mt-1">
                    Trial ends {new Date(status?.planExpiresAt || organization.planExpiresAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}
            {canUpgrade ? (
              <button
                type="button"
                onClick={onScrollToPlans}
                className="billing-hero-cta inline-flex items-center justify-center gap-2 rounded-xl bg-white text-stone-900 font-semibold px-5 py-3 hover:bg-stone-100 shadow-lg shadow-black/20"
              >
                <Zap className="w-4 h-4" />
                Upgrade now
              </button>
            ) : (
              <button
                type="button"
                onClick={onPortal}
                disabled={portalLoading || !status?.subscription?.customerId}
                className="billing-hero-cta inline-flex items-center justify-center gap-2 rounded-xl bg-white text-stone-900 font-semibold px-5 py-3 hover:bg-stone-100 disabled:opacity-45 disabled:cursor-not-allowed shadow-lg shadow-black/20"
                title={!status?.subscription?.customerId ? 'No Stripe customer yet' : 'Open Stripe billing portal'}
              >
                <Receipt className="w-4 h-4" />
                {portalLoading ? 'Opening…' : 'Manage subscription'}
              </button>
            )}
            {status?.subscription?.subscriptionId && !status?.subscription?.cancelAtPeriodEnd && (
              <button
                type="button"
                onClick={onCancel}
                disabled={cancelBusy}
                className="text-xs text-stone-400 hover:text-white underline underline-offset-4 disabled:opacity-50"
              >
                {cancelBusy ? 'Scheduling…' : 'Cancel at period end'}
              </button>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
