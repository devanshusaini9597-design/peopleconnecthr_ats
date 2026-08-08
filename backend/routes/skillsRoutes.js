/**
 * Skills taxonomy — Professional+ (candidates.skillsTaxonomy)
 * Thin wrappers; domain logic in skillsService.
 */
const express = require('express');
const router = express.Router();
const { requireRecruiterOrAbove } = require('../middleware/rbacMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');
const svc = require('../services/skillsService');

function handle(res, error) {
  const status = error.statusCode || 500;
  const body = { success: false, message: error.message };
  if (error.data) body.data = error.data;
  return res.status(status).json(body);
}

router.use(requireFeature('candidates.skillsTaxonomy'));

// GET /api/skills — paginated catalog (page + limit)
router.get('/', async (req, res) => {
  try {
    const result = await svc.listSkills(req.user.organizationId, req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    handle(res, error);
  }
});

// POST /api/skills — create org custom skill
router.post('/', requireRecruiterOrAbove, async (req, res) => {
  try {
    const skill = await svc.createSkill(req.user.organizationId, req.body);
    res.status(201).json({ success: true, data: skill });
  } catch (error) {
    handle(res, error);
  }
});

// POST /api/skills/seed — import system catalog
router.post('/seed', requireRecruiterOrAbove, async (req, res) => {
  try {
    const result = await svc.seedSkills();
    res.json({ success: true, ...result });
  } catch (error) {
    handle(res, error);
  }
});

// GET /api/skills/candidate/:candidateId
router.get('/candidate/:candidateId', async (req, res) => {
  try {
    const data = await svc.getCandidateSkills(req.user.organizationId, req.params.candidateId);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

// PUT /api/skills/candidate/:candidateId — replace candidate skills
router.put('/candidate/:candidateId', requireRecruiterOrAbove, async (req, res) => {
  try {
    const data = await svc.replaceCandidateSkills(
      req.user.organizationId,
      req.params.candidateId,
      req.body
    );
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

// GET /api/skills/job/:jobId
router.get('/job/:jobId', async (req, res) => {
  try {
    const data = await svc.getJobSkills(req.user.organizationId, req.params.jobId);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

// PUT /api/skills/job/:jobId
router.put('/job/:jobId', requireRecruiterOrAbove, async (req, res) => {
  try {
    const data = await svc.replaceJobSkills(req.user.organizationId, req.params.jobId, req.body);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

// POST /api/skills/match — { jobId, candidateId }
router.post('/match', async (req, res) => {
  try {
    const data = await svc.matchSkills(req.user.organizationId, req.body);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

// PATCH /api/skills/:id — rename / recategorize org custom skills only
router.patch('/:id', requireRecruiterOrAbove, async (req, res) => {
  try {
    const skill = await svc.updateSkill(req.user.organizationId, req.params.id, req.body);
    res.json({ success: true, data: skill });
  } catch (error) {
    handle(res, error);
  }
});

// DELETE /api/skills/:id — only org custom skills
router.delete('/:id', requireRecruiterOrAbove, async (req, res) => {
  try {
    await svc.deleteSkill(req.user.organizationId, req.params.id);
    res.json({ success: true });
  } catch (error) {
    handle(res, error);
  }
});

module.exports = router;
