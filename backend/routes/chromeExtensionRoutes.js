/**
 * Chrome Extension (LinkedIn one-click import) — Add-on, always available
 * on every plan (see chrome-extension/ at the repo root for the extension
 * itself, and models/ChromeExtensionToken.js for why this uses its own
 * token type instead of the gated public API keys).
 */

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requireOrganization, tenantScope } = require('../middleware/tenantMiddleware');
const { requireAdmin } = require('../middleware/rbacMiddleware');
const ChromeExtensionToken = require('../models/ChromeExtensionToken');
const Candidate = require('../models/Candidate');

/** Verifies `Authorization: Bearer cext_...` and attaches req.organizationId. */
const requireExtensionToken = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const plaintext = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    if (!plaintext || !plaintext.startsWith('cext_')) {
      return res.status(401).json({ success: false, message: 'Missing or invalid extension token' });
    }
    const tokenHash = ChromeExtensionToken.hashToken(plaintext);
    const record = await ChromeExtensionToken.findOne({ tokenHash });
    if (!record) return res.status(401).json({ success: false, message: 'Invalid or revoked extension token' });

    record.lastUsedAt = new Date();
    record.importCount += 1;
    record.save().catch(() => {});

    req.organizationId = record.organizationId;
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: 'Extension token verification failed' });
  }
};

// ── Recruiter/admin-side: manage the org's extension token ─────────────

router.get('/token', verifyToken, requireOrganization, tenantScope, requireAdmin, async (req, res) => {
  try {
    const record = await ChromeExtensionToken.findOne({ organizationId: req.user.organizationId }).select('tokenPrefix lastUsedAt importCount createdAt');
    res.json({ success: true, data: record || null });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** POST /token — (re)generate the org's extension token. Shown once, plaintext. */
router.post('/token', verifyToken, requireOrganization, tenantScope, requireAdmin, async (req, res) => {
  try {
    const { plaintext, tokenHash, tokenPrefix } = ChromeExtensionToken.generate();
    const record = await ChromeExtensionToken.findOneAndUpdate(
      { organizationId: req.user.organizationId },
      { tokenHash, tokenPrefix, createdBy: req.user.id, lastUsedAt: null, importCount: 0 },
      { upsert: true, new: true }
    );
    res.json({ success: true, data: { tokenPrefix: record.tokenPrefix, createdAt: record.createdAt }, plaintextToken: plaintext });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/token', verifyToken, requireOrganization, tenantScope, requireAdmin, async (req, res) => {
  try {
    await ChromeExtensionToken.deleteOne({ organizationId: req.user.organizationId });
    res.json({ success: true, message: 'Extension token revoked' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Extension-side: import a scraped LinkedIn profile ───────────────────

/**
 * POST /import — body: { name, email, position, location, companyName,
 * experience, skills, linkedinUrl }. Upserts by email within the org so
 * re-importing the same profile just refreshes the record instead of
 * creating a duplicate.
 */
router.post('/import', requireExtensionToken, async (req, res) => {
  try {
    const { name, email, position = '', location = '', companyName = '', experience = '', skills = '', linkedinUrl = '' } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'name and email are required' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    let candidate = await Candidate.findOne({ organizationId: req.organizationId, email: normalizedEmail });

    if (candidate) {
      candidate.position = position || candidate.position;
      candidate.location = location || candidate.location;
      candidate.companyName = companyName || candidate.companyName;
      candidate.experience = experience || candidate.experience;
      candidate.skills = skills || candidate.skills;
      if (linkedinUrl && !candidate.customFields?.linkedinUrl) {
        candidate.customFields = { ...candidate.customFields, linkedinUrl };
      }
      await candidate.save();
      return res.json({ success: true, message: 'Existing candidate updated from LinkedIn', data: candidate, created: false });
    }

    candidate = await Candidate.create({
      organizationId: req.organizationId,
      name,
      email: normalizedEmail,
      position,
      location,
      companyName,
      experience,
      skills,
      source: 'LinkedIn (Chrome Extension)',
      customFields: linkedinUrl ? { linkedinUrl } : {}
    });

    res.status(201).json({ success: true, message: 'Candidate imported from LinkedIn', data: candidate, created: true });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'A candidate with this email already exists' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
