/**
 * Offer letter templates — Enterprise, gated by offers.templates.
 */
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requireRecruiterOrAbove } = require('../middleware/rbacMiddleware');
const { requireOrganization, tenantScope } = require('../middleware/tenantMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');
const svc = require('../services/offerTemplateService');

router.use(verifyToken, requireOrganization, tenantScope, requireFeature('offers.templates'));

function handle(res, error) {
  const status = error.statusCode || 500;
  return res.status(status).json({ success: false, message: error.message });
}

router.get('/', requireRecruiterOrAbove, async (req, res) => {
  try {
    const { templates, mergeFields } = await svc.listTemplates(req.user.organizationId);
    res.json({ success: true, data: templates, mergeFields });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/', requireRecruiterOrAbove, async (req, res) => {
  try {
    const data = await svc.createTemplate(req.user.organizationId, req.user.id, req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.put('/:id', requireRecruiterOrAbove, async (req, res) => {
  try {
    const data = await svc.updateTemplate(req.user.organizationId, req.params.id, req.body);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.delete('/:id', requireRecruiterOrAbove, async (req, res) => {
  try {
    await svc.deleteTemplate(req.user.organizationId, req.params.id);
    res.json({ success: true });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/:id/render', requireRecruiterOrAbove, async (req, res) => {
  try {
    const data = await svc.renderTemplate(req.user.organizationId, req.params.id, req.body);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/:id/send', requireRecruiterOrAbove, async (req, res) => {
  try {
    const data = await svc.sendTemplate(req.user.organizationId, req.user.id, req.params.id, req.body);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

module.exports = router;
