import React from 'react';
import {
  Check, ArrowRight, Headphones, Sparkles, Loader2,
} from 'lucide-react';
import {
  PLAN_LIMITS, PLAN_FEATURES, PLAN_META, formatLimit,
} from './billingConstants';

export function PlanCards({
  paidPlans,
  currentPlan,
  busyPlan,
  stripeReady,
  showStripeMissing,
  onUpgrade,
}) {
  return (
    <div className="grid md:grid-cols-3 gap-5 lg:gap-6 stagger-children">
      {paidPlans.map((plan) => {
        const meta = PLAN_META[plan.id] || PLAN_META.starter;
        const Icon = meta.icon;
        const isCurrent = plan.id === currentPlan;
        const isEnterprise = plan.id === 'enterprise';
        const features = PLAN_FEATURES[plan.id] || [];
        const featured = !!meta.highlight && !isCurrent;
        const planLimits = plan.limits || PLAN_LIMITS[plan.id] || {};
        const checkoutOk = plan.checkoutEnabled !== false || stripeReady;

        const onMove = (e) => {
          const el = e.currentTarget;
          const r = el.getBoundingClientRect();
          el.style.setProperty('--mx', `${e.clientX - r.left}px`);
          el.style.setProperty('--my', `${e.clientY - r.top}px`);
        };

        return (
          <div
            key={plan.id}
            onMouseMove={onMove}
            className={`billing-plan-card relative flex flex-col rounded-3xl border bg-white p-6 sm:p-7 ${
              isCurrent
                ? 'is-current border-brand-500 shadow-lg shadow-brand-500/10 ring-2 ring-brand-500/20'
                : featured
                  ? 'is-featured border-brand-300/80 shadow-xl shadow-brand-900/5 scale-[1.02] md:-translate-y-1'
                  : 'border-stone-200/90'
            }`}
          >
            {featured && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-brand-600 to-teal-600 text-white text-[11px] font-bold uppercase tracking-wide px-3 py-1 shadow-md">
                  <Sparkles className="w-3 h-3" /> Most popular
                </span>
              </div>
            )}
            {isCurrent && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                <span className="inline-flex rounded-full bg-brand-600 text-white text-[11px] font-bold uppercase tracking-wide px-3 py-1 shadow-md">
                  Your plan
                </span>
              </div>
            )}

            <div className={`billing-plan-icon w-11 h-11 rounded-2xl bg-gradient-to-br ${meta.accent} text-white flex items-center justify-center shadow-md mb-4`}>
              <Icon className="w-5 h-5" />
            </div>

            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-xl font-bold text-stone-900 tracking-tight">{plan.name}</h4>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${meta.chip}`}>
                {isEnterprise ? 'Custom' : 'Billed monthly'}
              </span>
            </div>
            <p className="text-sm text-stone-500 leading-relaxed mb-4">{meta.blurb}</p>

            <div className="mb-4 flex flex-wrap gap-1.5">
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-stone-50 text-stone-600 border border-stone-100">
                {formatLimit(planLimits.maxUsers)} seats
              </span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-stone-50 text-stone-600 border border-stone-100">
                {formatLimit(planLimits.maxJobs)} jobs
              </span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-stone-50 text-stone-600 border border-stone-100">
                {plan.entitlementCount ?? '—'} features
              </span>
            </div>

            <div className="mb-6">
              {plan.price != null ? (
                <p className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-stone-900 tracking-tight tabular-nums">${plan.price}</span>
                  <span className="text-stone-500 font-medium">/month</span>
                </p>
              ) : (
                <p className="text-4xl font-bold text-stone-900 tracking-tight">Custom</p>
              )}
            </div>

            <ul className="space-y-2.5 mb-7 flex-1">
              {features.map((f) => (
                <li key={f} className="billing-plan-feature flex items-start gap-2.5 text-sm text-stone-700">
                  <span className="billing-plan-check mt-0.5 w-5 h-5 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3" strokeWidth={3} />
                  </span>
                  <span className="leading-snug">{f}</span>
                </li>
              ))}
            </ul>

            {isCurrent ? (
              <button type="button" disabled className="btn-secondary w-full opacity-70 cursor-default">
                Current plan
              </button>
            ) : isEnterprise ? (
              <a
                href="mailto:sales@skillnix.app?subject=Enterprise%20plan%20inquiry"
                className="btn-secondary w-full group/cta"
              >
                <Headphones className="w-4 h-4" /> Contact sales
                <ArrowRight className="billing-plan-cta-arrow w-4 h-4" />
              </a>
            ) : (
              <button
                type="button"
                onClick={() => onUpgrade(plan.id)}
                disabled={busyPlan === plan.id}
                className={`w-full disabled:opacity-50 ${featured ? 'btn-primary' : 'btn-secondary'}`}
                title={!checkoutOk && showStripeMissing ? 'Stripe checkout not configured on server yet' : `Upgrade to ${plan.name}`}
              >
                {busyPlan === plan.id ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Redirecting…</>
                ) : (
                  <>Upgrade to {plan.name} <ArrowRight className="billing-plan-cta-arrow w-4 h-4" /></>
                )}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
