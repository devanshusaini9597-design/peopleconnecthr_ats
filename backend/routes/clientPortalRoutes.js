/**
 * Client-facing read-only pipeline portal — Enterprise, 'agency.clientPortal'.
 * Public (token-gated, no session auth) — this IS the auth model, same
 * pattern as the scheduled-report download links and SSO exchange codes.
 *
 * Mounted at /client-portal (no /api prefix) since it's meant to be a link
 * shared directly with an external client contact, not part of the app's
 * authenticated API surface.
 *
 * NOTE: Candidate.client is currently a free-text field (not a proper
 * reference to the Client model) — this portal matches candidates to this
 * Client by case-insensitive name match, scoped to the org. If Candidate.client
 * is later migrated to a real clientId reference, tighten this to an exact
 * ObjectId match instead.
 */
const express = require('express');
const router = express.Router();

const Client = require('../models/Client');
const Application = require('../models/Application');
const Candidate = require('../models/Candidate');
const Organization = require('../models/Organization');
const { planHasFeature } = require('../config/planFeatures');

router.get('/:token', async (req, res) => {
  try {
    const client = await Client.findOne({ 'portal.token': req.params.token, 'portal.enabled': true });
    if (!client) return res.status(404).json({ success: false, message: 'This client portal link is invalid or has been disabled.' });

    const org = await Organization.findById(client.organizationId).select('name plan');
    if (!org || !planHasFeature(org.plan, 'agency.clientPortal')) {
      return res.status(403).json({ success: false, message: 'The client portal is not available on this organization\'s current plan.' });
    }

    const candidates = await Candidate.find({
      organizationId: client.organizationId,
      client: { $regex: `^${client.name}$`, $options: 'i' }
    }).select('_id name');
    const candidateIds = candidates.map((c) => c._id);

    const applications = await Application.find({
      organizationId: client.organizationId,
      candidateId: { $in: candidateIds }
    })
      .populate('jobId', 'title department location')
      .populate('candidateId', 'name')
      .select('stage isRejected isHired appliedAt lastActivityAt jobId candidateId')
      .sort({ lastActivityAt: -1 });

    const data = applications.map((app) => ({
      id: app._id,
      candidateName: app.candidateId?.name || 'Candidate',
      jobTitle: app.jobId?.title || 'Unknown Role',
      department: app.jobId?.department || '',
      location: app.jobId?.location || '',
      stage: app.stage,
      isRejected: app.isRejected,
      isHired: app.isHired,
      appliedAt: app.appliedAt,
      lastActivityAt: app.lastActivityAt
    }));

    res.json({ success: true, data: { organizationName: org.name, clientName: client.name, applications: data } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
