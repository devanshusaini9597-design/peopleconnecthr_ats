/**
 * Approval workflows — Enterprise, gated by workflows.approvals.
 */
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requireAdmin, requireRecruiterOrAbove } = require('../middleware/rbacMiddleware');
const { requireOrganization, tenantScope } = require('../middleware/tenantMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');
const svc = require('../services/approvalService');

router.use(verifyToken, requireOrganization, tenantScope, requireFeature('workflows.approvals'));

function handle(res, error) {
  const status = error.statusCode || 500;
  return res.status(status).json({ success: false, message: error.message });
}

router.get('/workflows', requireRecruiterOrAbove, async (req, res) => {
  try {
    const data = await svc.listWorkflows(req.user.organizationId);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/workflows', requireAdmin, async (req, res) => {
  try {
    const data = await svc.createWorkflow(req.user.organizationId, req.user.id, req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.put('/workflows/:id', requireAdmin, async (req, res) => {
  try {
    const data = await svc.updateWorkflow(req.user.organizationId, req.params.id, req.body);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/instances', requireRecruiterOrAbove, async (req, res) => {
  try {
    const data = await svc.listInstances(req.user.organizationId, { status: req.query.status });
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/submit', requireRecruiterOrAbove, async (req, res) => {
  try {
    const data = await svc.submitForApproval(req.user.organizationId, req.user.id, req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/instances/:id/approve', requireRecruiterOrAbove, async (req, res) => {
  try {
    const data = await svc.approveInstance(req.user.organizationId, req.params.id, req.user.id, req.body.comment);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/instances/:id/reject', requireRecruiterOrAbove, async (req, res) => {
  try {
    const data = await svc.rejectInstance(req.user.organizationId, req.params.id, req.user.id, req.body.comment);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

module.exports = router;
