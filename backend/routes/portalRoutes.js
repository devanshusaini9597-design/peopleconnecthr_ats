/**
 * Candidate self-service portal — magic-link auth (no password), matching
 * the pattern already used for password resets in server.js.
 *
 * Thin wrappers; domain logic in portalService.
 */
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/authMiddleware');
const svc = require('../services/portalService');
const { PORTAL_TOKEN_PURPOSE } = svc;

function handle(res, error) {
  const status = error.statusCode || 500;
  return res.status(status).json({ success: false, message: error.message });
}

/** GET /localization/:orgSlug — public locale config (portal.localization) */
router.get('/localization/:orgSlug', async (req, res) => {
  try {
    const data = await svc.getLocalization(req.params.orgSlug);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

/**
 * POST /login
 * body: { email, orgSlug } — orgSlug disambiguates when the same email
 * applied to multiple orgs on this platform (rare, but possible).
 */
router.post('/login', async (req, res) => {
  try {
    const body = await svc.requestMagicLink(req.body);
    res.json(body);
  } catch (error) {
    if (error.statusCode) return handle(res, error);
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
    const data = await svc.listApplicationStatuses(req.candidateId, req.organizationId);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/application/:id', requirePortalAuth, async (req, res) => {
  try {
    const data = await svc.getApplication(req.params.id, req.candidateId, req.organizationId);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

/**
 * GDPR self-service (Art. 15/20 "right to access/portability").
 * GET /api/portal/gdpr/export
 */
router.get('/gdpr/export', requirePortalAuth, async (req, res) => {
  try {
    const exportPayload = await svc.exportGdprData(req.candidateId, req.organizationId);
    res.setHeader('Content-Disposition', `attachment; filename="my-data-export-${Date.now()}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.json(exportPayload);
  } catch (error) {
    if (error.statusCode) return handle(res, error);
    console.error('[portal] /gdpr/export error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to export data' });
  }
});

/**
 * GDPR self-service erasure (Art. 17 "right to be forgotten").
 * POST /api/portal/gdpr/erase   body: { confirm: true }
 */
router.post('/gdpr/erase', requirePortalAuth, async (req, res) => {
  try {
    const body = await svc.eraseGdprData(req.candidateId, req.organizationId, req.body?.confirm);
    res.json(body);
  } catch (error) {
    if (error.statusCode) return handle(res, error);
    console.error('[portal] /gdpr/erase error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to process erasure request' });
  }
});

module.exports = router;
