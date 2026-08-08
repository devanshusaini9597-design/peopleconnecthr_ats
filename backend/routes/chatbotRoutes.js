/**
 * Careers chatbot — careers.chatbot (Professional+)
 * Authenticated config + public chat endpoint.
 */
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requireOrganization, tenantScope } = require('../middleware/tenantMiddleware');
const { requireAdmin } = require('../middleware/rbacMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');
const svc = require('../services/chatbotService');

function handle(res, error) {
  const status = error.statusCode || 500;
  const body = { success: false, message: error.message };
  if (error.code) body.code = error.code;
  if (error.feature) body.feature = error.feature;
  return res.status(status).json(body);
}

router.get(
  '/admin/settings',
  verifyToken,
  requireOrganization,
  tenantScope,
  requireFeature('careers.chatbot'),
  requireAdmin,
  async (req, res) => {
    try {
      const data = await svc.getAdminSettings(req.user.organizationId);
      res.json({ success: true, data });
    } catch (error) {
      handle(res, error);
    }
  }
);

router.put(
  '/admin/settings',
  verifyToken,
  requireOrganization,
  tenantScope,
  requireFeature('careers.chatbot'),
  requireAdmin,
  async (req, res) => {
    try {
      const data = await svc.updateAdminSettings(req.user.organizationId, req.body);
      res.json({ success: true, data });
    } catch (error) {
      handle(res, error);
    }
  }
);

router.get('/:orgSlug/config', async (req, res) => {
  try {
    const data = await svc.getPublicConfig(req.params.orgSlug);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/:orgSlug/ask', async (req, res) => {
  try {
    const data = await svc.ask(req.params.orgSlug, req.body.message);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

module.exports = router;
