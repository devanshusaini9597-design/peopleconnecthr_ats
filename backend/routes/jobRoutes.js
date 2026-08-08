/**
 * Job CRUD routes (extracted from server.js).
 * Mounted at /jobs with verifyToken applied per-route (legacy path without /api).
 */
const express = require('express');
const Job = require('../models/Job');
const Organization = require('../models/Organization');
const { verifyToken } = require('../middleware/authMiddleware');
const { requireRecruiterOrAbove, checkPlanLimit } = require('../middleware/rbacMiddleware');
const eventBus = require('../events/eventBus');
const eventTypes = require('../events/eventTypes');

const router = express.Router();

router.get('/', verifyToken, async (req, res) => {
  try {
    const { isTemplate } = req.query;
    const baseFilter = req.user.organizationId
      ? { organizationId: req.user.organizationId }
      : {};

    const query =
      isTemplate === 'true'
        ? { ...baseFilter, isTemplate: true }
        : { ...baseFilter, $or: [{ isTemplate: false }, { isTemplate: { $exists: false } }] };

    const jobs = await Job.find(query).setOptions(
      req.user.organizationId ? { _tenantId: req.user.organizationId } : {}
    ).sort({ createdAt: -1 });
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', verifyToken, requireRecruiterOrAbove, checkPlanLimit('jobs'), async (req, res) => {
  try {
    const jobData = { ...req.body };

    if (req.user.organizationId) {
      jobData.organizationId = req.user.organizationId;
    }
    jobData.createdBy = req.user.id;

    if (jobData.role && !jobData.title) jobData.title = jobData.role;
    if (jobData.title && !jobData.role) jobData.role = jobData.title;

    const newJob = new Job(jobData);
    await newJob.save();

    if (req.user.organizationId) {
      await Organization.findByIdAndUpdate(req.user.organizationId, {
        $inc: { 'usageCurrent.jobs': 1 },
      });
    }

    eventBus.emit(eventTypes.JOB_CREATED, {
      organizationId: req.user.organizationId,
      userId: req.user.id,
      jobId: newJob._id,
      title: newJob.title,
    });

    res.status(201).json(newJob);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', verifyToken, requireRecruiterOrAbove, async (req, res) => {
  try {
    const scope = req.user.organizationId
      ? { organizationId: req.user.organizationId }
      : { createdBy: req.user.id };

    const updates = { ...req.body };
    delete updates._id;
    delete updates.organizationId;
    delete updates.createdBy;

    if (updates.role && !updates.title) updates.title = updates.role;
    if (updates.title && !updates.role) updates.role = updates.title;

    if (updates.status === 'Closed' && !updates.closedAt) {
      updates.closedAt = new Date();
      updates.isPublished = false;
    }

    const job = await Job.findOneAndUpdate(
      { _id: req.params.id, ...scope },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!job) return res.status(404).json({ message: 'Job not found' });
    res.json(job);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', verifyToken, requireRecruiterOrAbove, async (req, res) => {
  try {
    const scope = req.user.organizationId
      ? { organizationId: req.user.organizationId }
      : { createdBy: req.user.id };

    const deleted = await Job.findOneAndDelete({ _id: req.params.id, ...scope });
    if (!deleted) return res.status(404).json({ message: 'Job not found' });

    if (req.user.organizationId) {
      await Organization.findByIdAndUpdate(req.user.organizationId, {
        $inc: { 'usageCurrent.jobs': -1 },
      });
    }

    res.json({ message: 'Job deleted successfully', id: req.params.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
