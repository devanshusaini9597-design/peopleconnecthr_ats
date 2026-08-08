/**
 * Plan-based feature gates and limits
 */

import { prisma } from './prisma';

export type PlanId = 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';

export interface PlanLimits {
  seats: number;       // -1 = unlimited
  candidates: number;  // per month, -1 = unlimited
  jobs: number;        // active jobs, -1 = unlimited
  ai: boolean;
  api: boolean;
  customPipeline: boolean;
  advancedAnalytics: boolean;
  sso: boolean;
  whiteLabel: boolean;
  byok: boolean;
}

/** Purchasable add-ons stored on Subscription.addOns */
export type AddOnId = 'whiteLabelKit' | 'analyticsPlus' | 'sso';

export type SubscriptionAddOns = Partial<Record<AddOnId, boolean>>;

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  FREE: {
    seats: 3,
    candidates: 50,
    jobs: 3,
    ai: false,
    api: false,
    customPipeline: false,
    advancedAnalytics: false,
    sso: false,
    whiteLabel: false,
    byok: false,
  },
  STARTER: {
    seats: 5,
    candidates: 500,
    jobs: 10,
    ai: true,
    api: false,
    customPipeline: true,
    advancedAnalytics: false,
    sso: false,
    whiteLabel: false,
    byok: true,
  },
  PRO: {
    seats: 25,
    candidates: 5000,
    jobs: 50,
    ai: true,
    api: true,
    customPipeline: true,
    advancedAnalytics: true,
    sso: false,
    whiteLabel: false,
    byok: true,
  },
  ENTERPRISE: {
    seats: -1,
    candidates: -1,
    jobs: -1,
    ai: true,
    api: true,
    customPipeline: true,
    advancedAnalytics: true,
    sso: true,
    whiteLabel: true,
    byok: true,
  },
};

export const PLAN_DISPLAY: Record<PlanId, { name: string; priceMonthly: number; priceAnnual: number }> = {
  FREE: { name: 'Free', priceMonthly: 0, priceAnnual: 0 },
  STARTER: { name: 'Starter', priceMonthly: 29, priceAnnual: 23 },
  PRO: { name: 'Professional', priceMonthly: 79, priceAnnual: 63 },
  ENTERPRISE: { name: 'Enterprise', priceMonthly: 199, priceAnnual: 159 },
};

/** Map add-on IDs to the plan feature they unlock */
const ADDON_TO_FEATURE: Record<AddOnId, keyof PlanLimits> = {
  whiteLabelKit: 'whiteLabel',
  analyticsPlus: 'advancedAnalytics',
  sso: 'sso',
};

/**
 * Check if a feature is available on a given plan
 */
export function hasFeature(plan: PlanId, feature: keyof PlanLimits): boolean {
  const limits = PLAN_LIMITS[plan];
  const value = limits[feature];
  if (typeof value === 'boolean') return value;
  return true; // numeric limits are checked separately
}

export function parseAddOns(raw: unknown): SubscriptionAddOns {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: SubscriptionAddOns = {};
  const obj = raw as Record<string, unknown>;
  for (const key of ['whiteLabelKit', 'analyticsPlus', 'sso'] as AddOnId[]) {
    if (obj[key] === true) out[key] = true;
  }
  return out;
}

/**
 * Entitlement = plan feature OR purchased add-on.
 * Existing buyers without addOns keep plan-only behavior.
 */
export async function hasEntitlement(
  orgId: string,
  feature: 'advancedAnalytics' | 'whiteLabel' | 'sso' | 'ai' | 'api' | 'customPipeline' | 'byok'
): Promise<{ allowed: boolean; plan: PlanId; addOns: SubscriptionAddOns }> {
  let sub = await prisma.subscription.findUnique({ where: { organizationId: orgId } });
  if (!sub) {
    sub = await prisma.subscription.create({
      data: { organizationId: orgId, plan: 'FREE', status: 'ACTIVE', seats: 3, addOns: {} },
    });
  }
  const plan = sub.plan as PlanId;
  const addOns = parseAddOns(sub.addOns);

  if (hasFeature(plan, feature)) {
    return { allowed: true, plan, addOns };
  }

  // Add-on unlocks
  if (feature === 'whiteLabel' && addOns.whiteLabelKit) {
    return { allowed: true, plan, addOns };
  }
  if (feature === 'advancedAnalytics' && addOns.analyticsPlus) {
    return { allowed: true, plan, addOns };
  }
  if (feature === 'sso' && addOns.sso) {
    return { allowed: true, plan, addOns };
  }

  return { allowed: false, plan, addOns };
}

/**
 * Check if a numeric limit is exceeded
 */
export function isWithinLimit(plan: PlanId, resource: 'seats' | 'candidates' | 'jobs', current: number): boolean {
  const limit = PLAN_LIMITS[plan][resource];
  if (limit === -1) return true; // unlimited
  return current < limit;
}

/**
 * Get the current plan's limit for a resource
 */
export function getLimit(plan: PlanId, resource: 'seats' | 'candidates' | 'jobs'): number {
  return PLAN_LIMITS[plan][resource];
}

/**
 * Check if an organization is within its plan limit for a resource.
 * Queries current count from DB and compares to plan limit.
 * Returns { allowed, limit, current, plan } for use in route handlers.
 */
export async function checkOrgLimit(
  orgId: string,
  resource: 'seats' | 'candidates' | 'jobs'
): Promise<{ allowed: boolean; limit: number; current: number; plan: PlanId }> {
  let sub = await prisma.subscription.findUnique({ where: { organizationId: orgId } });
  if (!sub) {
    sub = await prisma.subscription.create({
      data: { organizationId: orgId, plan: 'FREE', status: 'ACTIVE', seats: 3, addOns: {} },
    });
  }
  const plan = sub.plan as PlanId;
  const limit = getLimit(plan, resource);

  let current = 0;
  if (resource === 'seats') {
    current = await prisma.user.count({ where: { organizationId: orgId, isActive: true } });
  } else if (resource === 'candidates') {
    current = await prisma.candidate.count({ where: { organizationId: orgId } });
  } else if (resource === 'jobs') {
    current = await prisma.job.count({ where: { companyId: orgId, status: { not: 'Closed' } } });
  }

  const allowed = limit === -1 || current < limit;
  return { allowed, limit, current, plan };
}

export { ADDON_TO_FEATURE };
