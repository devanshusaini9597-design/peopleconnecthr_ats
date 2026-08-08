const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requireOwner, requireAdmin, requireRecruiterOrAbove } = require('../middleware/rbacMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');
const { tenantScope, requireOrganization } = require('../middleware/tenantMiddleware');
const org = require('../services/organizationService');

router.use(verifyToken, requireOrganization, tenantScope);

function handle(res, error) {
  const status = error.statusCode || 500;
  const body = { success: false, message: error.message };
  if (error.code) body.code = error.code;
  if (error.feature) body.feature = error.feature;
  return res.status(status).json(body);
}

router.get('/', async (req, res) => {
  try {
    const data = await org.getOrganization(req.user.organizationId);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.put('/', requireAdmin, async (req, res) => {
  try {
    const data = await org.updateOrganization(req.user.organizationId, req.body);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/candidate-fields', async (req, res) => {
  try {
    const result = await org.getCandidateFields(req.user.organizationId);
    res.json({ success: true, ...result });
  } catch (error) {
    handle(res, error);
  }
});

router.put('/candidate-fields', requireAdmin, async (req, res) => {
  try {
    const result = await org.updateCandidateFields(req.user.organizationId, req.body);
    res.json({ success: true, ...result });
  } catch (error) {
    handle(res, error);
  }
});

router.put('/candidate-fields/last-mapping', requireRecruiterOrAbove, async (req, res) => {
  try {
    const lastImportMapping = await org.saveLastImportMapping(req.user.organizationId, req.body);
    res.json({ success: true, lastImportMapping });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/members', async (req, res) => {
  try {
    const data = await org.listMembers(req.user.organizationId);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.put('/members/:userId/role', requireOwner, async (req, res) => {
  try {
    const data = await org.updateMemberRole(
      req.user.organizationId,
      req.user.id,
      req.params.userId,
      req.body
    );
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.delete('/members/:userId', requireAdmin, async (req, res) => {
  try {
    const result = await org.removeMember(req.user.organizationId, req.user.id, req.params.userId);
    res.json({ success: true, ...result });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/usage', async (req, res) => {
  try {
    const data = await org.getUsage(req.user.organizationId);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/entitlements', async (req, res) => {
  try {
    const result = await org.getOrgEntitlements(req.user.organizationId);
    res.json({ success: true, ...result });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/audit-log', requireAdmin, requireFeature('audit.log'), async (req, res) => {
  try {
    const result = await org.listAuditLog(req.user.organizationId, req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/audit-log/distinct', requireAdmin, requireFeature('audit.log'), async (req, res) => {
  try {
    const result = await org.distinctAuditFields(req.user.organizationId);
    res.json({ success: true, ...result });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/audit-log/export', requireAdmin, requireFeature('audit.export'), async (req, res) => {
  try {
    const { csv, filename } = await org.exportAuditLogCsv(req.user.organizationId, req.query);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    handle(res, error);
  }
});

module.exports = router;
