/**
 * Billing routes — owner-only. Stripe webhook is mounted separately
 * (routes/stripeWebhookRoutes.js) before express.json()/verifyToken.
 */
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requireOwner } = require('../middleware/rbacMiddleware');
const { tenantScope, requireOrganization } = require('../middleware/tenantMiddleware');
const svc = require('../services/billingService');

router.use(verifyToken, requireOrganization, tenantScope, requireOwner);

function handle(res, error) {
  const status = error.statusCode || 500;
  return res.status(status).json({ success: false, message: error.message });
}

router.get('/status', async (req, res) => {
  try {
    const data = await svc.getBillingStatus(req.user.organizationId);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/plans', (req, res) => {
  res.json({ success: true, data: svc.getPlansCatalog() });
});

router.get('/invoices', async (req, res) => {
  try {
    const data = await svc.listOrgInvoices(req.user.organizationId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('[Billing] invoices error:', error.message);
    handle(res, error);
  }
});

router.post('/create-checkout', async (req, res) => {
  try {
    const url = await svc.createCheckout(req.user.organizationId, req.user.id, req.body.planId);
    res.json({ success: true, url });
  } catch (error) {
    console.error('[Billing] create-checkout error:', error.message);
    handle(res, error);
  }
});

router.get('/portal', async (req, res) => {
  try {
    const url = await svc.createPortal(req.user.organizationId);
    res.json({ success: true, url });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/cancel', async (req, res) => {
  try {
    const result = await svc.cancelOrgSubscription(req.user.organizationId);
    res.json({ success: true, ...result });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/usage-addons', async (req, res) => {
  try {
    const data = await svc.getUsageAddons(req.user.organizationId);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/usage-addons/increment', async (req, res) => {
  try {
    const data = await svc.incrementUsageAddon(req.user.organizationId, req.body.addon, req.body.amount);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

module.exports = router;
