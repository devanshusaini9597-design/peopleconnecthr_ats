const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requireRole, requireOwner, requireAdmin, requireRecruiterOrAbove, checkPlanLimit } = require('../middleware/rbacMiddleware');
const { tenantScope, requireOrganization } = require('../middleware/tenantMiddleware');
const Interview = require('../models/Interview');
const Scorecard = require('../models/Scorecard');
const Application = require('../models/Application');
const eventBus = require('../events/eventBus');
const eventTypes = require('../events/eventTypes');

router.use(verifyToken, requireOrganization, tenantScope);

/**
 * GET /
 */
const populateInterview = {
  path: 'applicationId',
  populate: [{ path: 'candidateId', select: 'name email phone' }, { path: 'jobId', select: 'title role' }]
};

router.get('/', async (req, res) => {
  try {
    const { status, interviewer } = req.query;
    const filter = { organizationId: req.user.organizationId };
    if (status) filter.status = status;
    if (interviewer) filter.interviewers = { $elemMatch: { userId: interviewer } };
    
    const interviews = await Interview.find(filter).sort({ scheduledAt: 1 }).populate(populateInterview);
    res.json({ success: true, data: interviews });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /my
 */
router.get('/my', async (req, res) => {
  try {
    const interviews = await Interview.find({ 
      organizationId: req.user.organizationId,
      'interviewers.userId': req.user.id 
    }).sort({ scheduledAt: 1 }).populate(populateInterview);
    res.json({ success: true, data: interviews });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /:id
 */
router.get('/:id', async (req, res) => {
  try {
    const interview = await Interview.findOne({ _id: req.params.id, organizationId: req.user.organizationId }).populate('applicationId interviewers.userId');
    if (!interview) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: interview });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /
 */
router.post('/', requireRecruiterOrAbove, async (req, res) => {
  try {
    const { applicationId, interviewers, scheduledAt, duration, type, location, meetingLink } = req.body;
    if (!applicationId || !scheduledAt) {
      return res.status(400).json({ success: false, message: 'applicationId and scheduledAt are required' });
    }
    
    const app = await Application.findOne({ _id: applicationId, organizationId: req.user.organizationId });
    if (!app) return res.status(404).json({ success: false, message: 'Application not found' });
    
    const interview = new Interview({
      organizationId: req.user.organizationId,
      applicationId,
      candidateId: app.candidateId,
      jobId: app.jobId,
      interviewers: Array.isArray(interviewers) && interviewers.length
        ? interviewers
        : [{ userId: req.user.id, name: req.user.name || '', email: req.user.email || '' }],
      scheduledAt,
      duration: duration || 60,
      type: type || 'video',
      location: location || '',
      meetingLink: meetingLink || '',
      status: 'scheduled',
      createdBy: req.user.id
    });
    await interview.save();
    await interview.populate(populateInterview);
    eventBus.emit(eventTypes.INTERVIEW_SCHEDULED, {
      organizationId: req.user.organizationId,
      userId: req.user.id,
      resourceType: 'Interview',
      resourceId: interview._id,
      applicationId,
      scheduledAt
    });
    res.json({ success: true, data: interview });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /:id
 */
router.put('/:id', requireRecruiterOrAbove, async (req, res) => {
  try {
    const interview = await Interview.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.user.organizationId },
      { $set: req.body },
      { new: true }
    );
    res.json({ success: true, data: interview });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /:id/cancel
 */
router.put('/:id/cancel', requireRecruiterOrAbove, async (req, res) => {
  try {
    const interview = await Interview.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.user.organizationId },
      { $set: { status: 'cancelled', cancelledAt: new Date(), cancelledBy: req.user.id, cancelReason: req.body.reason } },
      { new: true }
    );
    if (interview) {
      eventBus.emit(eventTypes.INTERVIEW_CANCELLED, {
        organizationId: req.user.organizationId,
        userId: req.user.id,
        resourceType: 'Interview',
        resourceId: interview._id,
        reason: req.body.reason
      });
    }
    res.json({ success: true, data: interview });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /:id/complete
 */
router.put('/:id/complete', requireRecruiterOrAbove, async (req, res) => {
  try {
    const interview = await Interview.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.user.organizationId },
      { $set: { status: 'completed' } },
      { new: true }
    );
    if (interview) {
      eventBus.emit(eventTypes.INTERVIEW_COMPLETED, {
        organizationId: req.user.organizationId,
        userId: req.user.id,
        resourceType: 'Interview',
        resourceId: interview._id
      });
    }
    res.json({ success: true, data: interview });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /:id/scorecards
 */
router.get('/:id/scorecards', async (req, res) => {
  try {
    const scorecards = await Scorecard.find({ interviewId: req.params.id, organizationId: req.user.organizationId });
    res.json({ success: true, data: scorecards });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /:interviewId/scorecard
 */
router.post('/:interviewId/scorecard', async (req, res) => {
  try {
    const interview = await Interview.findOne({ _id: req.params.interviewId, organizationId: req.user.organizationId });
    if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });
    
    const isAssigned = interview.interviewers.some(i => i.userId.toString() === req.user.id.toString());
    if (!isAssigned) return res.status(403).json({ success: false, message: 'Only assigned interviewers can submit scorecards' });
    
    const { criteria, overallRating, recommendation, strengths, concerns, notes, isDraft } = req.body;
    
    const scorecard = new Scorecard({
      organizationId: req.user.organizationId,
      interviewId: req.params.interviewId,
      applicationId: interview.applicationId,
      interviewerId: req.user.id,
      criteria,
      overallRating,
      recommendation,
      strengths,
      concerns,
      notes,
      isDraft: isDraft || false
    });
    await scorecard.save();
    if (!scorecard.isDraft) {
      eventBus.emit(eventTypes.SCORECARD_SUBMITTED, {
        organizationId: req.user.organizationId,
        userId: req.user.id,
        resourceType: 'Scorecard',
        resourceId: scorecard._id,
        interviewId: req.params.interviewId,
        recommendation
      });
    }
    res.json({ success: true, data: scorecard });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /scorecard/:id
 */
router.put('/scorecard/:id', async (req, res) => {
  try {
    const scorecard = await Scorecard.findOne({ _id: req.params.id, organizationId: req.user.organizationId });
    if (!scorecard) return res.status(404).json({ success: false, message: 'Not found' });
    if (scorecard.interviewerId.toString() !== req.user.id.toString()) return res.status(403).json({ success: false, message: 'Unauthorized' });
    if (!scorecard.isDraft) return res.status(400).json({ success: false, message: 'Cannot edit submitted scorecard' });
    
    Object.assign(scorecard, req.body);
    await scorecard.save();
    res.json({ success: true, data: scorecard });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
