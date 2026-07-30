const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requireRole, requireOwner, requireAdmin, requireRecruiterOrAbove, checkPlanLimit } = require('../middleware/rbacMiddleware');
const { tenantScope, requireOrganization } = require('../middleware/tenantMiddleware');
const Application = require('../models/Application');
const Candidate = require('../models/Candidate');

router.use(verifyToken, requireOrganization, tenantScope);

/**
 * GET /
 * List applications (paginated, filterable)
 */
router.get('/', async (req, res) => {
  try {
    const { jobId, stage, assignedTo, isRejected, page = 1, limit = 20 } = req.query;
    const filter = { organizationId: req.user.organizationId };
    if (jobId) filter.jobId = jobId;
    if (stage) filter.stage = stage;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (isRejected !== undefined) filter.isRejected = isRejected === 'true';

    const applications = await Application.find(filter)
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('candidateId jobId assignedTo');
    
    res.json({ success: true, data: applications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /stats
 */
router.get('/stats', async (req, res) => {
  try {
    // STUB: Aggregation for pipeline stats
    res.json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /:id
 */
router.get('/:id', async (req, res) => {
  try {
    const application = await Application.findOne({ _id: req.params.id, organizationId: req.user.organizationId })
      .populate('candidateId jobId assignedTo'); // STUB: also populate interviews
    if (!application) return res.status(404).json({ success: false, message: 'Application not found' });
    res.json({ success: true, data: application });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /
 */
router.post('/', requireRecruiterOrAbove, checkPlanLimit('candidates'), async (req, res) => {
  try {
    const { jobId, candidateId, stage = 'Applied', source, assignedTo } = req.body;
    
    const existing = await Application.findOne({ jobId, candidateId, organizationId: req.user.organizationId });
    if (existing) return res.status(400).json({ success: false, message: 'Candidate already applied to this job' });

    const application = new Application({
      organizationId: req.user.organizationId,
      jobId,
      candidateId,
      stage,
      source,
      assignedTo,
      stageHistory: [{ stage, changedAt: new Date(), changedBy: req.user.id }]
    });

    await application.save();
    res.json({ success: true, data: application });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /:id/stage
 */
router.put('/:id/stage', requireRecruiterOrAbove, async (req, res) => {
  try {
    const { stage, remark } = req.body;
    const application = await Application.findOne({ _id: req.params.id, organizationId: req.user.organizationId });
    if (!application) return res.status(404).json({ success: false, message: 'Not found' });

    application.stage = stage;
    application.stageHistory.push({ stage, changedAt: new Date(), changedBy: req.user.id, remark });

    if (stage === 'Hired') {
      application.isHired = true;
      application.hiredAt = new Date();
      // STUB: Emit CANDIDATE_HIRED
    }

    await application.save();
    // STUB: Emit APPLICATION_STAGE_CHANGED
    res.json({ success: true, data: application });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /:id/assign
 */
router.put('/:id/assign', requireAdmin, async (req, res) => {
  try {
    const application = await Application.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.user.organizationId },
      { $set: { assignedTo: req.body.assignedTo } },
      { new: true }
    );
    res.json({ success: true, data: application });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /:id/reject
 */
router.put('/:id/reject', requireRecruiterOrAbove, async (req, res) => {
  try {
    const { reason } = req.body;
    const application = await Application.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.user.organizationId },
      { $set: { isRejected: true, rejectedAt: new Date(), rejectedBy: req.user.id, rejectionReason: reason } },
      { new: true }
    );
    // STUB: Emit APPLICATION_REJECTED
    res.json({ success: true, data: application });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /:id/rating
 */
router.put('/:id/rating', requireRecruiterOrAbove, async (req, res) => {
  try {
    const application = await Application.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.user.organizationId },
      { $set: { rating: req.body.rating } },
      { new: true }
    );
    res.json({ success: true, data: application });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * DELETE /:id
 */
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await Application.findOneAndDelete({ _id: req.params.id, organizationId: req.user.organizationId });
    res.json({ success: true, message: 'Application deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /job/:jobId
 */
router.get('/job/:jobId', async (req, res) => {
  try {
    const applications = await Application.find({ jobId: req.params.jobId, organizationId: req.user.organizationId }).populate('candidateId');
    res.json({ success: true, data: applications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /candidate/:candidateId
 */
router.get('/candidate/:candidateId', async (req, res) => {
  try {
    const applications = await Application.find({ candidateId: req.params.candidateId, organizationId: req.user.organizationId });
    res.json({ success: true, data: applications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
