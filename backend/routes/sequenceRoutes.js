/**
 * Outreach sequences — Professional+ (messaging.sequences)
 * Thin wrappers; domain logic in sequenceService.
 */
const express = require('express');
const router = express.Router();
const { requireRecruiterOrAbove } = require('../middleware/rbacMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');
const svc = require('../services/sequenceService');

function handle(res, error) {
  const status = error.statusCode || 500;
  return res.status(status).json({ success: false, message: error.message });
}

router.use(requireFeature('messaging.sequences'));

// GET /api/sequences
router.get('/', async (req, res) => {
  try {
    const data = await svc.listSequences(req.user.organizationId);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

// POST /api/sequences
router.post('/', requireRecruiterOrAbove, async (req, res) => {
  try {
    const sequence = await svc.createSequence(req.user.organizationId, req.user, req.body);
    res.status(201).json({ success: true, data: sequence });
  } catch (error) {
    handle(res, error);
  }
});

// PATCH /api/sequences/:id
router.patch('/:id', requireRecruiterOrAbove, async (req, res) => {
  try {
    const sequence = await svc.updateSequence(req.user.organizationId, req.params.id, req.body);
    res.json({ success: true, data: sequence });
  } catch (error) {
    handle(res, error);
  }
});

// DELETE /api/sequences/:id
router.delete('/:id', requireRecruiterOrAbove, async (req, res) => {
  try {
    await svc.deleteSequence(req.user.organizationId, req.params.id);
    res.json({ success: true });
  } catch (error) {
    handle(res, error);
  }
});

// POST /api/sequences/:id/enroll — { candidateIds: [] }
router.post('/:id/enroll', requireRecruiterOrAbove, async (req, res) => {
  try {
    const { enrolled, skipped } = await svc.enrollCandidates(
      req.user.organizationId,
      req.user,
      req.params.id,
      req.body
    );
    res.status(201).json({ success: true, enrolled, skipped });
  } catch (error) {
    handle(res, error);
  }
});

// GET /api/sequences/:id/enrollments
router.get('/:id/enrollments', async (req, res) => {
  try {
    const data = await svc.listEnrollments(req.user.organizationId, req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

// POST /api/sequences/process — process due enrollments (manual / cron)
router.post('/process', requireRecruiterOrAbove, async (req, res) => {
  try {
    const { processed, errors, due } = await svc.processDueEnrollments(
      req.user.organizationId,
      req.user
    );
    res.json({ success: true, processed, errors, due });
  } catch (error) {
    handle(res, error);
  }
});

module.exports = router;
