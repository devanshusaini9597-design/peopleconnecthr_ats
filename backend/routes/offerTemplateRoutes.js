/**
 * Offer letter templates — Enterprise, gated by offers.templates.
 */
const express = require('express');
const router = express.Router();
const OfferTemplate = require('../models/OfferTemplate');
const Application = require('../models/Application');
const Candidate = require('../models/Candidate');
const Job = require('../models/Job');
const Organization = require('../models/Organization');
const { verifyToken } = require('../middleware/authMiddleware');
const { requireRecruiterOrAbove } = require('../middleware/rbacMiddleware');
const { requireOrganization, tenantScope } = require('../middleware/tenantMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');
const { getAdapter } = require('../adapters');

router.use(verifyToken, requireOrganization, tenantScope, requireFeature('offers.templates'));

const renderMerge = (template, context) => {
  let out = template;
  const flat = {};
  Object.entries(context).forEach(([ns, obj]) => {
    if (obj && typeof obj === 'object') {
      Object.entries(obj).forEach(([k, v]) => { flat[`${ns}.${k}`] = v ?? ''; });
    }
  });
  flat['today'] = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  Object.entries(flat).forEach(([key, val]) => {
    out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(val));
  });
  return out;
};

/** GET / */
router.get('/', requireRecruiterOrAbove, async (req, res) => {
  try {
    const templates = await OfferTemplate.find({ organizationId: req.user.organizationId }).sort({ createdAt: -1 });
    res.json({ success: true, data: templates, mergeFields: OfferTemplate.MERGE_FIELDS });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** POST / */
router.post('/', requireRecruiterOrAbove, async (req, res) => {
  try {
    const { name, subject, body, isDefault } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'name is required' });
    if (isDefault) {
      await OfferTemplate.updateMany({ organizationId: req.user.organizationId }, { isDefault: false });
    }
    const template = new OfferTemplate({
      organizationId: req.user.organizationId,
      name,
      subject: subject || '',
      body: body || '',
      isDefault: !!isDefault,
      createdBy: req.user.id
    });
    await template.save();
    res.status(201).json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** PUT /:id */
router.put('/:id', requireRecruiterOrAbove, async (req, res) => {
  try {
    const template = await OfferTemplate.findOne({ _id: req.params.id, organizationId: req.user.organizationId });
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });
    const { name, subject, body, isDefault } = req.body;
    if (name) template.name = name;
    if (subject !== undefined) template.subject = subject;
    if (body !== undefined) template.body = body;
    if (isDefault) {
      await OfferTemplate.updateMany({ organizationId: req.user.organizationId }, { isDefault: false });
      template.isDefault = true;
    }
    await template.save();
    res.json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** DELETE /:id */
router.delete('/:id', requireRecruiterOrAbove, async (req, res) => {
  try {
    const result = await OfferTemplate.deleteOne({ _id: req.params.id, organizationId: req.user.organizationId });
    if (!result.deletedCount) return res.status(404).json({ success: false, message: 'Template not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** POST /:id/render — preview merged content */
router.post('/:id/render', requireRecruiterOrAbove, async (req, res) => {
  try {
    const template = await OfferTemplate.findOne({ _id: req.params.id, organizationId: req.user.organizationId });
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });

    const { applicationId, offerOverrides = {} } = req.body;
    if (!applicationId) return res.status(400).json({ success: false, message: 'applicationId is required' });

    const application = await Application.findOne({ _id: applicationId, organizationId: req.user.organizationId });
    if (!application) return res.status(404).json({ success: false, message: 'Application not found' });

    const [candidate, job, org] = await Promise.all([
      Candidate.findById(application.candidateId),
      Job.findById(application.jobId),
      Organization.findById(req.user.organizationId).select('name')
    ]);

    const context = {
      candidate: { name: candidate?.name, email: candidate?.email, phone: candidate?.phone },
      job: { title: job?.title, department: job?.department, location: job?.location },
      offer: offerOverrides,
      company: { name: org?.name }
    };

    res.json({
      success: true,
      data: {
        subject: renderMerge(template.subject, context),
        body: renderMerge(template.body, context)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** POST /:id/send — render + send via e-sign adapter if configured */
router.post('/:id/send', requireRecruiterOrAbove, async (req, res) => {
  try {
    const template = await OfferTemplate.findOne({ _id: req.params.id, organizationId: req.user.organizationId });
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });

    const { applicationId, offerOverrides = {}, documentBase64 } = req.body;
    if (!applicationId) return res.status(400).json({ success: false, message: 'applicationId is required' });

    const application = await Application.findOne({ _id: applicationId, organizationId: req.user.organizationId });
    if (!application) return res.status(404).json({ success: false, message: 'Application not found' });

    const [candidate, job, org] = await Promise.all([
      Candidate.findById(application.candidateId),
      Job.findById(application.jobId),
      Organization.findById(req.user.organizationId).select('name')
    ]);

    const context = {
      candidate: { name: candidate?.name, email: candidate?.email, phone: candidate?.phone },
      job: { title: job?.title, department: job?.department, location: job?.location },
      offer: offerOverrides,
      company: { name: org?.name }
    };

    const rendered = {
      subject: renderMerge(template.subject, context),
      body: renderMerge(template.body, context)
    };

    const adapter = await getAdapter(req.user.organizationId, 'esign');
    if (!adapter || !documentBase64) {
      return res.json({
        success: true,
        data: { rendered, esignSent: false, message: 'Rendered offer letter. Configure e-sign integration and provide documentBase64 to send for signature.' }
      });
    }

    const result = await adapter.sendForSignature({
      documentBase64,
      documentName: rendered.subject || 'Offer Letter',
      signerEmail: candidate.email,
      signerName: candidate.name,
      emailSubject: rendered.subject
    });

    application.esign = {
      provider: 'docusign',
      envelopeId: result.envelopeId,
      status: 'sent',
      sentAt: new Date(),
      sentBy: req.user.id
    };
    await application.save();

    res.json({ success: true, data: { rendered, esignSent: true, envelopeId: result.envelopeId } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
