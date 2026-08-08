/**
 * Usage meter helpers — increment add-on counters and optional Stripe metered reporting.
 */
const Organization = require('../models/Organization');
const stripeService = require('./stripeService');

const ADDON_FIELDS = {
  jobBoardPosts: 'jobBoardPostsExtra',
  assessments: 'assessmentsExtra'
};

/**
 * Increment an add-on usage counter on the organization.
 * @param {string|ObjectId} organizationId
 * @param {'jobBoardPosts'|'assessments'} addon
 * @param {number} [amount=1]
 */
const incrementUsage = async (organizationId, addon, amount = 1) => {
  const field = ADDON_FIELDS[addon];
  if (!field) throw new Error(`Unknown add-on: ${addon}`);

  const org = await Organization.findByIdAndUpdate(
    organizationId,
    { $inc: { [`usageCurrent.${field}`]: amount } },
    { new: true }
  );
  if (!org) throw new Error('Organization not found');

  if (stripeService.isStripeConfigured() && org.billingSubscriptionId) {
    await reportMeteredUsage(org, addon, amount).catch((err) => {
      console.warn(`[usageMeter] Stripe metered report failed for ${addon}:`, err.message);
    });
  }

  return org.usageCurrent?.[field] ?? amount;
};

/**
 * Stripe metered usage stub — logs intent; wire STRIPE_METER_* env vars in production.
 */
const reportMeteredUsage = async (org, addon, quantity) => {
  const meterEnvKey = `STRIPE_METER_${addon.toUpperCase()}`;
  const meterEventName = process.env[meterEnvKey];
  if (!meterEventName) {
    console.log(`[usageMeter] stub: org=${org._id} addon=${addon} qty=${quantity} (set ${meterEnvKey} to enable Stripe metering)`);
    return;
  }

  const stripe = stripeService.getStripe();
  await stripe.billing.meterEvents.create({
    event_name: meterEventName,
    payload: {
      stripe_customer_id: org.billingCustomerId,
      value: String(quantity)
    }
  });
};

/**
 * Get current add-on usage for an org.
 */
const getAddonUsage = async (organizationId) => {
  const org = await Organization.findById(organizationId).select('usageCurrent usageLimits plan');
  if (!org) return null;
  return {
    jobBoardPostsExtra: org.usageCurrent?.jobBoardPostsExtra || 0,
    assessmentsExtra: org.usageCurrent?.assessmentsExtra || 0,
    plan: org.plan
  };
};

module.exports = {
  incrementUsage,
  reportMeteredUsage,
  getAddonUsage,
  ADDON_FIELDS
};
