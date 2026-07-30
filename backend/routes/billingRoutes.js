const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requireRole, requireOwner, requireAdmin, requireRecruiterOrAbove, checkPlanLimit } = require('../middleware/rbacMiddleware');
const { tenantScope, requireOrganization } = require('../middleware/tenantMiddleware');
const Organization = require('../models/Organization');

// Stripe webhook is public
router.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  // STUB: validate webhook structure, log events
  console.log('[STUB] Received Stripe webhook');
  res.json({ received: true });
});

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
        usage: org.usageCurrent,
        subscription: org.subscription
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /plans
 */
router.get('/plans', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 'free', name: 'Free', price: 0 },
      { id: 'pro', name: 'Pro', price: 49 },
      { id: 'enterprise', name: 'Enterprise', price: 199 }
    ]
  });
});

/**
 * POST /create-checkout
 */
router.post('/create-checkout', async (req, res) => {
  try {
    // STUB: return placeholder URL
    console.log(`[STUB] Create checkout for org ${req.user.organizationId}`);
    res.json({ success: true, url: 'https://checkout.stripe.com/pay/stub' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /portal
 */
router.get('/portal', async (req, res) => {
  try {
    res.json({ success: true, url: 'https://billing.stripe.com/p/session/stub' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /cancel
 */
router.post('/cancel', async (req, res) => {
  try {
    console.log(`[STUB] Cancel subscription for org ${req.user.organizationId}`);
    res.json({ success: true, message: 'Subscription scheduled to cancel at end of billing period' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
