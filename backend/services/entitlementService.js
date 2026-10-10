/**
 * Effective plan, trial expiry, cancelled subscriptions, and write access.
 * Organization.plan stays the purchased/trial SKU. This layer decides what
 * the org may do right now so expiry is enforced even without a cron.
 */
const { planHasFeature, getEntitlements, canUseFeature } = require('../config/planFeatures');
const { getLimitsForPlan } = require('../config/planLimits');

function trialIsExpired(org) {
  if (!org || org.plan !== 'free_trial') return false;
  if (!org.planExpiresAt) return false;
  return new Date(org.planExpiresAt).getTime() <= Date.now();
}

function billingStatusOf(org) {
  if (!org) return 'none';
  if (org.billingStatus) return org.billingStatus;
  if (org.plan === 'free_trial') return 'trialing';
  if (org.billingSubscriptionId) return 'active';
  return 'none';
}

function isUnpaid(org) {
  const status = billingStatusOf(org);
  if (status === 'cancelled' || status === 'expired') return true;
  return trialIsExpired(org);
}

/** Plan used for feature + limit checks (never invents Starter after cancel). */
function effectivePlan(org) {
  if (!org) return 'expired';
  if (trialIsExpired(org) || org.billingStatus === 'expired') return 'expired';
  if (org.billingStatus === 'cancelled') return 'cancelled';
  return org.plan || 'starter';
}

function writesAllowed(org) {
  return !isUnpaid(org);
}

function orgHasFeature(org, featureKey, ctx = {}) {
  return planHasFeature(effectivePlan(org), featureKey) && canUseFeature(effectivePlan(org), featureKey, ctx);
}

function orgEntitlements(org, ctx = {}) {
  const plan = effectivePlan(org);
  return getEntitlements(plan).filter((key) => canUseFeature(plan, key, ctx));
}

function limitsForOrg(org) {
  if (!org) return getLimitsForPlan('starter');
  const ep = effectivePlan(org);
  if (ep === 'expired') return getLimitsForPlan('starter');
  if (ep === 'cancelled') return getLimitsForPlan(org.plan || 'starter');
  return getLimitsForPlan(ep);
}

async function persistExpiredIfNeeded(org) {
  if (!org || org.isDemo) return org;
  if (!trialIsExpired(org)) return org;
  if (org.billingStatus === 'expired') return org;
  org.billingStatus = 'expired';
  try {
    const Organization = require('../models/Organization');
    await Organization.updateOne({ _id: org._id }, { $set: { billingStatus: 'expired' } });
  } catch (_) { /* non-blocking */ }
  return org;
}

module.exports = {
  trialIsExpired,
  billingStatusOf,
  isUnpaid,
  effectivePlan,
  writesAllowed,
  orgHasFeature,
  orgEntitlements,
  limitsForOrg,
  persistExpiredIfNeeded,
};
