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
const eventBus = require('../events/eventBus');
const eventTypes = require('../events/eventTypes');

router.use(verifyToken, requireOrganization, tenantScope, requireRecruiterOrAbove, requireFeature('integrations.jobBoard'));

router.post('/jobs/:jobId/post', async (req, res) => {
  try {
    const job = await Job.findOne({ _id: req.params.jobId, organizationId: req.user.organizationId });
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

    const adapter = await getAdapter(req.user.organizationId, 'job_board');
    if (!adapter) {
      return res.status(400).json({ success: false, message: 'No active job board integration configured for this organization.' });
    }

    const result = await adapter.postJob(job);

    job.jobBoardPostings.push({
      provider: req.body.provider || 'unknown',
      status: 'posted',
      externalRef: result.externalId || result.jobId || '',
      postedBy: req.user.id
    });
    await job.save();

    eventBus.emit(eventTypes.INTEGRATION_CONFIGURED, {
      organizationId: req.user.organizationId, userId: req.user.id,
      resourceType: 'Job', resourceId: job._id, action: 'job_board_posted'
    });

    res.json({ success: true, data: result });
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
