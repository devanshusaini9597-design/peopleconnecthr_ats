const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requireOrganization } = require('../middleware/tenantMiddleware');
const { requireFreelancerOrRecruiter, requireRecruiterOrAbove } = require('../middleware/rbacMiddleware');
const { isFreelancer } = require('../utils/dataScope');
const svc = require('../services/freelancerService');

router.use(verifyToken, requireOrganization);

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

router.get('/desk', run(async (req, res) => {
  if (!isFreelancer(req.user)) {
    return res.status(403).json({ success: false, message: 'Freelance recruiter access required' });
  }
  const data = await svc.getDeskSummary(req.user);
  res.json({ success: true, data });
}));

router.get('/spocs', run(async (req, res) => {
  const data = await svc.listSpocs(req.user);
  res.json({ success: true, data });
}));

router.get('/mandates', run(async (req, res) => {
  const data = await svc.listMandates(req.user);
  res.json({ success: true, data });
}));

router.get('/candidates', run(async (req, res) => {
  const data = await svc.listOwnCandidates(req.user);
  res.json({ success: true, data });
}));

router.get('/submissions', requireFreelancerOrRecruiter, run(async (req, res) => {
  const data = await svc.listSubmissions(req.user);
  res.json({ success: true, data });
}));

router.post('/submissions', run(async (req, res) => {
  if (!isFreelancer(req.user)) {
    return res.status(403).json({ success: false, message: 'Freelance recruiter access required' });
  }
  const data = await svc.createSubmission(req.user, req.body);
  res.status(201).json({ success: true, data });
}));

router.patch('/submissions/:id/status', requireRecruiterOrAbove, run(async (req, res) => {
  const data = await svc.updateSubmissionStatus(req.user, req.params.id, req.body.status);
  res.json({ success: true, data });
}));

module.exports = router;
