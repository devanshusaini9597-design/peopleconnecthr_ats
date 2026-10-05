/**
 * Billing route orchestration — uses stripeService + usageMeterService.
 */
const Organization = require('../models/Organization');
const User = require('../models/User');
const stripeService = require('./stripeService');
const usageMeterService = require('./usageMeterService');
const { getLimitsForPlan, PLAN_USAGE_LIMITS } = require('../config/planLimits');
const { getEntitlements } = require('../config/planFeatures');

const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

async function getBillingStatus(organizationId) {
  const org = await Organization.findById(organizationId);
  const stripeSub = await stripeService.getSubscriptionSummary(org);
  const entitlements = getEntitlements(org.plan);
  const { getPlanUsage } = require('./planUsageService');
  const planUsage = await getPlanUsage(organizationId);
  const byKey = Object.fromEntries(planUsage.meters.map((row) => [row.key, row]));
  const ceiling = (row) => (row?.unlimited ? -1 : row?.limit ?? 0);

  let trialDaysLeft = null;
  if (org.plan === 'free_trial' && org.planExpiresAt) {
    trialDaysLeft = Math.max(0, Math.ceil((new Date(org.planExpiresAt) - Date.now()) / 86400000));
  }

  return {
    plan: org.plan,
    planExpiresAt: org.planExpiresAt,
    trialDaysLeft,
    usage: {
      users: byKey.users?.used || 0,
      jobs: byKey.jobs?.used || 0,
      candidates: byKey.candidates?.used || 0,
      emailsSent: byKey.emails?.used || 0,
    },
    limits: {
      maxUsers: ceiling(byKey.users),
      maxJobs: ceiling(byKey.jobs),
      maxCandidates: ceiling(byKey.candidates),
      maxEmailsPerMonth: ceiling(byKey.emails),
    },
    planUsage,
    planDefaultLimits: getLimitsForPlan(org.plan),
    entitlementCount: entitlements.length,
    stripeConfigured: stripeService.isStripeConfigured(),
    subscription: {
      customerId: org.billingCustomerId || null,
      subscriptionId: org.billingSubscriptionId || null,
      status: stripeSub?.status || (org.billingSubscriptionId ? 'active' : null),
      cancelAtPeriodEnd: stripeSub?.cancelAtPeriodEnd || false,
      currentPeriodEnd: stripeSub?.currentPeriodEnd || null,
    },
  };
}

/** IDs MUST match Organization.plan enum (free_trial/starter/professional/enterprise). */
function getPlansCatalog() {
  const catalog = [
    { id: 'free_trial', name: 'Free Trial', price: 0, durationDays: 21 },
    { id: 'starter', name: 'Starter', price: 2499, currency: 'INR', checkoutEnabled: !!stripeService.PRICE_BY_PLAN.starter },
    { id: 'professional', name: 'Premium', price: 8499, currency: 'INR', yearlyDiscountPct: 25, checkoutEnabled: !!stripeService.PRICE_BY_PLAN.professional },
    { id: 'enterprise', name: 'Custom', price: null, custom: true, checkoutEnabled: false },
  ];

  return catalog.map((p) => ({
    ...p,
    limits: PLAN_USAGE_LIMITS[p.id] || getLimitsForPlan(p.id),
    entitlementCount: getEntitlements(p.id === 'free_trial' ? 'professional' : p.id).length,
  }));
}

async function listOrgInvoices(organizationId) {
  if (!stripeService.isStripeConfigured()) return [];
  const org = await Organization.findById(organizationId);
  return stripeService.listInvoices(org);
}

async function createCheckout(organizationId, userId, planId) {
  if (!stripeService.isStripeConfigured()) {
    throw httpError('Billing is not configured yet. Set STRIPE_SECRET_KEY in backend/.env.', 503);
  }
  if (!['starter', 'professional'].includes(planId)) {
    throw httpError("planId must be 'starter' or 'professional' (Enterprise is sales-assisted — contact us).");
  }

  const org = await Organization.findById(organizationId);
  const user = await User.findById(userId);

  return stripeService.createCheckoutSession({
    org,
    user,
    planId,
    successUrl: `${FRONTEND_URL}/billing?checkout=success`,
    cancelUrl: `${FRONTEND_URL}/billing?checkout=cancelled`,
  });
}

async function createPortal(organizationId) {
  if (!stripeService.isStripeConfigured()) {
    throw httpError('Billing is not configured yet. Set STRIPE_SECRET_KEY in backend/.env.', 503);
  }
  const org = await Organization.findById(organizationId);
  try {
    return await stripeService.createPortalSession({ org, returnUrl: `${FRONTEND_URL}/billing` });
  } catch (error) {
    throw httpError(error.message, 400);
  }
}

async function cancelOrgSubscription(organizationId) {
  if (!stripeService.isStripeConfigured()) {
    throw httpError('Billing is not configured yet. Set STRIPE_SECRET_KEY in backend/.env.', 503);
  }
  const org = await Organization.findById(organizationId);
  try {
    await stripeService.cancelSubscription(org);
  } catch (error) {
    throw httpError(error.message, 400);
  }
  return { message: 'Subscription scheduled to cancel at end of billing period' };
}

async function getUsageAddons(organizationId) {
  return usageMeterService.getAddonUsage(organizationId);
}

async function incrementUsageAddon(organizationId, addon, amount) {
  if (!addon) throw httpError('addon is required');
  try {
    const total = await usageMeterService.incrementUsage(organizationId, addon, amount || 1);
    return { addon, total };
  } catch (error) {
    throw httpError(error.message, 400);
  }
}

module.exports = {
  getBillingStatus,
  getPlansCatalog,
  listOrgInvoices,
  createCheckout,
  createPortal,
  cancelOrgSubscription,
  getUsageAddons,
  incrementUsageAddon,
};
