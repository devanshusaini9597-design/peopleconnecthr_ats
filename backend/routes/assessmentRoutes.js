/**
 * Assessments routes — thin wrappers. Candidate take/* is public (token auth).
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requireOrganization, tenantScope } = require('../middleware/tenantMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');
const { requirePermission, hasPermission } = require('../middleware/permissionMiddleware');
const svc = require('../services/assessmentService');

const takeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many assessment attempts. Try again shortly.' },
});

function handle(res, error) {
  const status = error.statusCode || 500;
  const body = { success: false, message: error.message };
  if (error.code) body.code = error.code;
  if (error.feature) body.feature = error.feature;
  return res.status(status).json(body);
}

router.get('/take/:token', takeLimiter, async (req, res) => {
  try {
    const data = await svc.takeAssessment(req.params.token);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/take/:token/events', takeLimiter, async (req, res) => {
  try {
    const data = await svc.recordProctoringEvents(req.params.token, req.body);
    if (data.ignored) return res.json({ success: true, ignored: true });
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/take/:token/submit', takeLimiter, async (req, res) => {
  try {
    const result = await svc.submitAssessment(req.params.token, req.body);
    res.json({ success: true, ...result });
  } catch (error) {
    handle(res, error);
  }
});

router.use(
  verifyToken,
  requireOrganization,
  tenantScope,
  requireFeature('assessments'),
  requirePermission('modules.assessments'),
);

router.get('/candidates', async (req, res) => {
  try {
    const data = await svc.searchInternalCandidates(req.user.organizationId, req.query.q || req.query.search);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/', async (req, res) => {
  try {
    let data = await svc.listAssessments(req.user.organizationId);
    const seeKeys = await hasPermission(req.user, 'assessments.edit');
    if (!seeKeys) data = svc.redactAnswerKeys(data);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/', requirePermission('assessments.create'), async (req, res) => {
  try {
    const data = await svc.createAssessment(req.user.organizationId, req.user.id || req.user._id, req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.put('/:id', requirePermission('assessments.edit'), async (req, res) => {
  try {
    const data = await svc.updateAssessment(req.user.organizationId, req.params.id, req.body);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.delete('/:id', requirePermission('assessments.delete'), async (req, res) => {
  try {
    const result = await svc.deleteAssessment(req.user.organizationId, req.params.id);
    res.json({ success: true, ...result });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/:id/invite', requirePermission('assessments.invite'), async (req, res) => {
  try {
    const data = await svc.inviteCandidate(
      req.user.organizationId,
      req.user.id,
      req.params.id,
      req.body
    );
    res.status(201).json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/invites', async (req, res) => {
  try {
    const data = await svc.listInvites(req.user.organizationId, req.query);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/invites/:id/resend', requirePermission('assessments.invite'), async (req, res) => {
  try {
    const data = await svc.resendInvite(req.user.organizationId, req.user.id || req.user._id, req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/invites/:id', requirePermission('assessments.grade'), async (req, res) => {
  try {
    const data = await svc.getInvite(req.user.organizationId, req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/invites/:id/integrity', requireFeature('assessments.proctoring'), async (req, res) => {
  try {
    const data = await svc.getInviteIntegrity(req.user.organizationId, req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/invites/:id/grade', requirePermission('assessments.grade'), async (req, res) => {
  try {
    const data = await svc.gradeInvite(
      req.user.organizationId,
      req.user.id,
      req.params.id,
      req.body
    );
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

module.exports = router;
