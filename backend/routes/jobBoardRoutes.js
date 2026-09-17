/**
 * Job Board posting — Enterprise, gated by 'integrations.jobBoard'.
 * Uses the BYOK adapter registry (adapters/jobBoardAdapter.js via
 * adapters/index.js) the same way email/SMS/calendar do.
 */
const express = require('express');
const router = express.Router();

const { verifyToken } = require('../middleware/authMiddleware');
const { requireRecruiterOrAbove } = require('../middleware/rbacMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');
const { requireOrganization, tenantScope } = require('../middleware/tenantMiddleware');
const { getAdapter } = require('../adapters');
const Job = require('../models/Job');
const Organization = require('../models/Organization');
const eventBus = require('../events/eventBus');
const eventTypes = require('../events/eventTypes');
const { ensurePublicId, careersJobPathSegment } = require('../services/jobPublicIdService');

router.use(verifyToken, requireOrganization, tenantScope, requireRecruiterOrAbove, requireFeature('integrations.jobBoard'));

router.post('/jobs/:jobId/post', async (req, res) => {
  try {
    const job = await Job.findOne({ _id: req.params.jobId, organizationId: req.user.organizationId });
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

    const adapter = await getAdapter(req.user.organizationId, 'job_board');
    if (!adapter) {
      return res.status(400).json({
        success: false,
        message: 'No active job board integration configured. Add LinkedIn or another board under Organization → Integrations.',
      });
    }

    const org = await Organization.findById(req.user.organizationId).select('slug name').lean();
    const frontendBase = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
    await ensurePublicId(job);
    const applyUrl = org?.slug && frontendBase
      ? `${frontendBase}/careers/${org.slug}/jobs/${careersJobPathSegment(job)}`
      : '';

    if (!applyUrl) {
      return res.status(400).json({
        success: false,
        message: 'Careers apply URL could not be built. Ensure the organization has a careers slug and FRONTEND_URL is set.',
      });
    }

    // Ensure job is discoverable on the public careers page before external posting.
    if (!job.isPublished) {
      job.isPublished = true;
      if (!job.status || job.status === 'Draft') job.status = 'Open';
      await job.save();
    }

    const jobPayload = {
      ...job.toObject(),
      title: job.title || job.role,
      applyUrl,
      description: job.description || job.summary || '',
      location: job.location || 'Remote',
      employmentType: job.employmentType || 'FULL_TIME',
    };

    const result = await adapter.postJob(jobPayload);

    job.jobBoardPostings.push({
      provider: req.body.provider || 'unknown',
      status: 'posted',
      externalRef: result.externalId || result.jobId || result.linkedInId || '',
      postedBy: req.user.id
    });
    await job.save();

    eventBus.emit(eventTypes.INTEGRATION_CONFIGURED, {
      organizationId: req.user.organizationId, userId: req.user.id,
      resourceType: 'Job', resourceId: job._id, action: 'job_board_posted'
    });

    res.json({ success: true, data: { ...result, applyUrl } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/jobs/:jobId/remove', async (req, res) => {
  try {
    const job = await Job.findOne({ _id: req.params.jobId, organizationId: req.user.organizationId });
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

    const adapter = await getAdapter(req.user.organizationId, 'job_board');
    if (!adapter) {
      return res.status(400).json({ success: false, message: 'No active job board integration configured for this organization.' });
    }

    const result = await adapter.removeJob(job._id.toString());
    job.jobBoardPostings.push({ provider: req.body.provider || 'unknown', status: 'removed', postedBy: req.user.id });
    await job.save();

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/jobs/:jobId/postings', async (req, res) => {
  try {
    const job = await Job.findOne({ _id: req.params.jobId, organizationId: req.user.organizationId }).select('jobBoardPostings');
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    res.json({ success: true, data: job.jobBoardPostings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
