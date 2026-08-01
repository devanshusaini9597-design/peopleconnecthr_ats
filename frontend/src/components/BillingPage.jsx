import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CreditCard, Check, Zap, Users, Briefcase, Mail, ArrowRight, ShieldCheck,
  Loader2, Sparkles, Building2, Receipt, Lock, Headphones, FileCheck2,
  Layers, ClipboardList, BarChart3, AlertTriangle
} from 'lucide-react';
import PageHeader from './ui/PageHeader';
import { authenticatedFetch, handleUnauthorized, readApiJson } from '../utils/fetchUtils';
import { useToast } from './Toast';

const PLAN_FEATURES = {
  starter: [
    'Core ATS workspace',
    'Jobs, candidates & pipeline',
    'Basic analytics',
    'Email outreach',
    'Team seats (plan limit)',
  ],
  professional: [
    'Everything in Starter',
    'Talent pools & assessments',
    'Custom pipelines',
    'Advanced analytics & audit log',
    'Calendar + BYO email',
    'AI scoring assist',
  ],
  enterprise: [
    'Everything in Professional',
    'SSO & custom roles',
    'White-label careers site',
    'WhatsApp, e-sign, background checks',
    'Webhooks, Zapier & job boards',
    'Dedicated success support',
  ],
};

const PLAN_META = {
  starter: {
    icon: Briefcase,
    accent: 'from-stone-700 to-stone-900',
    ring: 'ring-stone-200',
    chip: 'bg-stone-100 text-stone-700',
    blurb: 'For lean recruiting teams getting organized.',
  },
  professional: {
    icon: Zap,
    accent: 'from-brand-600 to-teal-700',
    ring: 'ring-brand-200',
    chip: 'bg-brand-50 text-brand-700',
    blurb: 'For growing teams that need depth and automation.',
    highlight: true,
  },
  enterprise: {
    icon: Building2,
    accent: 'from-slate-800 to-stone-950',
    ring: 'ring-slate-200',
    chip: 'bg-slate-100 text-slate-700',
    blurb: 'For agencies and multi-brand hiring orgs.',
  },
};

