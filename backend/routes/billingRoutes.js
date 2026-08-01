const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requireRole, requireOwner, requireAdmin, requireRecruiterOrAbove, checkPlanLimit } = require('../middleware/rbacMiddleware');
const { tenantScope, requireOrganization } = require('../middleware/tenantMiddleware');
const Organization = require('../models/Organization');
const User = require('../models/User');
const stripeService = require('../services/stripeService');

const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

// NOTE: the Stripe webhook (POST /api/billing/webhook) is NOT defined here.
// It's mounted separately in server.js, before express.json()/verifyToken,
// via routes/stripeWebhookRoutes.js — see that file for why.

// All other routes require auth and owner role
router.use(verifyToken, requireOrganization, tenantScope, requireOwner);

/**
 * GET /status
 */
router.get('/status', async (req, res) => {
  try {
    const org = await Organization.findById(req.user.organizationId);
    res.json({ 
      success: true, 
      data: {
        plan: org.plan,
        planExpiresAt: org.planExpiresAt,
        usage: org.usageCurrent,
        limits: org.usageLimits,
        stripeConfigured: stripeService.isStripeConfigured(),
        subscription: {
          customerId: org.billingCustomerId || null,
          subscriptionId: org.billingSubscriptionId || null
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /plans
 * IDs here MUST match the Organization.plan enum exactly
 * (free_trial/starter/professional/enterprise) — a mismatch here is what
 * silently breaks a Stripe webhook trying to write org.plan later.
 */
router.get('/plans', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 'free_trial', name: 'Free Trial', price: 0, durationDays: 14 },
      { id: 'starter', name: 'Starter', price: 29, checkoutEnabled: !!stripeService.PRICE_BY_PLAN.starter },
      { id: 'professional', name: 'Professional', price: 99, checkoutEnabled: !!stripeService.PRICE_BY_PLAN.professional },
      { id: 'enterprise', name: 'Enterprise', price: null, custom: true, checkoutEnabled: false }
    ]
  });
});

/**
 * POST /create-checkout
 * Body: { planId: 'starter' | 'professional' }
 */
router.post('/create-checkout', async (req, res) => {
  try {
    if (!stripeService.isStripeConfigured()) {
      return res.status(503).json({ success: false, message: 'Billing is not configured yet. Set STRIPE_SECRET_KEY in backend/.env.' });
    }
    const { planId } = req.body;
    if (!['starter', 'professional'].includes(planId)) {
      return res.status(400).json({ success: false, message: "planId must be 'starter' or 'professional' (Enterprise is sales-assisted — contact us)." });
    }

    const org = await Organization.findById(req.user.organizationId);
    const user = await User.findById(req.user.id);

    const url = await stripeService.createCheckoutSession({
      org,
      user,
      planId,
      successUrl: `${FRONTEND_URL}/billing?checkout=success`,
      cancelUrl: `${FRONTEND_URL}/billing?checkout=cancelled`
    });

    res.json({ success: true, url });
  } catch (error) {
    console.error('[Billing] create-checkout error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /portal
 */
router.get('/portal', async (req, res) => {
  try {
    if (!stripeService.isStripeConfigured()) {
      return res.status(503).json({ success: false, message: 'Billing is not configured yet. Set STRIPE_SECRET_KEY in backend/.env.' });
    }
    const org = await Organization.findById(req.user.organizationId);
    const url = await stripeService.createPortalSession({ org, returnUrl: `${FRONTEND_URL}/billing` });
    res.json({ success: true, url });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * POST /cancel
 */
router.post('/cancel', async (req, res) => {
  try {
    if (!stripeService.isStripeConfigured()) {
      return res.status(503).json({ success: false, message: 'Billing is not configured yet. Set STRIPE_SECRET_KEY in backend/.env.' });
    }
    const org = await Organization.findById(req.user.organizationId);
    await stripeService.cancelSubscription(org);
    res.json({ success: true, message: 'Subscription scheduled to cancel at end of billing period' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
