/**
 * Offer letter templates domain logic.
 */
const OfferTemplate = require('../models/OfferTemplate');
const Application = require('../models/Application');
const Candidate = require('../models/Candidate');
const Job = require('../models/Job');
const Organization = require('../models/Organization');
const { getAdapter } = require('../adapters');

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

function renderMerge(template, context) {
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
}

async function buildContext(organizationId, application, offerOverrides = {}) {
  const [candidate, job, org] = await Promise.all([
    Candidate.findById(application.candidateId),
    Job.findById(application.jobId),
    Organization.findById(organizationId).select('name')
  ]);
  return {
    candidate: { name: candidate?.name, email: candidate?.email, phone: candidate?.phone },
    job: { title: job?.title, department: job?.department, location: job?.location },
    offer: offerOverrides,
    company: { name: org?.name },
    _candidate: candidate,
  };
}

async function listTemplates(organizationId) {
  const templates = await OfferTemplate.find({ organizationId }).sort({ createdAt: -1 });
  return { templates, mergeFields: OfferTemplate.MERGE_FIELDS };
}

async function createTemplate(organizationId, userId, body) {
  const { name, subject, body: templateBody, isDefault } = body;
  if (!name) throw httpError('name is required');
  if (isDefault) {
    await OfferTemplate.updateMany({ organizationId }, { isDefault: false });
  }
  const template = new OfferTemplate({
    organizationId,
    name,
    subject: subject || '',
    body: templateBody || '',
    isDefault: !!isDefault,
    createdBy: userId
  });
  await template.save();
  return template;
}

async function updateTemplate(organizationId, id, body) {
  const template = await OfferTemplate.findOne({ _id: id, organizationId });
  if (!template) throw httpError('Template not found', 404);
  const { name, subject, body: templateBody, isDefault } = body;
  if (name) template.name = name;
  if (subject !== undefined) template.subject = subject;
  if (templateBody !== undefined) template.body = templateBody;
  if (isDefault) {
    await OfferTemplate.updateMany({ organizationId }, { isDefault: false });
    template.isDefault = true;
  }
  await template.save();
  return template;
}

async function deleteTemplate(organizationId, id) {
  const result = await OfferTemplate.deleteOne({ _id: id, organizationId });
  if (!result.deletedCount) throw httpError('Template not found', 404);
  return { success: true };
}

async function renderTemplate(organizationId, id, body) {
  const template = await OfferTemplate.findOne({ _id: id, organizationId });
  if (!template) throw httpError('Template not found', 404);

  const { applicationId, offerOverrides = {} } = body;
  if (!applicationId) throw httpError('applicationId is required');

  const application = await Application.findOne({ _id: applicationId, organizationId });
  if (!application) throw httpError('Application not found', 404);

  const { _candidate: _c, ...context } = await buildContext(organizationId, application, offerOverrides);
  return {
    subject: renderMerge(template.subject, context),
    body: renderMerge(template.body, context)
  };
}

async function sendTemplate(organizationId, userId, id, body) {
  const template = await OfferTemplate.findOne({ _id: id, organizationId });
  if (!template) throw httpError('Template not found', 404);

  const { applicationId, offerOverrides = {}, documentBase64 } = body;
  if (!applicationId) throw httpError('applicationId is required');

  const application = await Application.findOne({ _id: applicationId, organizationId });
  if (!application) throw httpError('Application not found', 404);

  const { _candidate: candidate, ...context } = await buildContext(organizationId, application, offerOverrides);

  const rendered = {
    subject: renderMerge(template.subject, context),
    body: renderMerge(template.body, context)
  };

  const adapter = await getAdapter(organizationId, 'esign');
  if (!adapter || !documentBase64) {
    return {
      rendered,
      esignSent: false,
      message: 'Rendered offer letter. Configure e-sign integration and provide documentBase64 to send for signature.'
    };
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
    sentBy: userId
  };
  await application.save();

  return { rendered, esignSent: true, envelopeId: result.envelopeId };
}

module.exports = {
  renderMerge,
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  renderTemplate,
  sendTemplate,
};
