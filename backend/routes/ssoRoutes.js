/**
 * SAML 2.0 / OIDC SSO — Enterprise-only.
 * Admin routes at /api/sso; public SP at /sso via publicRouter.
 */
const express = require('express');
const router = express.Router();

const { verifyToken } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/rbacMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');
const { requireOrganization, tenantScope } = require('../middleware/tenantMiddleware');
const { issueScimToken } = require('./scimRoutes');
const sso = require('../services/ssoService');

function handle(res, error) {
  const status = error.statusCode || 500;
  return res.status(status).json({ success: false, message: error.message });
}

const adminGate = [verifyToken, requireOrganization, tenantScope, requireAdmin, requireFeature('sso')];

router.get('/config', ...adminGate, async (req, res) => {
  try {
    const data = await sso.getConfig(req.user.organizationId);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/config/metadata-url', ...adminGate, async (req, res) => {
  try {
    const urls = await sso.getMetadataUrls(req.user.organizationId);
    res.json({ success: true, ...urls });
  } catch (error) {
    handle(res, error);
  }
});

router.put('/config', ...adminGate, async (req, res) => {
  try {
    const { isNew, data } = await sso.upsertConfig(req.user.organizationId, req.user.id, req.body);
    res.status(isNew ? 201 : 200).json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.post(
  '/scim-token',
  verifyToken,
  requireOrganization,
  tenantScope,
  requireAdmin,
  requireFeature('sso.scim'),
  async (req, res) => {
    try {
      const token = await issueScimToken(req.user.organizationId);
      res.json({
        success: true,
        data: {
          scimToken: token,
          scimBaseUrl: `${sso.BACKEND_URL}/scim/v2`,
          issuedAt: new Date().toISOString(),
        },
        message: 'Store this token securely — it will not be shown again.',
      });
    } catch (error) {
      handle(res, error);
    }
  }
);

router.post('/exchange', (req, res) => {
  try {
    const payload = sso.exchangeCode(req.body.code);
    const { setAuthCookie } = require('../utils/authCookies');
    if (payload.token) setAuthCookie(res, payload.token);
    const { token, ...safe } = payload;
    res.json({ success: true, ...safe });
  } catch (error) {
    handle(res, error);
  }
});

module.exports = router;

const publicRouter = express.Router();

publicRouter.get('/:orgSlug/login', async (req, res) => {
  try {
    await sso.startSamlLogin(req.params.orgSlug, req, res);
  } catch (error) {
    console.error('[SSO login] Error:', error.message);
    res.status(500).send(`SSO login failed: ${error.message}`);
  }
});

publicRouter.get('/:orgSlug/oidc/authorize', async (req, res) => {
  try {
    await sso.startOidcAuthorize(req.params.orgSlug, res);
  } catch (error) {
    console.error('[OIDC authorize] Error:', error.message);
    res.status(500).send(`OIDC login failed: ${error.message}`);
  }
});

publicRouter.get('/:orgSlug/oidc/callback', async (req, res) => {
  try {
    await sso.handleOidcCallback(req.params.orgSlug, req.query, req, res);
  } catch (error) {
    console.error('[OIDC callback] Error:', error.response?.data || error.message);
    res.status(401).send(`OIDC login failed: ${error.message}`);
  }
});

publicRouter.post('/:orgSlug/acs', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    await sso.handleSamlAcs(req.params.orgSlug, req.body, req, res);
  } catch (error) {
    console.error('[SSO ACS] Error:', error.message);
    res.status(401).send(`SSO login failed: ${error.message}`);
  }
});

publicRouter.get('/:orgSlug/metadata', async (req, res) => {
  try {
    await sso.getSpMetadata(req.params.orgSlug, res);
  } catch (error) {
    res.status(500).send(`Failed to generate metadata: ${error.message}`);
  }
});

module.exports.publicRouter = publicRouter;
