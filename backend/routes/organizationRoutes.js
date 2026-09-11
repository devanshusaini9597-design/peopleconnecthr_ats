const express = require('express');
const path = require('path');
const multer = require('multer');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requireOwner, requireAdmin, requireOwnerOrAdmin, requireRecruiterOrAbove } = require('../middleware/rbacMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');
const { tenantScope, requireOrganization } = require('../middleware/tenantMiddleware');
const { isFreelancer } = require('../utils/dataScope');
const org = require('../services/organizationService');

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only image files (JPG, PNG, GIF, WebP) are allowed'));
  },
});

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
    const data = await org.getOrganization(req.user.organizationId, req.user);
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

router.post('/pipeline/rename', requireAdmin, async (req, res) => {
  try {
    const { oldName, newName } = req.body || {};
    const data = await org.renamePipelineStage(req.user.organizationId, oldName, newName);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/pipeline/merge', requireAdmin, async (req, res) => {
  try {
    const { sourceNames, newName } = req.body || {};
    const data = await org.mergePipelineStages(req.user.organizationId, sourceNames, newName);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.put('/logo', requireAdmin, (req, res, next) => {
  logoUpload.single('logo')(req, res, (err) => {
    if (err) {
      err.statusCode = 400;
      return handle(res, err);
    }
    next();
  });
}, async (req, res) => {
  try {
    const data = await org.updateOrganizationLogo(req.user.organizationId, req.file);
    res.json({ success: true, data, logo: data.logo });
  } catch (error) {
    handle(res, error);
  }
});

router.delete('/logo', requireAdmin, async (req, res) => {
  try {
    const data = await org.removeOrganizationLogo(req.user.organizationId);
    res.json({ success: true, data, logo: '' });
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
    if (isFreelancer(req.user)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const data = await org.listMembers(req.user.organizationId);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

/** Pending invite share link (email fallback). */
router.post('/members/:userId/invite-link', requireAdmin, async (req, res) => {
  try {
    const data = await org.getMemberInviteLink(req.user.organizationId, req.params.userId);
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

router.put('/members/:userId/reports-to', requireAdmin, async (req, res) => {
  try {
    const data = await org.updateMemberReportsTo(
      req.user.organizationId,
      req.user,
      req.params.userId,
      req.body?.reportsTo
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

router.post('/members/:userId/reset-password', requireOwnerOrAdmin, async (req, res) => {
  try {
    const data = await org.resetMemberPassword(req.user.organizationId, req.user, req.params.userId);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/members/:userId/resend-temporary-password', requireOwnerOrAdmin, async (req, res) => {
  try {
    const data = await org.resendTemporaryPasswordEmail(
      req.user.organizationId,
      req.user,
      req.params.userId,
      req.body?.temporaryPassword
    );
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/usage', requireRecruiterOrAbove, async (req, res) => {
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
