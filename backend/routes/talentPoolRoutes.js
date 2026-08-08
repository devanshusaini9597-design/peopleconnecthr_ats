/**
 * Talent Pools — Add-on (feature key: candidates.talentPools)
 * Thin wrappers; logic in talentPoolService.
 */
const express = require('express');
const router = express.Router();
const { requireRecruiterOrAbove } = require('../middleware/rbacMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');
const svc = require('../services/talentPoolService');

router.use(requireFeature('candidates.talentPools'));

function handle(res, error) {
  const status = error.statusCode || 500;
  const body = { success: false, message: error.message };
  if (error.code) body.code = error.code;
  if (error.feature) body.feature = error.feature;
  if (error.skipped) body.skipped = error.skipped;
  return res.status(status).json(body);
}

router.get('/', async (req, res) => {
  try {
    const data = await svc.listPools(req.user.organizationId);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/', requireRecruiterOrAbove, async (req, res) => {
  try {
    const data = await svc.createPool(req.user.organizationId, req.user.id || req.user._id, req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.patch('/:id', requireRecruiterOrAbove, async (req, res) => {
  try {
    const data = await svc.updatePool(req.user.organizationId, req.params.id, req.body);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/suggest', requireRecruiterOrAbove, requireFeature('candidates.talentPoolAutomation'), async (req, res) => {
  try {
    const data = await svc.suggestCandidates(req.user.organizationId, req.body);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/:id/campaign', requireRecruiterOrAbove, requireFeature('candidates.talentPoolAutomation'), async (req, res) => {
  try {
    const result = await svc.runCampaign(req.user.organizationId, req.user, req.params.id, req.body);
    res.json({ success: true, ...result });
  } catch (error) {
    handle(res, error);
  }
});

router.delete('/:id', requireRecruiterOrAbove, async (req, res) => {
  try {
    const result = await svc.deletePool(req.user.organizationId, req.params.id);
    res.json({ success: true, ...result });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/:id/candidates', async (req, res) => {
  try {
    const data = await svc.listPoolCandidates(req.user.organizationId, req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/:id/candidates', requireRecruiterOrAbove, async (req, res) => {
  try {
    const result = await svc.addCandidates(req.user.organizationId, req.params.id, req.body.candidateIds);
    res.json({ success: true, ...result });
  } catch (error) {
    handle(res, error);
  }
});

router.delete('/:id/candidates/:candidateId', requireRecruiterOrAbove, async (req, res) => {
  try {
    const result = await svc.removeCandidate(req.user.organizationId, req.params.id, req.params.candidateId);
    res.json({ success: true, ...result });
  } catch (error) {
    handle(res, error);
  }
});

module.exports = router;
