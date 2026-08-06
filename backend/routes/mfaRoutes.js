/**
 * MFA routes — thin wrappers. Logic in mfaRouteService.
 *
 * Public:
 *   POST /verify-mfa — complete login after password step
 *
 * Protected (verifyToken):
 *   GET  /status
 *   POST /setup — requires security.mfa
 *   POST /verify-setup
 *   POST /disable
 */
const express = require('express');
const router = express.Router();

const { verifyToken } = require('../middleware/authMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');
const { requireOrganization } = require('../middleware/tenantMiddleware');
const { setAuthCookie } = require('../utils/authCookies');
const mfa = require('../services/mfaRouteService');

function handle(res, error) {
  const status = error.statusCode || 500;
  const body = { success: false, message: error.message };
  if (error.code) body.code = error.code;
  return res.status(status).json(body);
}

router.get('/status', verifyToken, async (req, res) => {
  try {
    const data = await mfa.getStatus(req.user.id);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/setup', mfa.verifyMfaAccess, requireOrganization, requireFeature('security.mfa'), async (req, res) => {
  try {
    const data = await mfa.setupMfa(req.user, req.mfaUser);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/verify-setup', mfa.verifyMfaAccess, requireOrganization, requireFeature('security.mfa'), async (req, res) => {
  try {
    const result = await mfa.verifySetup(req.user, req.body.code, req);
    if (result.setCookieToken) setAuthCookie(res, result.setCookieToken);
    res.json(result.body);
  } catch (error) {
    handle(res, error);
  }
});

router.post('/disable', verifyToken, requireOrganization, requireFeature('security.mfa'), async (req, res) => {
  try {
    const body = await mfa.disableMfa(req.user.id, req.body);
    res.json(body);
  } catch (error) {
    handle(res, error);
  }
});

router.post('/verify-mfa', async (req, res) => {
  try {
    const result = await mfa.verifyMfaLogin(req.body, req);
    if (result.setCookieToken) setAuthCookie(res, result.setCookieToken);
    res.json(result.body);
  } catch (error) {
    handle(res, error);
  }
});

module.exports = router;
