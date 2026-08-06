import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  CreditCard, Zap, Users, Briefcase, Mail, ShieldCheck,
  Loader2, Lock, Headphones, FileCheck2, ClipboardList,
  AlertTriangle, Info, RefreshCw,
} from 'lucide-react';
import PageHeader from './ui/PageHeader';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import usePageTour from '../hooks/usePageTour';
import { useAuth } from '../context/AuthContext';
import { authenticatedFetch, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';
import { FEATURES, planHasFeature, getEntitlements } from '../config/planFeatures';
import {
  BILLING_TOUR_KEY, BILLING_TOUR_STEPS, PLAN_LIMITS, FALLBACK_PLANS,
  daysUntil, remainingOf, safeJson,
} from './billing/billingConstants';
import { UsageBar } from './billing/UsageBar';
import { PlanComparisonTable, InvoicesSection } from './billing/BillingSections';
import { BillingOverview } from './billing/BillingOverview';
import { PlanCards } from './billing/PlanCards';

export default function BillingPage() {
  const toast = useToast();
  const { organization, refreshProfile } = useAuth();
  const [tourOpen, setTourOpen] = usePageTour(BILLING_TOUR_KEY);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [plans, setPlans] = useState(FALLBACK_PLANS);
  const [invoices, setInvoices] = useState([]);
  const [busyPlan, setBusyPlan] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [loadWarning, setLoadWarning] = useState(null);
  const lastToast = useRef('');
  const plansRef = useRef(null);

  const seedFromOrg = useCallback(() => {
    if (!organization) return null;
    const plan = organization.plan || 'free_trial';
    const expires = organization.planExpiresAt;
    return {
      plan,
      planExpiresAt: expires || null,
      trialDaysLeft: plan === 'free_trial' ? daysUntil(expires) : null,
      usage: organization.usageCurrent || {},
      limits: organization.usageLimits || PLAN_LIMITS[plan] || PLAN_LIMITS.starter,
      entitlementCount: getEntitlements(plan).length,
      stripeConfigured: null,
      subscription: {
        customerId: null,
        subscriptionId: null,
        status: null,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
      },
      _fromAuth: true,
    };
  }, [organization]);

  const load = useCallback(async () => {
    setLoadWarning(null);
    const seeded = seedFromOrg();
    if (seeded) setStatus((prev) => prev || seeded);

    try {
      const [statusRes, plansRes] = await Promise.all([
        authenticatedFetch('/api/billing/status'),
        authenticatedFetch('/api/billing/plans'),
      ]);

      if (statusRes.status === 401 || plansRes.status === 401) return handleUnauthorized();

      const statusData = await safeJson(statusRes);
      const plansData = await safeJson(plansRes);

      if (statusRes.ok && statusData.success && statusData.data) {
        setStatus(statusData.data);
      } else if (seeded) {
        setStatus(seeded);
        if (!statusRes.ok) {
          setLoadWarning('Live billing status unavailable — showing org plan & usage from your session.');
        }
      } else {
        setLoadWarning(statusData.message || 'Could not load billing status.');
      }

      if (plansRes.ok && plansData.success && Array.isArray(plansData.data) && plansData.data.length) {
        setPlans(plansData.data.map((p) => ({
          ...p,
          limits: p.limits || PLAN_LIMITS[p.id] || PLAN_LIMITS.starter,
          entitlementCount: p.entitlementCount ?? getEntitlements(p.id === 'free_trial' ? 'professional' : p.id).length,
        })));
      } else {
        setPlans(FALLBACK_PLANS);
      }

      // Invoices are optional — never block the page (endpoint may not be deployed yet).
      try {
        const invRes = await authenticatedFetch('/api/billing/invoices');
        if (invRes.ok) {
          const invData = await safeJson(invRes);
          if (invData.success) setInvoices(invData.data || []);
        }
      } catch {
        /* ignore */
      }
    } catch {
      if (seeded) {
        setStatus(seeded);
        setPlans(FALLBACK_PLANS);
        setLoadWarning('Billing API unreachable — showing plan & usage from your session.');
      } else {
        const msg = 'Failed to load billing info';
        if (lastToast.current !== msg) {
          lastToast.current = msg;
          toast?.error?.(msg);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [seedFromOrg]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get('checkout');
    if (checkout === 'success') {
      toast?.success?.('Subscription updated! It may take a few seconds to reflect.');
      window.history.replaceState({}, '', '/billing');
      setTimeout(() => {
        load();
        refreshProfile?.();
      }, 2000);
    } else if (checkout === 'cancelled') {
      toast?.info?.('Checkout cancelled.');
      window.history.replaceState({}, '', '/billing');
    }
  }, [load, refreshProfile]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpgrade = async (planId) => {
    setBusyPlan(planId);
    try {
      const res = await authenticatedFetch('/api/billing/create-checkout', {
        method: 'POST',
        body: JSON.stringify({ planId }),
      });
      const data = await safeJson(res);
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Could not start checkout. Stripe may not be configured yet.');
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
      const data = await safeJson(res);
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

  const handleCancel = async () => {
    if (!window.confirm('Schedule cancellation at the end of the current billing period? You keep access until then.')) {
      return;
    }
    setCancelBusy(true);
    try {
      const res = await authenticatedFetch('/api/billing/cancel', { method: 'POST' });
      const data = await safeJson(res);
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Could not schedule cancellation');
        return;
      }
      toast?.success?.(data.message || 'Cancellation scheduled');
      load();
    } catch {
      toast?.error?.('Could not schedule cancellation');
    } finally {
      setCancelBusy(false);
    }
  };

  const scrollToPlans = () => {
    plansRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const currentPlan = status?.plan || organization?.plan || 'free_trial';
  const usage = status?.usage || organization?.usageCurrent || {};
  const limits = status?.limits || organization?.usageLimits || PLAN_LIMITS[currentPlan] || PLAN_LIMITS.starter;

  const catalog = plans.length ? plans : FALLBACK_PLANS;
  const currentPlanMeta = useMemo(
    () => catalog.find((p) => p.id === currentPlan),
    [catalog, currentPlan]
  );
  const paidPlans = useMemo(
    () => catalog.filter((p) => p.id !== 'free_trial'),
    [catalog]
  );

  const planDisplayName = currentPlanMeta?.name
    || String(currentPlan).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const trialDaysLeft = useMemo(() => {
    if (status?.trialDaysLeft != null) return status.trialDaysLeft;
    if (currentPlan === 'free_trial') return daysUntil(status?.planExpiresAt || organization?.planExpiresAt);
    return null;
  }, [status, organization, currentPlan]);

  const periodDaysLeft = useMemo(() => {
    if (status?.subscription?.currentPeriodEnd) return daysUntil(status.subscription.currentPeriodEnd);
    return null;
  }, [status]);

  const includedFeatureCount = useMemo(() => {
    if (status?.entitlementCount != null) return status.entitlementCount;
    return Object.keys(FEATURES).filter((k) => planHasFeature(currentPlan, k)).length;
  }, [status, currentPlan]);

  const remUsers = remainingOf(usage.users, limits.maxUsers);
  const remJobs = remainingOf(usage.jobs, limits.maxJobs);
  const remCandidates = remainingOf(usage.candidates, limits.maxCandidates);

  const canUpgrade = currentPlan === 'free_trial' || currentPlan === 'starter';
  const stripeReady = status?.stripeConfigured === true;
  const showStripeMissing = status && status.stripeConfigured === false && !status._fromAuth;

  if (loading && !status) {
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
    <div className="page-shell-ats max-w-6xl animate-page-enter">
      <PageHeader
        icon={CreditCard}
        title="Billing & Plans"
        subtitle="Plan, remaining capacity, days left, and upgrades — Stripe-secured."
        gradientTitle
      >
        <button
          type="button"
          onClick={() => { setLoading(true); load(); }}
          className="h-10 w-10 inline-flex items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 hover:text-brand-600 hover:border-brand-300"
          title="Refresh"
          aria-label="Refresh billing"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
        {canUpgrade && (
          <button type="button" onClick={scrollToPlans} className="btn-primary flex-1 sm:flex-none">
            <Zap className="w-4 h-4" /> Upgrade plan
          </button>
        )}
        <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-emerald-800 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200/80">
          <ShieldCheck className="w-4 h-4" /> Stripe-secured
        </div>
      </PageHeader>

      <div
        data-tour="billing-tip"
        className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed flex flex-wrap items-center gap-x-3 gap-y-1.5"
      >
        <span className="inline-flex items-center gap-1.5 text-brand-700 font-semibold">
          <Info size={14} /> Tip
        </span>
        <span>
          Watch <span className="font-semibold text-stone-800">days left</span> and{' '}
          <span className="font-semibold text-stone-800">remaining limits</span>, then upgrade below.
          Press <span className="font-semibold text-stone-800">?</span> for a tour.
        </span>
      </div>

      {loadWarning && (
        <div className="rounded-xl border border-sky-200 bg-sky-50/80 text-sky-900 px-4 py-3 text-sm flex gap-2.5">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>{loadWarning}</p>
        </div>
      )}

      {showStripeMissing && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 text-amber-900 p-4 sm:p-5 text-sm flex gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Checkout not enabled yet</p>
            <p className="mt-1 text-amber-800/90 leading-relaxed">
              Stripe keys are missing on the server. You can still review plan, remaining limits, and days left.
              Self-serve upgrade unlocks when an admin sets{' '}
              <code className="text-xs bg-amber-100/80 px-1.5 py-0.5 rounded">STRIPE_SECRET_KEY</code> and price IDs.
            </p>
          </div>
        </div>
      )}

      <BillingOverview
        currentPlan={currentPlan}
        trialDaysLeft={trialDaysLeft}
        periodDaysLeft={periodDaysLeft}
        remUsers={remUsers}
        remJobs={remJobs}
        remCandidates={remCandidates}
        status={status}
        organization={organization}
        planDisplayName={planDisplayName}
        currentPlanMeta={currentPlanMeta}
        includedFeatureCount={includedFeatureCount}
        canUpgrade={canUpgrade}
        portalLoading={portalLoading}
        cancelBusy={cancelBusy}
        onScrollToPlans={scrollToPlans}
        onPortal={handlePortal}
        onCancel={handleCancel}
      />

      {/* Usage */}
      <section data-tour="billing-usage" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-stone-900 tracking-tight">Usage & remaining capacity</h3>
            <p className="text-sm text-stone-500 mt-0.5">
              Each meter shows used / ceiling and how much you have left. Hitting a limit blocks new creates until you upgrade.
            </p>
          </div>
          {canUpgrade && (
            <button type="button" onClick={scrollToPlans} className="text-sm font-semibold text-brand-600 hover:text-brand-700">
              Need more? Upgrade →
            </button>
          )}
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 stagger-children">
          <UsageBar label="Active jobs" current={usage.jobs || 0} max={limits.maxJobs} icon={Briefcase} />
          <UsageBar label="Team members" current={usage.users || 0} max={limits.maxUsers} icon={Users} />
          <UsageBar label="Candidates" current={usage.candidates || 0} max={limits.maxCandidates} icon={Users} tone="emerald" />
          <UsageBar label="Emails sent" current={usage.emailsSent || 0} max={limits.maxEmailsPerMonth} icon={Mail} tone="amber" />
          <UsageBar label="Job board posts (add-on)" current={usage.jobBoardPostsExtra || 0} max={null} icon={Briefcase} />
          <UsageBar label="Assessments (add-on)" current={usage.assessmentsExtra || 0} max={null} icon={ClipboardList} />
        </div>
      </section>

      {/* Plans */}
      <section ref={plansRef} data-tour="billing-plans" className="space-y-6 pt-2 scroll-mt-6">
        <div className="text-center max-w-2xl mx-auto">
          <h3 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight" style={{ letterSpacing: '-0.025em' }}>
            Upgrade your workspace
          </h3>
          <p className="text-stone-500 mt-2 text-sm sm:text-base leading-relaxed">
            Pick a plan → Stripe Checkout → limits & features update automatically. Downgrade or cancel anytime from the portal.
          </p>
        </div>

        <PlanCards
          paidPlans={paidPlans}
          currentPlan={currentPlan}
          busyPlan={busyPlan}
          stripeReady={stripeReady}
          showStripeMissing={showStripeMissing}
          onUpgrade={handleUpgrade}
        />
      </section>

      <PlanComparisonTable catalog={catalog} currentPlan={currentPlan} />

      <InvoicesSection invoices={invoices} status={status} onPortal={handlePortal} />

      <section className="grid sm:grid-cols-3 gap-3 sm:gap-4 stagger-children">
        {[
          { icon: Lock, title: 'Secure payments', body: 'Card data never touches our servers — Stripe handles PCI.' },
          { icon: FileCheck2, title: 'Invoices on demand', body: 'Download receipts and tax invoices from the customer portal.' },
          { icon: Headphones, title: 'Human support', body: 'Enterprise plans include dedicated onboarding and success.' },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="billing-trust-card rounded-2xl border border-stone-200/80 bg-stone-50/60 p-4 sm:p-5">
            <div className="billing-trust-icon w-9 h-9 rounded-xl bg-white border border-stone-200 flex items-center justify-center mb-3">
              <Icon className="w-4 h-4 text-brand-600" />
            </div>
            <p className="font-bold text-stone-900 text-sm">{title}</p>
            <p className="text-xs text-stone-500 mt-1 leading-relaxed">{body}</p>
          </div>
        ))}
      </section>

      <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title="Take a tour of Billing" />
      <ProductTour
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        steps={BILLING_TOUR_STEPS}
        storageKey={BILLING_TOUR_KEY}
      />
    </div>
  );
}
