/**
 * Assessments routes — thin wrappers. Candidate take/* is public (token auth).
 */
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requireOrganization, tenantScope } = require('../middleware/tenantMiddleware');
const { requireRecruiterOrAbove } = require('../middleware/rbacMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');
const svc = require('../services/assessmentService');

function handle(res, error) {
  const status = error.statusCode || 500;
  const body = { success: false, message: error.message };
  if (error.code) body.code = error.code;
  if (error.feature) body.feature = error.feature;
  return res.status(status).json(body);
}

router.get('/take/:token', async (req, res) => {
  try {
    const data = await svc.takeAssessment(req.params.token);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/take/:token/events', async (req, res) => {
  try {
    const data = await svc.recordProctoringEvents(req.params.token, req.body);
    if (data.ignored) return res.json({ success: true, ignored: true });
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/take/:token/submit', async (req, res) => {
  try {
    const result = await svc.submitAssessment(req.params.token, req.body);
    res.json({ success: true, ...result });
  } catch (error) {
    handle(res, error);
  }
});

router.use(verifyToken, requireOrganization, tenantScope, requireFeature('assessments'));

router.get('/', async (req, res) => {
  try {
    const data = await svc.listAssessments(req.user.organizationId);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/', requireRecruiterOrAbove, async (req, res) => {
  try {
    const data = await svc.createAssessment(req.user.organizationId, req.user.id, req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.put('/:id', requireRecruiterOrAbove, async (req, res) => {
  try {
    const data = await svc.updateAssessment(req.user.organizationId, req.params.id, req.body);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.delete('/:id', requireRecruiterOrAbove, async (req, res) => {
  try {
    const result = await svc.deleteAssessment(req.user.organizationId, req.params.id);
    res.json({ success: true, ...result });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/:id/invite', requireRecruiterOrAbove, async (req, res) => {
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

router.get('/invites/:id', async (req, res) => {
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

router.post('/invites/:id/grade', requireRecruiterOrAbove, async (req, res) => {
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
