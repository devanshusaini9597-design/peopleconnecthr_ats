/**
 * Candidate self-service portal domain — magic-link login, status, GDPR.
 */
const jwt = require('jsonwebtoken');
const Candidate = require('../models/Candidate');
const Application = require('../models/Application');
const Organization = require('../models/Organization');
const { JWT_SECRET } = require('../middleware/authMiddleware');
const { sendEmailQueued } = require('./emailService');

const PORTAL_TOKEN_PURPOSE = 'candidate-portal';

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

async function getLocalization(orgSlug) {
  const org = await Organization.findOne({ slug: orgSlug })
    .select('atsSettings.portalLocalization plan');
  if (!org) throw httpError('Organization not found', 404);

  const { planHasFeature } = require('../config/planFeatures');
  const loc = org.atsSettings?.portalLocalization || {};
  const enabled = !!loc.enabled && planHasFeature(org.plan, 'portal.localization');
  return {
    enabled,
    defaultLocale: loc.defaultLocale || 'en',
    supportedLocales: enabled ? (loc.supportedLocales || ['en']) : ['en']
  };
}

/**
 * Always resolves with the same success message whether or not a candidate
 * exists, so this endpoint can't be used to enumerate applicant emails.
 */
async function requestMagicLink({ email, orgSlug } = {}) {
  if (!email) throw httpError('Email is required');

  const filter = { email: email.toLowerCase().trim() };
  if (orgSlug) {
    const org = await Organization.findOne({ slug: orgSlug }).select('_id');
    if (org) filter.organizationId = org._id;
  }

  const candidate = await Candidate.findOne(filter).sort({ createdAt: -1 });

  if (candidate) {
    const token = jwt.sign(
      { candidateId: candidate._id, organizationId: candidate.organizationId, purpose: PORTAL_TOKEN_PURPOSE },
      JWT_SECRET,
      { expiresIn: '30m' }
    );
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const loginUrl = `${frontendUrl}/portal/callback?token=${token}`;

    const html = `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Your application status</h2>
          <p>Click below to securely view the status of your application(s). This link expires in 30 minutes.</p>
          <p><a href="${loginUrl}" style="display:inline-block;padding:10px 20px;background:#4F46E5;color:#fff;border-radius:6px;text-decoration:none;">View my applications</a></p>
        </div>`;
    await sendEmailQueued(candidate.email, 'Your application status', html, `View your applications: ${loginUrl}`).catch((err) => {
      console.error('[portal] Failed to send magic link:', err.message);
    });
  }

  return { success: true, message: 'If an application exists for this email, a login link has been sent.' };
}

async function listApplicationStatuses(candidateId, organizationId) {
  const applications = await Application.find({ candidateId, organizationId })
    .populate('jobId', 'title department location');

  return applications.map(app => ({
    id: app._id,
    jobTitle: app.jobId ? app.jobId.title : 'Unknown Job',
    department: app.jobId?.department || '',
    location: app.jobId?.location || '',
    stage: app.stage,
    isRejected: app.isRejected,
    isHired: app.isHired,
    appliedAt: app.appliedAt || app.createdAt,
    lastActivityAt: app.lastActivityAt || app.updatedAt
  }));
}

async function getApplication(id, candidateId, organizationId) {
  const application = await Application.findOne({ _id: id, candidateId, organizationId })
    .populate('jobId', 'title department location description');
  if (!application) throw httpError('Application not found', 404);
  return application;
}

async function exportGdprData(candidateId, organizationId) {
  const candidate = await Candidate.findOne({ _id: candidateId, organizationId }).lean();
  if (!candidate) throw httpError('Candidate record not found', 404);

  const applications = await Application.find({ candidateId, organizationId })
    .populate('jobId', 'title department location')
    .lean();

  return {
    exportedAt: new Date().toISOString(),
    profile: {
      name: candidate.name,
      email: candidate.email,
      contact: candidate.contact,
      phone: candidate.phone,
      position: candidate.position,
      location: candidate.location,
      experience: candidate.experience,
      skills: candidate.skills,
      source: candidate.source,
      status: candidate.status,
      statusHistory: candidate.statusHistory || [],
      demographics: candidate.demographics || null,
      resume: candidate.resume || null,
      createdAt: candidate.createdAt
    },
    applications: applications.map(app => ({
      jobTitle: app.jobId?.title || 'Unknown Job',
      department: app.jobId?.department || '',
      location: app.jobId?.location || '',
      stage: app.stage,
      stageHistory: app.stageHistory || [],
      source: app.source,
      isRejected: app.isRejected,
      rejectionReason: app.rejectionReason || undefined,
      isHired: app.isHired,
      appliedAt: app.appliedAt,
      notes: app.notes || undefined
    }))
  };
}

async function eraseGdprData(candidateId, organizationId, confirm) {
  if (confirm !== true) {
    throw httpError('Erasure must be explicitly confirmed (confirm: true)');
  }

  const candidate = await Candidate.findOne({ _id: candidateId, organizationId });
  if (!candidate) throw httpError('Candidate record not found', 404);

  const erasureToken = `erased-${candidate._id}@deleted.invalid`;

  candidate.name = 'Erased Candidate';
  candidate.email = erasureToken;
  candidate.contact = '';
  candidate.phone = '';
  candidate.skills = '';
  candidate.resume = '';
  candidate.resumeText = '';
  candidate.feedback = '';
  candidate.remark = '';
  candidate.demographics = { genderIdentity: '', ethnicity: '', veteranStatus: '', disabilityStatus: '', declinedToSelfIdentify: false };
  candidate.customFields = {};
  candidate.gdprErasedAt = new Date();
  await candidate.save();

  return { success: true, message: 'Your personal data has been erased. This cannot be undone.' };
}

module.exports = {
  PORTAL_TOKEN_PURPOSE,
  getLocalization,
  requestMagicLink,
  listApplicationStatuses,
  getApplication,
  exportGdprData,
  eraseGdprData,
};
