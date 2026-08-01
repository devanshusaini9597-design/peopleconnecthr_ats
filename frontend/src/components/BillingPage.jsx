import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard, Check, Zap, Users, Briefcase, Mail, ArrowRight, ShieldCheck, Loader2
} from 'lucide-react';
import { authenticatedFetch, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';

const MetricRing = ({ label, current, max, color, icon: Icon }) => {
  const safeMax = max && max > 0 ? max : 1;
  const unlimited = !max || max <= 0 || max >= 999999;
  const percentage = unlimited ? 0 : Math.min((current / safeMax) * 100, 100);
  const strokeColor = percentage > 85 ? 'text-red-500' : percentage > 60 ? 'text-amber-500' : color;

  return (
    <div className="bg-white p-5 rounded-xl border border-gray-200 flex items-center justify-between shadow-sm">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-gray-500 text-sm font-medium">
          <Icon className="w-4 h-4" />
          {label}
        </div>
        <div className="text-2xl font-bold text-gray-900">
          {(current || 0).toLocaleString()} <span className="text-sm font-normal text-gray-400">/ {unlimited ? '∞' : max.toLocaleString()}</span>
        </div>
      </div>
      <div className="relative w-16 h-16">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
          <path className="text-gray-100" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
          <path className={`${strokeColor} transition-all duration-1000 ease-out`} strokeWidth="3" strokeDasharray={`${percentage}, 100`} stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
        </svg>
      </div>
    </div>
  );
};

const PLAN_ICONS = { starter: Briefcase, professional: Zap, enterprise: ShieldCheck };

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
        authenticatedFetch('/api/billing/plans')
      ]);
      if (statusRes.status === 401 || plansRes.status === 401) return handleUnauthorized();

      const statusData = await statusRes.json();
      const plansData = await plansRes.json();
      if (statusData.success) setStatus(statusData.data);
      if (plansData.success) setPlans(plansData.data);
    } catch (err) {
      toast?.error?.('Failed to load billing info');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // Reflect Stripe Checkout redirect result back to the user.
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
        body: JSON.stringify({ planId })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Could not start checkout');
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      toast?.error?.('Could not start checkout');
    } finally {
      setBusyPlan(null);
    }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const res = await authenticatedFetch('/api/billing/portal');
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Could not open billing portal');
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      toast?.error?.('Could not open billing portal');
    } finally {
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  const currentPlan = status?.plan || 'free_trial';
  const usage = status?.usage || {};
  const limits = status?.limits || {};
  const currentPlanMeta = plans.find((p) => p.id === currentPlan);

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 pb-20">
      <div className="max-w-6xl mx-auto space-y-8">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Billing & Plans</h1>
            <p className="text-gray-500 mt-1 text-sm">Manage your subscription and monitor usage.</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-1.5 rounded-full border border-green-200 font-medium">
            <ShieldCheck className="w-4 h-4" /> Secure Payment via Stripe
          </div>
        </div>

        {!status?.stripeConfigured && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm">
            Billing isn't fully configured yet on the server (missing Stripe keys). Plan changes and checkout will be unavailable until an admin sets <code>STRIPE_SECRET_KEY</code> etc. in the backend environment.
          </div>
        )}

        {/* Current Plan Alert */}
        <div className="bg-gradient-to-r from-gray-900 to-slate-800 rounded-2xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl"></div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded text-xs font-semibold uppercase tracking-wider">
                  Current Plan
                </span>
                {status?.planExpiresAt && (
                  <span className="text-yellow-400 text-sm font-medium flex items-center gap-1">
                    Trial ends {new Date(status.planExpiresAt).toLocaleDateString()}
                  </span>
                )}
              </div>
              <h2 className="text-3xl font-bold mb-1 capitalize">{currentPlanMeta?.name || currentPlan.replace('_', ' ')}</h2>
              <p className="text-gray-400 text-sm">
                {status?.subscription?.subscriptionId ? 'Active subscription' : 'No active paid subscription'}
              </p>
            </div>

            <div className="flex items-center gap-4">
              {currentPlanMeta?.price != null && (
                <div className="text-right hidden md:block">
                  <div className="text-2xl font-bold">${currentPlanMeta.price} <span className="text-sm font-normal text-gray-400">/mo</span></div>
                </div>
              )}
              <button
                onClick={handlePortal}
                disabled={portalLoading || !status?.subscription?.customerId}
                className="px-6 py-3 bg-white text-gray-900 rounded-lg font-semibold hover:bg-gray-100 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
                title={!status?.subscription?.customerId ? 'Subscribe to a paid plan first' : ''}
              >
                <CreditCard className="w-4 h-4" /> {portalLoading ? 'Opening…' : 'Manage Subscription'}
              </button>
            </div>
          </div>
        </div>

        {/* Usage Stats */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Current Usage</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricRing label="Active Jobs" current={usage.jobs || 0} max={limits.maxJobs} color="text-blue-500" icon={Briefcase} />
            <MetricRing label="Team Members" current={usage.users || 0} max={limits.maxUsers} color="text-indigo-500" icon={Users} />
            <MetricRing label="Candidates" current={usage.candidates || 0} max={limits.maxCandidates} color="text-emerald-500" icon={Users} />
            <MetricRing label="Emails Sent" current={usage.emailsSent || 0} max={limits.maxEmailsPerMonth} color="text-amber-500" icon={Mail} />
          </div>
        </div>

        {/* Plans */}
        <div className="pt-8">
          <h3 className="text-2xl font-bold text-center text-gray-900 mb-8">Ready to grow? Upgrade your plan.</h3>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.filter((p) => p.id !== 'free_trial').map((plan) => {
              const Icon = PLAN_ICONS[plan.id] || Zap;
              const isCurrent = plan.id === currentPlan;
              const isEnterprise = plan.id === 'enterprise';
              return (
                <div
                  key={plan.id}
                  className={`bg-white rounded-2xl p-6 relative ${isCurrent ? 'border-2 border-blue-500 shadow-md' : 'border border-gray-200 hover:shadow-xl transition-shadow'}`}
                >
                  {isCurrent && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                      Current Plan
                    </div>
                  )}
                  <div className="absolute top-4 right-4 opacity-10">
                    <Icon className="w-16 h-16" />
                  </div>
                  <h4 className="text-lg font-bold text-gray-900">{plan.name}</h4>
                  <div className="mt-2 text-3xl font-bold text-gray-900">
                    {plan.price != null ? <>${plan.price}<span className="text-lg font-normal text-gray-500">/mo</span></> : 'Custom'}
                  </div>

                  {!isCurrent && !isEnterprise && (
                    <button
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={busyPlan === plan.id || !plan.checkoutEnabled}
                      className="w-full mt-6 py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      title={!plan.checkoutEnabled ? 'This plan is not configured for self-serve checkout yet' : ''}
                    >
                      {busyPlan === plan.id ? 'Redirecting…' : <>Upgrade to {plan.name} <ArrowRight className="w-4 h-4" /></>}
                    </button>
                  )}

                  {!isCurrent && isEnterprise && (
                    <a
                      href="mailto:sales@skillnix.example?subject=Enterprise%20plan%20inquiry"
                      className="w-full mt-6 py-2.5 bg-white border-2 border-gray-200 text-gray-900 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center justify-center"
                    >
                      Contact Sales
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {status?.subscription?.subscriptionId && (
          <div className="text-center">
            <button
              onClick={handlePortal}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Cancel subscription (via billing portal)
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
