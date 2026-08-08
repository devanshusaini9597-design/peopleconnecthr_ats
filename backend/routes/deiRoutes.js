/**
 * DEI product surface — Enterprise (analytics.dei)
 * Blind screening settings, voluntary self-ID, diverse-slate alerts, funnel.
 */
const express = require('express');
const router = express.Router();
const { requireAdmin, requireRecruiterOrAbove } = require('../middleware/rbacMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');
const svc = require('../services/deiService');

router.use(requireFeature('analytics.dei'));

function handle(res, error) {
  const status = error.statusCode || 500;
  return res.status(status).json({ success: false, message: error.message });
}

router.get('/settings', async (req, res) => {
  try {
    const data = await svc.getSettings(req.user.organizationId);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.put('/settings', requireAdmin, async (req, res) => {
  try {
    const data = await svc.updateSettings(req.user.organizationId, req.body);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/metrics', async (req, res) => {
  try {
    const data = await svc.getMetrics(req.user.organizationId);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/self-id', requireRecruiterOrAbove, async (req, res) => {
  try {
    const data = await svc.recordSelfId(req.user.organizationId, req.body);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/blind-mode', async (req, res) => {
  try {
    const data = await svc.getBlindMode(req.user.organizationId);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

module.exports = router;
