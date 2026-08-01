/**
 * Background checks — Enterprise, gated by 'integrations.backgroundCheck'.
 * Uses the BYOK adapter registry (adapters/backgroundCheckAdapter.js).
 */
const express = require('express');
const router = express.Router();

const { verifyToken } = require('../middleware/authMiddleware');
const { requireRecruiterOrAbove } = require('../middleware/rbacMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');
const { requireOrganization, tenantScope } = require('../middleware/tenantMiddleware');
const { getAdapter } = require('../adapters');
const Application = require('../models/Application');
const Candidate = require('../models/Candidate');

router.use(verifyToken, requireOrganization, tenantScope, requireRecruiterOrAbove, requireFeature('integrations.backgroundCheck'));

router.post('/applications/:applicationId/order', async (req, res) => {
  try {
    const application = await Application.findOne({ _id: req.params.applicationId, organizationId: req.user.organizationId });
    if (!application) return res.status(404).json({ success: false, message: 'Application not found' });

    const candidate = await Candidate.findOne({ _id: application.candidateId, organizationId: req.user.organizationId });
    if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });

    const adapter = await getAdapter(req.user.organizationId, 'background_check');
    if (!adapter) {
      return res.status(400).json({ success: false, message: 'No active background check integration configured for this organization.' });
    }

    const [firstName, ...rest] = (candidate.name || '').trim().split(/\s+/);
    const result = await adapter.orderCheck({
      firstName: firstName || candidate.name,
      lastName: rest.join(' ') || firstName || candidate.name,
      email: candidate.email,
      phone: candidate.phone || candidate.contact
    });

    application.backgroundCheck = {
      provider: req.body.provider || 'checkr',
      candidateId: result.candidateId,
      invitationId: result.invitationId,
      status: 'pending',
      orderedAt: new Date(),
      orderedBy: req.user.id
    };
    await application.save();

    res.json({ success: true, data: { ...result, applicationId: application._id } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/applications/:applicationId/status', async (req, res) => {
  try {
    const application = await Application.findOne({ _id: req.params.applicationId, organizationId: req.user.organizationId });
    if (!application) return res.status(404).json({ success: false, message: 'Application not found' });
    if (!application.backgroundCheck?.invitationId) {
      return res.json({ success: true, data: { status: 'not_started' } });
    }

    const adapter = await getAdapter(req.user.organizationId, 'background_check');
    if (!adapter) return res.status(400).json({ success: false, message: 'No active background check integration configured.' });

    // Checkr invitations resolve to a report; for this MVP we surface the
    // invitation's known status without a separate report-id lookup step.
    res.json({ success: true, data: application.backgroundCheck });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
