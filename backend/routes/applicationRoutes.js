const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requireRole, requireOwner, requireAdmin, requireRecruiterOrAbove, checkPlanLimit } = require('../middleware/rbacMiddleware');
const { tenantScope, requireOrganization } = require('../middleware/tenantMiddleware');
const Application = require('../models/Application');
const Candidate = require('../models/Candidate');
const eventBus = require('../events/eventBus');
const eventTypes = require('../events/eventTypes');

router.use(verifyToken, requireOrganization, tenantScope);

/**
 * GET /
 * List applications (paginated, filterable)
 */
router.get('/', async (req, res) => {
  try {
    const { jobId, stage, assignedTo, isRejected, page = 1, limit = 200 } = req.query;
    const filter = { organizationId: req.user.organizationId };
    if (jobId) filter.jobId = jobId;
    if (stage) filter.stage = stage;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (isRejected !== undefined) filter.isRejected = isRejected === 'true';
    else filter.isRejected = { $ne: true };

    const applications = await Application.find(filter)
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ updatedAt: -1 })
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
    const { jobId } = req.query;
    const filter = { organizationId: req.user.organizationId, isRejected: { $ne: true } };
    if (jobId) filter.jobId = jobId;

    const applications = await Application.find(filter).select('stage createdAt hiredAt isHired').lean();
    const byStage = {};
    let hiredDurations = [];

    for (const app of applications) {
      byStage[app.stage] = (byStage[app.stage] || 0) + 1;
      if (app.isHired && app.hiredAt && app.createdAt) {
        const days = Math.max(0, Math.round((new Date(app.hiredAt) - new Date(app.createdAt)) / (1000 * 60 * 60 * 24)));
        hiredDurations.push(days);
      }
    }

    const avgTime = hiredDurations.length
      ? `${Math.round(hiredDurations.reduce((a, b) => a + b, 0) / hiredDurations.length)}d`
      : 'N/A';

    res.json({
      success: true,
      data: {
        total: applications.length,
        byStage,
        avgTime
      }
    });
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
 * Accepts candidateId, or inline candidate { name, email, contact/phone, ctc? }
 */
router.post('/', requireRecruiterOrAbove, checkPlanLimit('candidates'), async (req, res) => {
  try {
    let { jobId, candidateId, stage = 'Applied', source = 'Direct', assignedTo, candidate } = req.body;

    if (!jobId) return res.status(400).json({ success: false, message: 'jobId is required' });

    if (!candidateId && candidate) {
      const name = (candidate.name || '').trim();
      const email = (candidate.email || '').trim().toLowerCase();
      const contact = (candidate.contact || candidate.phone || '').trim();
      if (!name || !email) {
        return res.status(400).json({ success: false, message: 'Candidate name and email are required' });
      }

      let existingCandidate = await Candidate.findOne({
        email,
        organizationId: req.user.organizationId
      });

      if (!existingCandidate) {
        existingCandidate = new Candidate({
          name,
          email,
          contact: contact || '0000000000',
          ctc: candidate.ctc || 'N/A',
          organizationId: req.user.organizationId,
          createdBy: req.user.id,
          source: source || 'Direct'
        });
        await existingCandidate.save();
      }
      candidateId = existingCandidate._id;
    }

    if (!candidateId) {
      return res.status(400).json({ success: false, message: 'candidateId or candidate details required' });
    }

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
    await application.populate('candidateId jobId assignedTo');

    // Keep job application counter in sync when possible
    try {
      const Job = require('../models/Job');
      await Job.findByIdAndUpdate(jobId, { $inc: { applicationCount: 1 } });
    } catch (_) { /* non-blocking */ }

    res.status(201).json({ success: true, data: application });
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

    const previousStage = application.stage;
    application.stage = stage;
    application.stageHistory.push({ stage, changedAt: new Date(), changedBy: req.user.id, remark });

    if (stage === 'Hired') {
      application.isHired = true;
      application.hiredAt = new Date();
    }

    await application.save();

    eventBus.emit(eventTypes.APPLICATION_STAGE_CHANGED, {
      organizationId: req.user.organizationId,
      userId: req.user.id,
      resourceType: 'Application',
      resourceId: application._id,
      candidateId: application.candidateId,
      jobId: application.jobId,
      previousStage,
      newStage: stage
    });

    // This is the natural cross-product handoff point called out in the
    // productization blueprint: a future HRMS/CRM listener can subscribe to
    // CANDIDATE_HIRED to auto-create an employee/contact record without any
    // changes needed here.
    if (stage === 'Hired') {
      eventBus.emit(eventTypes.CANDIDATE_HIRED, {
        organizationId: req.user.organizationId,
        userId: req.user.id,
        resourceType: 'Application',
        resourceId: application._id,
        candidateId: application.candidateId,
        jobId: application.jobId,
        applicationId: application._id,
        hiredAt: application.hiredAt
      });
    }

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
    if (application) {
      eventBus.emit(eventTypes.APPLICATION_REJECTED, {
        organizationId: req.user.organizationId,
        userId: req.user.id,
        resourceType: 'Application',
        resourceId: application._id,
        candidateId: application.candidateId,
        jobId: application.jobId,
        reason
      });

      // Silver-medalist: auto-add to talent pools marked addOnReject / isDefaultRejectPool
      try {
        const { planHasFeature } = require('../config/planFeatures');
        const Organization = require('../models/Organization');
        const TalentPool = require('../models/TalentPool');
        const Candidate = require('../models/Candidate');
        const org = await Organization.findById(req.user.organizationId).select('plan');
        if (planHasFeature(org?.plan, 'candidates.talentPoolAutomation') && application.candidateId) {
          const pools = await TalentPool.find({
            organizationId: req.user.organizationId,
            $or: [{ addOnReject: true }, { isDefaultRejectPool: true }]
          }).select('_id');
          if (pools.length) {
            await Candidate.updateOne(
              { _id: application.candidateId, organizationId: req.user.organizationId },
              { $addToSet: { talentPoolIds: { $each: pools.map((p) => p._id) } } }
            );
          }
        }
      } catch (poolErr) {
        console.warn('[reject] talent pool automation skipped:', poolErr.message);
      }
    }
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
      { $set: { rating: req.body.rating, lastActivityAt: new Date() } },
      { new: true }
    );
    res.json({ success: true, data: application });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /:id/notes
 */
router.put('/:id/notes', requireRecruiterOrAbove, async (req, res) => {
  try {
    const notes = typeof req.body.notes === 'string' ? req.body.notes : '';
    const application = await Application.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.user.organizationId },
      { $set: { notes, lastActivityAt: new Date() } },
      { new: true }
    );
    if (!application) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: application });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /:id/schedule — store interview schedule in metadata + notes stamp + Interview doc
 */
router.put('/:id/schedule', requireRecruiterOrAbove, async (req, res) => {
  try {
    const { scheduledAt, mode = 'Video', location = '', remark = '', meetingLink = '', duration = 60 } = req.body;
    if (!scheduledAt) {
      return res.status(400).json({ success: false, message: 'scheduledAt is required' });
    }

    const application = await Application.findOne({ _id: req.params.id, organizationId: req.user.organizationId });
    if (!application) return res.status(404).json({ success: false, message: 'Not found' });

    const when = new Date(scheduledAt);
    application.metadata = {
      ...(application.metadata || {}),
      interview: { scheduledAt: when, mode, location, meetingLink, remark, updatedAt: new Date(), updatedBy: req.user.id }
    };
    application.lastActivityAt = new Date();

    const stamp = `\n[Interview scheduled] ${when.toLocaleString()} · ${mode}${location ? ` · ${location}` : ''}${remark ? ` — ${remark}` : ''}`;
    application.notes = `${application.notes || ''}${stamp}`.trim();

    // Auto-advance to Interview if still earlier in pipeline
    const earlyStages = ['Applied', 'Screening'];
    if (earlyStages.includes(application.stage)) {
      application.stage = 'Interview';
      application.stageHistory.push({
        stage: 'Interview',
        changedAt: new Date(),
        changedBy: req.user.id,
        remark: 'Auto-moved on schedule'
      });
    }

    await application.save();

    // Keep Interview collection in sync so /interviews page stays accurate
    try {
      const Interview = require('../models/Interview');
      const typeMap = {
        Video: 'video',
        Phone: 'phone_screen',
        Onsite: 'in_person',
        video: 'video',
        phone_screen: 'phone_screen',
        in_person: 'in_person',
        panel: 'panel',
        technical: 'technical',
        hr: 'hr'
      };
      const interviewType = typeMap[mode] || 'video';
      let interview = await Interview.findOne({
        organizationId: req.user.organizationId,
        applicationId: application._id,
        status: { $in: ['scheduled', 'rescheduled', 'in_progress'] }
      });
      if (interview) {
        interview.scheduledAt = when;
        interview.type = interviewType;
        interview.location = location || '';
        interview.meetingLink = meetingLink || location || '';
        interview.duration = duration || 60;
        interview.status = 'scheduled';
        await interview.save();
      } else {
        interview = await Interview.create({
          organizationId: req.user.organizationId,
          applicationId: application._id,
          candidateId: application.candidateId,
          jobId: application.jobId,
          interviewers: [{ userId: req.user.id, name: req.user.name || '', email: req.user.email || '' }],
          scheduledAt: when,
          duration: duration || 60,
          type: interviewType,
          location: location || '',
          meetingLink: meetingLink || (mode === 'Video' ? location : '') || '',
          status: 'scheduled',
          createdBy: req.user.id
        });
      }
      application.metadata.interview.interviewId = interview._id;
      await application.save();
    } catch (syncErr) {
      console.warn('Interview sync skipped:', syncErr.message);
    }

    await application.populate('candidateId jobId assignedTo');
    res.json({ success: true, data: application });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * DELETE /:id
 */
router.delete('/:id', requireRecruiterOrAbove, async (req, res) => {
  try {
    const deleted = await Application.findOneAndDelete({ _id: req.params.id, organizationId: req.user.organizationId });
    if (!deleted) return res.status(404).json({ success: false, message: 'Application not found' });
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
