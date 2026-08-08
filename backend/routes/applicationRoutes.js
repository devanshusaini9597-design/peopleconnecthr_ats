const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requireAdmin, requireRecruiterOrAbove, checkPlanLimit } = require('../middleware/rbacMiddleware');
const { tenantScope, requireOrganization } = require('../middleware/tenantMiddleware');
const applicationService = require('../services/applicationService');

router.use(verifyToken, requireOrganization, tenantScope);

function handle(res, error) {
  res.status(error.statusCode || 500).json({ success: false, message: error.message });
}

const run = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    handle(res, error);
  }
};

router.get('/', run(async (req, res) => {
  const applications = await applicationService.listApplications(req.user.organizationId, req.query);
  res.json({ success: true, data: applications });
}));

router.get('/stats', run(async (req, res) => {
  const data = await applicationService.getStats(req.user.organizationId, { jobId: req.query.jobId });
  res.json({ success: true, data });
}));

router.get('/:id', run(async (req, res) => {
  const application = await applicationService.getApplication(req.user.organizationId, req.params.id);
  res.json({ success: true, data: application });
}));

router.post('/', requireRecruiterOrAbove, checkPlanLimit('candidates'), run(async (req, res) => {
  const application = await applicationService.createApplication(req.user, req.body);
  res.status(201).json({ success: true, data: application });
}));

router.put('/:id/stage', requireRecruiterOrAbove, run(async (req, res) => {
  const application = await applicationService.changeStage(req.user, req.params.id, req.body);
  res.json({ success: true, data: application });
}));

router.put('/:id/assign', requireAdmin, run(async (req, res) => {
  const application = await applicationService.assignApplication(
    req.user.organizationId,
    req.params.id,
    req.body.assignedTo
  );
  res.json({ success: true, data: application });
}));

router.put('/:id/reject', requireRecruiterOrAbove, run(async (req, res) => {
  const application = await applicationService.rejectApplication(req.user, req.params.id, req.body);
  res.json({ success: true, data: application });
}));

router.put('/:id/rating', requireRecruiterOrAbove, run(async (req, res) => {
  const application = await applicationService.updateRating(
    req.user.organizationId,
    req.params.id,
    req.body.rating
  );
  res.json({ success: true, data: application });
}));

router.put('/:id/notes', requireRecruiterOrAbove, run(async (req, res) => {
  const application = await applicationService.updateNotes(
    req.user.organizationId,
    req.params.id,
    req.body.notes
  );
  res.json({ success: true, data: application });
}));

router.put('/:id/schedule', requireRecruiterOrAbove, run(async (req, res) => {
  const application = await applicationService.scheduleInterview(req.user, req.params.id, req.body);
  res.json({ success: true, data: application });
}));

router.delete('/:id', requireRecruiterOrAbove, run(async (req, res) => {
  const result = await applicationService.deleteApplication(req.user.organizationId, req.params.id);
  res.json({ success: true, ...result });
}));

router.get('/job/:jobId', run(async (req, res) => {
  const applications = await applicationService.listByJob(req.user.organizationId, req.params.jobId);
  res.json({ success: true, data: applications });
}));

router.get('/candidate/:candidateId', run(async (req, res) => {
  const applications = await applicationService.listByCandidate(
    req.user.organizationId,
    req.params.candidateId
  );
  res.json({ success: true, data: applications });
}));

module.exports = router;
