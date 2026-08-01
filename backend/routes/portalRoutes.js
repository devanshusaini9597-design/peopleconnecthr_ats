/**
 * Candidate self-service portal — magic-link auth (no password), matching
 * the pattern already used for password resets in server.js.
 *
 * Previously this whole file was a stub (`requirePortalAuth` hardcoded a
 * fake candidateId/organizationId, `/login` never sent anything) — fixed to
 * actually issue and verify short-lived JWTs scoped to a single candidate.
 */
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Candidate = require('../models/Candidate');
const Application = require('../models/Application');
const Organization = require('../models/Organization');
const { JWT_SECRET } = require('../middleware/authMiddleware');
const { sendEmail } = require('../services/emailService');

const PORTAL_TOKEN_PURPOSE = 'candidate-portal';

/**
 * POST /login
 * body: { email, orgSlug } — orgSlug disambiguates when the same email
 * applied to multiple orgs on this platform (rare, but possible).
 */
router.post('/login', async (req, res) => {
  try {
    const { email, orgSlug } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const filter = { email: email.toLowerCase().trim() };
    if (orgSlug) {
      const org = await Organization.findOne({ slug: orgSlug }).select('_id');
      if (org) filter.organizationId = org._id;
    }

    const candidate = await Candidate.findOne(filter).sort({ createdAt: -1 });

    // Always return the same success message whether or not a candidate
    // exists, so this endpoint can't be used to enumerate applicant emails.
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
      await sendEmail(candidate.email, 'Your application status', html, `View your applications: ${loginUrl}`).catch((err) => {
        console.error('[portal] Failed to send magic link:', err.message);
      });
    }

    res.json({ success: true, message: 'If an application exists for this email, a login link has been sent.' });
  } catch (error) {
    console.error('[portal] /login error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to process login request' });
  }
});

/** Verifies the magic-link JWT (Authorization: Bearer <token> or ?token=). */
const requirePortalAuth = (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : req.query.token;
    if (!token) return res.status(401).json({ success: false, message: 'Missing portal access token' });

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.purpose !== PORTAL_TOKEN_PURPOSE) {
      return res.status(401).json({ success: false, message: 'Invalid token type' });
    }

    req.candidateId = decoded.candidateId;
    req.organizationId = decoded.organizationId;
    next();
  } catch (error) {
    const message = error.name === 'TokenExpiredError' ? 'This login link has expired. Please request a new one.' : 'Invalid or expired login link';
    res.status(401).json({ success: false, message });
  }
};

router.get('/status', requirePortalAuth, async (req, res) => {
  try {
    const applications = await Application.find({ candidateId: req.candidateId, organizationId: req.organizationId })
      .populate('jobId', 'title department location');

    const mapped = applications.map(app => ({
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

    res.json({ success: true, data: mapped });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/application/:id', requirePortalAuth, async (req, res) => {
  try {
    const application = await Application.findOne({ _id: req.params.id, candidateId: req.candidateId, organizationId: req.organizationId })
      .populate('jobId', 'title department location description');
    if (!application) return res.status(404).json({ success: false, message: 'Application not found' });
    res.json({ success: true, data: application });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GDPR self-service (Art. 15/20 "right to access/portability").
 * Always available on every plan — this is a compliance feature, not a
 * paid add-on. Returns everything this platform holds about the candidate:
 * their own profile fields + every application/pipeline record tied to
 * their candidateId, scoped to this organization only.
 *
 * GET /api/portal/gdpr/export
 */
router.get('/gdpr/export', requirePortalAuth, async (req, res) => {
  try {
    const candidate = await Candidate.findOne({ _id: req.candidateId, organizationId: req.organizationId }).lean();
    if (!candidate) return res.status(404).json({ success: false, message: 'Candidate record not found' });

    const applications = await Application.find({ candidateId: req.candidateId, organizationId: req.organizationId })
      .populate('jobId', 'title department location')
      .lean();

    const exportPayload = {
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

    res.setHeader('Content-Disposition', `attachment; filename="my-data-export-${Date.now()}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.json(exportPayload);
  } catch (error) {
    console.error('[portal] /gdpr/export error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to export data' });
  }
});

/**
 * GDPR self-service erasure (Art. 17 "right to be forgotten").
 * Anonymizes PII in-place rather than hard-deleting the row: pipeline
 * history (stage/hired counts) stays intact for the org's own reporting,
 * but the candidate's name/email/phone/resume/skills/demographics are
 * scrubbed and the account can no longer be looked up or logged into
 * (email is rewritten to a token, so the unique-per-org email index
 * frees up the original address for future re-application).
 *
 * POST /api/portal/gdpr/erase   body: { confirm: true }
 */
router.post('/gdpr/erase', requirePortalAuth, async (req, res) => {
  try {
    if (req.body?.confirm !== true) {
      return res.status(400).json({ success: false, message: 'Erasure must be explicitly confirmed (confirm: true)' });
    }

    const candidate = await Candidate.findOne({ _id: req.candidateId, organizationId: req.organizationId });
    if (!candidate) return res.status(404).json({ success: false, message: 'Candidate record not found' });

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

    res.json({ success: true, message: 'Your personal data has been erased. This cannot be undone.' });
  } catch (error) {
    console.error('[portal] /gdpr/erase error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to process erasure request' });
  }
});

module.exports = router;
