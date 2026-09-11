const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requireOrganization } = require('../middleware/tenantMiddleware');
const { requireFreelancerOrRecruiter, requireRecruiterOrAbove } = require('../middleware/rbacMiddleware');
const { isFreelancer } = require('../utils/dataScope');
const svc = require('../services/freelancerService');

router.use(verifyToken, requireOrganization);

function handle(res, error) {
  const payload = { success: false, message: error.message };
  if (error.code) payload.code = error.code;
  if (error.duplicates) payload.duplicates = error.duplicates;
  if (error.approval) payload.approval = error.approval;
  if (error.missing) payload.missing = error.missing;
  if (error.quality) payload.quality = error.quality;
  if (error.capacity) payload.capacity = error.capacity;
  if (error.used != null) payload.used = error.used;
  if (error.max != null) payload.max = error.max;
  if (error.blocked != null) payload.blocked = error.blocked;
  res.status(error.statusCode || 500).json(payload);
}

const run = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    handle(res, error);
  }
};

router.post('/heartbeat', run(async (req, res) => {
  const data = await svc.heartbeat(req.user);
  res.json({ success: true, data });
}));

router.get('/presence', requireRecruiterOrAbove, run(async (req, res) => {
  const data = await svc.listFreelancerPresence(req.user);
  res.json({ success: true, data });
}));

router.get('/desk', run(async (req, res) => {
  if (!isFreelancer(req.user)) {
    return res.status(403).json({ success: false, message: 'Freelance recruiter access required' });
  }
  const data = await svc.getDeskSummary(req.user);
  res.json({ success: true, data });
}));

router.get('/desk-settings', requireFreelancerOrRecruiter, run(async (req, res) => {
  const data = await svc.getDeskSettingsForUser(req.user);
  res.json({ success: true, data });
}));

router.get('/placement-stats', requireFreelancerOrRecruiter, run(async (req, res) => {
  const data = await svc.getPlacementStats(req.user);
  res.json({ success: true, data });
}));

router.get('/spocs', run(async (req, res) => {
  const data = await svc.listSpocs(req.user);
  res.json({ success: true, data });
}));

router.get('/reviewers', requireRecruiterOrAbove, run(async (req, res) => {
  const data = await svc.listReviewers(req.user);
  res.json({ success: true, data });
}));

router.get('/mandates', run(async (req, res) => {
  const data = await svc.listMandates(req.user);
  res.json({ success: true, data });
}));

router.get('/mandates/:jobId/capacity', run(async (req, res) => {
  if (!isFreelancer(req.user)) {
    return res.status(403).json({ success: false, message: 'Freelance recruiter access required' });
  }
  const data = await svc.getMandateCapacity(req.user, req.params.jobId);
  res.json({ success: true, data });
}));

router.get('/candidates', run(async (req, res) => {
  const data = await svc.listOwnCandidates(req.user);
  res.json({ success: true, data });
}));

router.post('/submissions/preview-quality', run(async (req, res) => {
  if (!isFreelancer(req.user)) {
    return res.status(403).json({ success: false, message: 'Freelance recruiter access required' });
  }
  const data = await svc.previewSubmissionQuality(req.user, req.body || {});
  res.json({ success: true, data });
}));

router.get('/submissions', requireFreelancerOrRecruiter, run(async (req, res) => {
  const includeArchived = ['1', 'true', 'yes'].includes(String(req.query.includeArchived || '').toLowerCase());
  const data = await svc.listSubmissions(req.user, { includeArchived });
  res.json({ success: true, data });
}));

router.post('/submissions', run(async (req, res) => {
  if (!isFreelancer(req.user)) {
    return res.status(403).json({ success: false, message: 'Freelance recruiter access required' });
  }
  const data = await svc.createSubmission(req.user, req.body);
  res.status(201).json({ success: true, data });
}));

router.post('/submissions/bulk', requireRecruiterOrAbove, run(async (req, res) => {
  const data = await svc.bulkDeskAction(req.user, req.body);
  res.json({ success: true, data });
}));

router.patch('/submissions/:id/status', requireRecruiterOrAbove, run(async (req, res) => {
  const data = await svc.updateSubmissionStatus(req.user, req.params.id, req.body);
  res.json({ success: true, data });
}));

router.patch('/submissions/:id/scorecard', requireRecruiterOrAbove, run(async (req, res) => {
  const data = await svc.saveDeskScorecard(req.user, req.params.id, req.body);
  res.json({ success: true, data });
}));

router.patch('/submissions/:id/approval', requireRecruiterOrAbove, run(async (req, res) => {
  const data = await svc.decideDeskApproval(req.user, req.params.id, req.body);
  res.json({ success: true, data });
}));

router.patch('/submissions/:id/archive', requireRecruiterOrAbove, run(async (req, res) => {
  const data = await svc.archiveSubmission(req.user, req.params.id);
  res.json({ success: true, data });
}));

router.patch('/submissions/:id/restore', requireRecruiterOrAbove, run(async (req, res) => {
  const data = await svc.restoreSubmission(req.user, req.params.id);
  res.json({ success: true, data });
}));

router.patch('/submissions/:id/spoc', requireRecruiterOrAbove, run(async (req, res) => {
  const data = await svc.reassignSpoc(req.user, req.params.id, req.body?.spocUserId);
  res.json({ success: true, data });
}));

router.patch('/submissions/:id/candidate', requireRecruiterOrAbove, run(async (req, res) => {
  const data = await svc.updateCandidateFromDesk(req.user, req.params.id, req.body);
  res.json({ success: true, data });
}));

router.delete('/submissions/:id', requireRecruiterOrAbove, run(async (req, res) => {
  const deleteCandidate = ['1', 'true', 'yes'].includes(String(req.query.deleteCandidate || '').toLowerCase());
  const data = await svc.hardDeleteSubmission(req.user, req.params.id, { deleteCandidate });
  res.json({ success: true, data });
}));

router.post('/submissions/:id/request-feedback', run(async (req, res) => {
  if (!isFreelancer(req.user)) {
    return res.status(403).json({ success: false, message: 'Freelance recruiter access required' });
  }
  const data = await svc.requestFeedback(req.user, req.params.id);
  res.json({ success: true, data });
}));

module.exports = router;
