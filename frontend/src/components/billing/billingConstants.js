import { Briefcase, Zap, Building2 } from 'lucide-react';
import { getEntitlements } from '../../config/planFeatures';
import { readApiJson } from '../../utils/fetchUtils';

export const BILLING_TOUR_KEY = 'skillnix_tour_billing_v2';
export const BILLING_TOUR_STEPS = [
  {
    title: 'Billing & Plans',
    body: 'Your subscription control center — plan, days remaining, usage ceilings, and how to upgrade.',
  },
  {
    target: '[data-tour="billing-kpis"]',
    title: 'At a glance',
    body: 'Days left, remaining seats, jobs, and candidates — so you know when to upgrade.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="billing-current"]',
    title: 'Current subscription',
    body: 'Plan name, renewal or trial end, and Stripe portal for payment methods.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="billing-usage"]',
    title: 'Usage & remaining',
    body: 'Live meters with remaining capacity. Hitting a ceiling blocks new creates.',
    placement: 'top',
  },
  {
    target: '[data-tour="billing-plans"]',
    title: 'Upgrade',
    body: 'Pick Starter or Professional for self-serve Stripe checkout, or contact sales for Enterprise.',
    placement: 'top',
  },
];

export const PLAN_LIMITS = {
  free_trial: { maxUsers: 25, maxJobs: 50, maxCandidates: 5000, maxEmailsPerMonth: 10000 },
  starter: { maxUsers: 5, maxJobs: 10, maxCandidates: 500, maxEmailsPerMonth: 1000 },
  professional: { maxUsers: 25, maxJobs: 50, maxCandidates: 5000, maxEmailsPerMonth: 10000 },
  enterprise: { maxUsers: -1, maxJobs: -1, maxCandidates: -1, maxEmailsPerMonth: -1 },
};

export const FALLBACK_PLANS = [
  {
    id: 'free_trial',
    name: 'Free Trial',
    price: 0,
    durationDays: 14,
    limits: PLAN_LIMITS.free_trial,
    entitlementCount: getEntitlements('professional').length,
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 29,
    checkoutEnabled: true,
    limits: PLAN_LIMITS.starter,
    entitlementCount: getEntitlements('starter').length,
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 99,
    checkoutEnabled: true,
    limits: PLAN_LIMITS.professional,
    entitlementCount: getEntitlements('professional').length,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: null,
    custom: true,
    checkoutEnabled: false,
    limits: PLAN_LIMITS.enterprise,
    entitlementCount: getEntitlements('enterprise').length,
  },
];

export const PLAN_FEATURES = {
  starter: [
    'Core ATS workspace',
    'Jobs, candidates & pipeline',
    'Basic analytics',
    'MFA / 2FA',
    'Duplicate detection & candidate surveys',
  ],
  professional: [
    'Everything in Starter',
    'Talent pools & assessments',
    'Calendar + BYO email + video BYOK',
    'LLM resume scoring (not parsing)',
    'Semantic search & AI drafting tools',
    'Self-schedule booking & referrals',
  ],
  enterprise: [
    'Everything in Professional',
    'SSO (SAML/OIDC) + SCIM',
    'Storage, KMS, CRM, HRIS, SIEM BYOK',
    'IP allowlist, retention & legal hold',
    'Approvals, offer templates, white-label CMS',
    'Dedicated / VPC deployment option',
  ],
};

export const PLAN_META = {
  starter: {
    icon: Briefcase,
    accent: 'from-stone-700 to-stone-900',
    chip: 'bg-stone-100 text-stone-700',
    blurb: 'For lean recruiting teams getting organized.',
  },
  professional: {
    icon: Zap,
    accent: 'from-brand-600 to-teal-700',
    chip: 'bg-brand-50 text-brand-700',
    blurb: 'For growing teams that need depth and automation.',
    highlight: true,
  },
  enterprise: {
    icon: Building2,
    accent: 'from-slate-800 to-stone-950',
    chip: 'bg-slate-100 text-slate-700',
    blurb: 'For agencies and multi-brand hiring orgs.',
  },
};

export const COMPARE_ROWS = [
  { label: 'Team seats', kind: 'limit', field: 'maxUsers' },
  { label: 'Active jobs', kind: 'limit', field: 'maxJobs' },
  { label: 'Candidates', kind: 'limit', field: 'maxCandidates' },
  { label: 'Emails / month', kind: 'limit', field: 'maxEmailsPerMonth' },
  { label: 'Audit log', kind: 'feature', key: 'audit.log' },
  { label: 'Talent pools', kind: 'feature', key: 'candidates.talentPools' },
  { label: 'Assessments', kind: 'feature', key: 'assessments' },
  { label: 'BYO email & calendar', kind: 'feature', key: 'integrations.byoEmail' },
  { label: 'AI resume scoring', kind: 'feature', key: 'integrations.aiScoring' },
  { label: 'SSO + SCIM', kind: 'feature', key: 'sso' },
  { label: 'Custom roles', kind: 'feature', key: 'team.customRoles' },
  { label: 'White-label careers', kind: 'feature', key: 'whiteLabel' },
  { label: 'IP allowlist', kind: 'feature', key: 'security.ipAllowlist' },
];

export const formatLimit = (n) => {
  if (n == null) return '—';
  if (n < 0 || n >= 999999) return 'Unlimited';
  return n.toLocaleString();
};

export const remainingOf = (current = 0, max) => {
  if (max == null || max <= 0 || max >= 999999) return null;
  return Math.max(0, max - (current || 0));
};

export const daysUntil = (iso) => {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
};

export const formatMoney = (cents, currency = 'usd') => {
  if (cents == null) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: (currency || 'usd').toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
};

export const safeJson = async (res) => {
  if (!res || res.status === 404) return {};
  try {
    return await readApiJson(res);
  } catch {
    return {};
  }
};
