/**
 * Interviews — thin wrappers; domain logic in interviewService.
 */
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requireRecruiterOrAbove } = require('../middleware/rbacMiddleware');
const { tenantScope, requireOrganization } = require('../middleware/tenantMiddleware');
const svc = require('../services/interviewService');

function handle(res, error) {
  const status = error.statusCode || 500;
  return res.status(status).json({ success: false, message: error.message });
}

router.use(verifyToken, requireOrganization, tenantScope);

router.get('/', async (req, res) => {
  try {
    const data = await svc.listInterviews(req.user.organizationId, req.query);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/my', async (req, res) => {
  try {
    const data = await svc.listMyInterviews(req.user.organizationId, req.user.id);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const data = await svc.getInterview(req.user.organizationId, req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/', requireRecruiterOrAbove, async (req, res) => {
  try {
    const data = await svc.createInterview(req.user.organizationId, req.user, req.body);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.put('/:id', requireRecruiterOrAbove, async (req, res) => {
  try {
    const data = await svc.updateInterview(req.user.organizationId, req.params.id, req.body);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.put('/:id/cancel', requireRecruiterOrAbove, async (req, res) => {
  try {
    const data = await svc.cancelInterview(
      req.user.organizationId,
      req.user.id,
      req.params.id,
      req.body.reason
    );
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.put('/:id/complete', requireRecruiterOrAbove, async (req, res) => {
  try {
    const data = await svc.completeInterview(req.user.organizationId, req.user.id, req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/:id/scorecards', async (req, res) => {
  try {
    const data = await svc.listScorecards(req.user.organizationId, req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/:interviewId/scorecard', async (req, res) => {
  try {
    const data = await svc.submitScorecard(
      req.user.organizationId,
      req.user,
      req.params.interviewId,
      req.body
    );
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.put('/scorecard/:id', async (req, res) => {
  try {
    const data = await svc.updateScorecard(
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
