/**
 * Quantitative usage ceilings per plan.
 *
 * Feature gates live in planFeatures.js (can you use SSO?).
 * These numbers live here (how many seats/jobs before upgrade).
 *
 * Convention: -1 = unlimited. Applied whenever org.plan changes
 * (Stripe webhook, sales-assisted plan moves).
 */

const PLAN_USAGE_LIMITS = {
  free_trial: {
    maxUsers: 25,
    maxJobs: 50,
    maxCandidates: 5000,
    maxEmailsPerMonth: 10000,
  },
  starter: {
    maxUsers: 5,
    maxJobs: 10,
    maxCandidates: 500,
    maxEmailsPerMonth: 1000,
  },
  professional: {
    maxUsers: 25,
    maxJobs: 50,
    maxCandidates: 5000,
    maxEmailsPerMonth: 10000,
  },
  enterprise: {
    maxUsers: -1,
    maxJobs: -1,
    maxCandidates: -1,
    maxEmailsPerMonth: -1,
  },
};

/**
 * @param {string} plan
 * @returns {{ maxUsers: number, maxJobs: number, maxCandidates: number, maxEmailsPerMonth: number }}
 */
const getLimitsForPlan = (plan) => {
  return PLAN_USAGE_LIMITS[plan] || PLAN_USAGE_LIMITS.starter;
};

/**
 * Mutates org.usageLimits in place to match the plan (caller saves).
 * @param {import('mongoose').Document} org
 * @param {string} plan
 */
const applyPlanLimits = (org, plan) => {
  const limits = getLimitsForPlan(plan);
  org.usageLimits = {
    ...(org.usageLimits?.toObject?.() || org.usageLimits || {}),
    ...limits,
  };
  return org;
};

module.exports = {
  PLAN_USAGE_LIMITS,
  getLimitsForPlan,
  applyPlanLimits,
};