const UsageBar = ({ label, current = 0, max, icon: Icon, tone = 'brand' }) => {
  const unlimited = !max || max <= 0 || max >= 999999;
  const pct = unlimited ? 8 : Math.min(100, Math.round((current / max) * 100));
  const hot = !unlimited && pct >= 85;
  const warm = !unlimited && pct >= 60 && pct < 85;
  const bar =
    hot ? 'bg-red-500' : warm ? 'bg-amber-500' : tone === 'emerald' ? 'bg-emerald-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-brand-500';

  return (
    <div className="rounded-2xl border border-stone-200/80 bg-white p-4 sm:p-5 hover:border-brand-200/70 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-stone-50 border border-stone-100 flex items-center justify-center flex-shrink-0">
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
        {!unlimited && (
          <span className={`text-xs font-bold tabular-nums ${hot ? 'text-red-600' : warm ? 'text-amber-600' : 'text-stone-500'}`}>
            {pct}%
          </span>
        )}
      </div>
      <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${bar} transition-all duration-700 ease-out`}
          style={{ width: `${unlimited ? 12 : pct}%` }}
        />
      </div>
      {hot && (
        <p className="mt-2 text-xs font-medium text-red-600 flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5" /> Approaching limit — consider upgrading
        </p>
      )}
    </div>
  );
};

export default function BillingPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [plans, setPlans] = useState([]);
  const [busyPlan, setBusyPlan] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [statusRes, plansRes] = await Promise.all([
        authenticatedFetch('/api/billing/status'),
        authenticatedFetch('/api/billing/plans'),
      ]);
      if (statusRes.status === 401 || plansRes.status === 401) return handleUnauthorized();

      const statusData = await readApiJson(statusRes);
      const plansData = await readApiJson(plansRes);
      if (statusData.success) setStatus(statusData.data);
      if (plansData.success) setPlans(plansData.data);
    } catch {
      toast?.error?.('Failed to load billing info');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get('checkout');
    if (checkout === 'success') {
      toast?.success?.('Subscription updated! It may take a few seconds to reflect.');
      window.history.replaceState({}, '', '/billing');
      setTimeout(load, 2000);
    } else if (checkout === 'cancelled') {
      toast?.info?.('Checkout cancelled.');
      window.history.replaceState({}, '', '/billing');
    }
  }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpgrade = async (planId) => {
    setBusyPlan(planId);
    try {
      const res = await authenticatedFetch('/api/billing/create-checkout', {
        method: 'POST',
        body: JSON.stringify({ planId }),
      });
      const data = await readApiJson(res);
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Could not start checkout');
        return;
      }
      window.location.href = data.url;
    } catch {
      toast?.error?.('Could not start checkout');
    } finally {
      setBusyPlan(null);
    }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const res = await authenticatedFetch('/api/billing/portal');
      const data = await readApiJson(res);
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Could not open billing portal');
        return;
      }
      window.location.href = data.url;
    } catch {
      toast?.error?.('Could not open billing portal');
    } finally {
      setPortalLoading(false);
    }
  };

  const currentPlan = status?.plan || 'free_trial';
  const usage = status?.usage || {};
  const limits = status?.limits || {};
  const currentPlanMeta = useMemo(
    () => plans.find((p) => p.id === currentPlan),
    [plans, currentPlan]
  );
  const paidPlans = useMemo(
    () => plans.filter((p) => p.id !== 'free_trial'),
    [plans]
  );

  const planDisplayName = currentPlanMeta?.name
    || String(currentPlan).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  if (loading) {
    return (
      <div className="page-shell-ats">
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-9 h-9 text-brand-600 animate-spin" />
          <p className="text-sm font-medium text-stone-500">Loading billing…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell-ats max-w-6xl">
      <PageHeader
        icon={CreditCard}
        title="Billing & Plans"
        subtitle="Subscription, usage, and plan upgrades — secured by Stripe."
        gradientTitle
      >
        <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-emerald-800 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200/80">
          <ShieldCheck className="w-4 h-4" /> Stripe-secured checkout
        </div>
      </PageHeader>

      {!status?.stripeConfigured && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 text-amber-900 p-4 sm:p-5 text-sm flex gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Billing isn’t fully configured</p>
            <p className="mt-1 text-amber-800/90 leading-relaxed">
              Stripe keys are missing on the server. Plan changes and checkout stay unavailable until an admin sets{' '}
              <code className="text-xs bg-amber-100/80 px-1.5 py-0.5 rounded">STRIPE_SECRET_KEY</code> in the backend environment.
            </p>
          </div>
        </div>
      )}

      {/* Hero subscription card */}
      <section className="relative overflow-hidden rounded-3xl border border-stone-800/10 bg-stone-950 text-white shadow-xl">
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
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-brand-200">
                <Sparkles className="w-3.5 h-3.5" /> Current plan
              </span>
              {status?.planExpiresAt && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 border border-amber-300/30 px-3 py-1 text-xs font-semibold text-amber-200">
                  Trial ends {new Date(status.planExpiresAt).toLocaleDateString()}
                </span>
              )}
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ letterSpacing: '-0.03em' }}>
              {planDisplayName}
            </h2>
            <p className="mt-2 text-stone-400 text-sm sm:text-base max-w-xl leading-relaxed">
              {status?.subscription?.subscriptionId
                ? 'Your paid subscription is active. Manage invoices, payment method, and cancellation in the customer portal.'
                : 'You’re on a trial or unpaid plan. Upgrade anytime — usage meters below show how close you are to limits.'}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {[
                { icon: Layers, label: 'Talent pools' },
                { icon: ClipboardList, label: 'Assessments' },
                { icon: BarChart3, label: 'Analytics' },
              ].map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 text-xs font-medium text-stone-300"
                >
                  <Icon className="w-3.5 h-3.5 text-brand-300" /> {label}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-end gap-3 flex-shrink-0">
            {currentPlanMeta?.price != null && (
              <div className="text-left sm:text-right lg:text-right">
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Monthly</p>
                <p className="text-3xl font-bold tabular-nums">
                  ${currentPlanMeta.price}
                  <span className="text-base font-medium text-stone-400">/mo</span>
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={handlePortal}
              disabled={portalLoading || !status?.subscription?.customerId}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white text-stone-900 font-semibold px-5 py-3 hover:bg-stone-100 transition-colors disabled:opacity-45 disabled:cursor-not-allowed shadow-lg shadow-black/20"
              title={!status?.subscription?.customerId ? 'Subscribe to a paid plan first' : 'Open Stripe billing portal'}
            >
              <Receipt className="w-4 h-4" />
              {portalLoading ? 'Opening…' : 'Manage subscription'}
            </button>
          </div>
        </div>
      </section>

      {/* Usage */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-stone-900 tracking-tight">Usage this period</h3>
            <p className="text-sm text-stone-500 mt-0.5">Live counts against your plan entitlements.</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <UsageBar label="Active jobs" current={usage.jobs || 0} max={limits.maxJobs} icon={Briefcase} />
          <UsageBar label="Team members" current={usage.users || 0} max={limits.maxUsers} icon={Users} />
          <UsageBar label="Candidates" current={usage.candidates || 0} max={limits.maxCandidates} icon={Users} tone="emerald" />
          <UsageBar label="Emails sent" current={usage.emailsSent || 0} max={limits.maxEmailsPerMonth} icon={Mail} tone="amber" />
        </div>
      </section>

      {/* Plans */}
      <section className="space-y-6 pt-2">
        <div className="text-center max-w-2xl mx-auto">
          <h3 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight" style={{ letterSpacing: '-0.025em' }}>
            Choose the workspace that fits your hiring volume
          </h3>
          <p className="text-stone-500 mt-2 text-sm sm:text-base leading-relaxed">
            Upgrade instantly. Downgrade or cancel anytime from the Stripe portal — no lock-in contracts on self-serve plans.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 lg:gap-6">
          {paidPlans.map((plan) => {
            const meta = PLAN_META[plan.id] || PLAN_META.starter;
            const Icon = meta.icon;
            const isCurrent = plan.id === currentPlan;
            const isEnterprise = plan.id === 'enterprise';
            const features = PLAN_FEATURES[plan.id] || [];
            const featured = !!meta.highlight && !isCurrent;

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-3xl border bg-white p-6 sm:p-7 transition-all duration-300 ${
                  isCurrent
                    ? 'border-brand-500 shadow-lg shadow-brand-500/10 ring-2 ring-brand-500/20'
                    : featured
                      ? 'border-brand-300/80 shadow-xl shadow-brand-900/5 scale-[1.02] md:-translate-y-1'
                      : 'border-stone-200/90 hover:border-brand-200 hover:shadow-md'
                }`}
              >
                {featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-brand-600 to-teal-600 text-white text-[11px] font-bold uppercase tracking-wide px-3 py-1 shadow-md">
                      <Sparkles className="w-3 h-3" /> Most popular
                    </span>
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex rounded-full bg-brand-600 text-white text-[11px] font-bold uppercase tracking-wide px-3 py-1 shadow-md">
                      Your plan
                    </span>
                  </div>
                )}

                <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${meta.accent} text-white flex items-center justify-center shadow-md mb-4`}>
                  <Icon className="w-5 h-5" />
                </div>

                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-xl font-bold text-stone-900 tracking-tight">{plan.name}</h4>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${meta.chip}`}>
                    {isEnterprise ? 'Custom' : 'Billed monthly'}
                  </span>
                </div>
                <p className="text-sm text-stone-500 leading-relaxed mb-5">{meta.blurb}</p>

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
                    <li key={f} className="flex items-start gap-2.5 text-sm text-stone-700">
                      <span className="mt-0.5 w-5 h-5 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0">
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
                    href="mailto:sales@skillnix.example?subject=Enterprise%20plan%20inquiry"
                    className="btn-secondary w-full"
                  >
                    <Headphones className="w-4 h-4" /> Contact sales
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={busyPlan === plan.id || !plan.checkoutEnabled}
                    className={`w-full disabled:opacity-50 ${featured ? 'btn-primary' : 'btn-secondary'}`}
                    title={!plan.checkoutEnabled ? 'This plan is not configured for self-serve checkout yet' : ''}
                  >
                    {busyPlan === plan.id ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Redirecting…</>
                    ) : (
                      <>Upgrade to {plan.name} <ArrowRight className="w-4 h-4" /></>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Trust / ops strip */}
      <section className="grid sm:grid-cols-3 gap-3 sm:gap-4">
        {[
          { icon: Lock, title: 'Secure payments', body: 'Card data never touches our servers — Stripe handles PCI.' },
          { icon: FileCheck2, title: 'Invoices on demand', body: 'Download receipts and tax invoices from the customer portal.' },
          { icon: Headphones, title: 'Human support', body: 'Enterprise plans include dedicated onboarding and success.' },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-2xl border border-stone-200/80 bg-stone-50/60 p-4 sm:p-5">
            <div className="w-9 h-9 rounded-xl bg-white border border-stone-200 flex items-center justify-center mb-3">
              <Icon className="w-4 h-4 text-brand-600" />
            </div>
            <p className="font-bold text-stone-900 text-sm">{title}</p>
            <p className="text-xs text-stone-500 mt-1 leading-relaxed">{body}</p>
          </div>
        ))}
      </section>

      {status?.subscription?.subscriptionId && (
        <div className="text-center pb-2">
          <button
            type="button"
            onClick={handlePortal}
            className="text-sm text-stone-500 hover:text-stone-800 underline underline-offset-4 transition-colors"
          >
            Cancel or change plan via billing portal
          </button>
        </div>
      )}
    </div>
  );
}
