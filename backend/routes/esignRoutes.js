/**
 * E-sign for offer letters — Enterprise, gated by 'integrations.esign'.
 * Uses the BYOK adapter registry (adapters/esignAdapter.js).
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

router.use(verifyToken, requireOrganization, tenantScope, requireRecruiterOrAbove, requireFeature('integrations.esign'));

router.post('/applications/:applicationId/send', async (req, res) => {
  try {
    const { documentBase64, documentName, emailSubject } = req.body;
    if (!documentBase64) {
      return res.status(400).json({ success: false, message: 'documentBase64 (the offer letter PDF) is required' });
    }

    const application = await Application.findOne({ _id: req.params.applicationId, organizationId: req.user.organizationId });
    if (!application) return res.status(404).json({ success: false, message: 'Application not found' });

    const candidate = await Candidate.findOne({ _id: application.candidateId, organizationId: req.user.organizationId });
    if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });

    const adapter = await getAdapter(req.user.organizationId, 'esign');
    if (!adapter) {
      return res.status(400).json({ success: false, message: 'No active e-sign integration configured for this organization.' });
    }

    const result = await adapter.sendForSignature({
      documentBase64,
      documentName: documentName || 'Offer Letter',
      signerEmail: candidate.email,
      signerName: candidate.name,
      emailSubject
    });

    application.esign = {
      provider: req.body.provider || 'docusign',
      envelopeId: result.envelopeId,
      status: 'sent',
      sentAt: new Date(),
      sentBy: req.user.id
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
    if (!application.esign?.envelopeId) {
      return res.json({ success: true, data: { status: 'not_sent' } });
    }

    const adapter = await getAdapter(req.user.organizationId, 'esign');
    if (!adapter) return res.status(400).json({ success: false, message: 'No active e-sign integration configured.' });

    const remoteStatus = await adapter.getEnvelopeStatus(application.esign.envelopeId);
    if (remoteStatus.status && remoteStatus.status !== application.esign.status) {
      application.esign.status = remoteStatus.status;
      if (remoteStatus.status === 'completed') application.esign.completedAt = new Date();
      await application.save();
    }

    res.json({ success: true, data: application.esign });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
