/**
 * Public REST API — v1
 *
 * Authenticated via API key (Authorization: Bearer sk_live_...), NOT the
 * user-session JWT. This is what "Webhooks / public API" in the plan matrix
 * refers to on the read/write side (outbound webhook delivery itself lives
 * in webhookRoutes.js + services/webhookDispatcher.js).
 *
 * Professional ('integrations.webhooksReadOnly'): GET endpoints only.
 * Enterprise ('integrations.webhooksFull') + a 'write'-scoped key: POST too.
 */
const express = require('express');
const router = express.Router();

const { verifyApiKey, requireWriteScope } = require('../middleware/apiKeyMiddleware');
const Job = require('../models/Job');
const Candidate = require('../models/Candidate');
const Application = require('../models/Application');
const Organization = require('../models/Organization');
const eventBus = require('../events/eventBus');
const eventTypes = require('../events/eventTypes');

router.use(verifyApiKey);

// ── Jobs (read) ──────────────────────────────────────────────────────
router.get('/jobs', async (req, res) => {
  try {
    const { status, limit = 50, page = 1 } = req.query;
    const filter = { organizationId: req.organizationId };
    if (status) filter.status = status;

    const jobs = await Job.find(filter)
      .sort({ createdAt: -1 })
      .skip((Math.max(1, Number(page)) - 1) * Math.min(Number(limit) || 50, 100))
      .limit(Math.min(Number(limit) || 50, 100))
      .select('-customFields');

    res.json({ success: true, data: jobs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/jobs/:id', async (req, res) => {
  try {
    const job = await Job.findOne({ _id: req.params.id, organizationId: req.organizationId });
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    res.json({ success: true, data: job });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Candidates (read) ────────────────────────────────────────────────
router.get('/candidates', async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const candidates = await Candidate.find({ organizationId: req.organizationId })
      .sort({ createdAt: -1 })
      .skip((Math.max(1, Number(page)) - 1) * Math.min(Number(limit) || 50, 100))
      .limit(Math.min(Number(limit) || 50, 100))
      .select('-resumeText -customFields');

    res.json({ success: true, data: candidates });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/candidates/:id', async (req, res) => {
  try {
    const candidate = await Candidate.findOne({ _id: req.params.id, organizationId: req.organizationId }).select('-resumeText');
    if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });
    res.json({ success: true, data: candidate });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Candidates (write) — Enterprise + write-scoped key only ──────────
// The canonical use case: a career-site form builder or Zapier/Make
// "create candidate" action, external to the ATS's own careers page.
router.post('/candidates', requireWriteScope, async (req, res) => {
  try {
    const { name, email, phone, position, source, resume } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'name and email are required' });
    }

    const org = await Organization.findById(req.organizationId).select('usageLimits usageCurrent');
    if (org && typeof org.usageLimits?.maxCandidates === 'number' && org.usageLimits.maxCandidates !== -1
      && (org.usageCurrent?.candidates || 0) >= org.usageLimits.maxCandidates) {
      return res.status(403).json({ success: false, code: 'PLAN_LIMIT_EXCEEDED', message: 'This organization has reached its candidate limit for the current plan.' });
    }

    const candidate = await Candidate.create({
      organizationId: req.organizationId,
      name, email, phone: phone || '', position: position || '', source: source || 'Public API', resume: resume || ''
    });

    await Organization.findByIdAndUpdate(req.organizationId, { $inc: { 'usageCurrent.candidates': 1 } });

    eventBus.emit(eventTypes.CANDIDATE_CREATED, {
      organizationId: req.organizationId,
      resourceType: 'Candidate',
      resourceId: candidate._id,
      via: 'public_api',
      apiKeyId: req.apiKey._id
    });

    res.status(201).json({ success: true, data: candidate });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'A candidate with this email already exists in your organization' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Applications (read) ──────────────────────────────────────────────
router.get('/applications', async (req, res) => {
  try {
    const { jobId, stage, limit = 50, page = 1 } = req.query;
    const filter = { organizationId: req.organizationId };
    if (jobId) filter.jobId = jobId;
    if (stage) filter.stage = stage;

    const applications = await Application.find(filter)
      .sort({ createdAt: -1 })
      .skip((Math.max(1, Number(page)) - 1) * Math.min(Number(limit) || 50, 100))
      .limit(Math.min(Number(limit) || 50, 100))
      .populate('candidateId', 'name email phone')
      .populate('jobId', 'title department');

    res.json({ success: true, data: applications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
