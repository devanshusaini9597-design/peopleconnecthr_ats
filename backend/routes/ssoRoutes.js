/**
 * SAML 2.0 SSO — Enterprise-only.
 *
 * Requires the `@node-saml/node-saml` package (added to package.json).
 *
 * Admin config (protected):
 *   GET  /api/sso/config           — current org's SSO config (idpCert redacted)
 *   PUT  /api/sso/config           — create/update SSO config
 *   GET  /api/sso/config/metadata-url — convenience: the SP metadata URL to give the IdP admin
 *
 * SP endpoints (public — the IdP and browser call these directly, no Authorization header):
 *   GET  /sso/:orgSlug/login       — redirects the browser to the IdP
 *   POST /sso/:orgSlug/acs         — Assertion Consumer Service: IdP posts the SAML response here
 *   GET  /sso/:orgSlug/metadata    — SP metadata XML for the customer's IdP admin
 *   POST /api/sso/exchange         — { code } -> { token, user, organization, entitlements } (one-time use)
 */
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const { verifyToken, JWT_SECRET } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/rbacMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');
const { requireOrganization, tenantScope } = require('../middleware/tenantMiddleware');
const { getEntitlements } = require('../config/planFeatures');
const SSOConfig = require('../models/SSOConfig');
const Organization = require('../models/Organization');
const User = require('../models/User');
const ssoExchangeStore = require('../services/ssoExchangeStore');
const axios = require('axios');
const crypto = require('crypto');
const { issueAuthToken } = require('../services/sessionService');
const { issueScimToken } = require('./scimRoutes');
const eventBus = require('../events/eventBus');
const eventTypes = require('../events/eventTypes');

const BACKEND_URL = (process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, '');
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

const spIssuer = (orgSlug) => `${BACKEND_URL}/sso/${orgSlug}`;
const spCallbackUrl = (orgSlug) => `${BACKEND_URL}/sso/${orgSlug}/acs`;
const oidcCallbackUrl = (orgSlug) => `${BACKEND_URL}/sso/${orgSlug}/oidc/callback`;

const sanitizeConfig = (config) => {
  const obj = config.toObject();
  const { idpCert, oidc, ...safe } = obj;
  return {
    ...safe,
    hasCert: !!idpCert,
    hasOidcSecret: !!oidc?.clientSecret,
    oidc: oidc ? { ...oidc, clientSecret: undefined } : undefined
  };
};

const completeSsoLogin = async (user, org, req, res) => {
  user.lastLoginAt = new Date();
  await user.save();

  const token = await issueAuthToken(user, req);
  const entitlements = getEntitlements(org.plan);
  const code = ssoExchangeStore.createCode({
    token,
    user: {
      name: user.name || '', email: user.email, phone: user.phone || '', role: user.role,
      organizationId: user.organizationId, isEmailVerified: user.isEmailVerified,
      onboardingCompleted: user.onboardingCompleted, profilePicture: user.profilePicture || ''
    },
    organization: { name: org.name, slug: org.slug, logo: org.logo, plan: org.plan, planExpiresAt: org.planExpiresAt },
    entitlements
  });

  res.redirect(`${FRONTEND_URL}/sso/callback?code=${code}`);
};

/**
 * Lazily requires @node-saml/node-saml so the app still boots if the
 * package isn't installed yet in environments that don't need SSO.
 */
const buildSaml = (org, ssoConfig) => {
  let SAML;
  try {
    ({ SAML } = require('@node-saml/node-saml'));
  } catch (err) {
    throw new Error('@node-saml/node-saml is not installed. Run `npm install` in backend/ to enable SSO.');
  }

  return new SAML({
    entryPoint: ssoConfig.entryPoint,
    issuer: spIssuer(org.slug),
    callbackUrl: spCallbackUrl(org.slug),
    idpCert: ssoConfig.getDecryptedCert(),
    idpIssuer: ssoConfig.idpIssuer || undefined,
    wantAssertionsSigned: ssoConfig.wantAssertionsSigned,
    wantAuthnResponseSigned: false, // most IdPs sign the assertion, not the outer response — admin can re-tighten via idpIssuer/cert accuracy
    disableRequestedAuthnContext: true
  });
};

// ─────────────────────────────────────────────────────────────────────────
// Admin config (protected)
// ─────────────────────────────────────────────────────────────────────────

router.get('/config', verifyToken, requireOrganization, tenantScope, requireAdmin, requireFeature('sso'), async (req, res) => {
  try {
    const config = await SSOConfig.findOne({ organizationId: req.user.organizationId });
    if (!config) return res.json({ success: true, data: null });
    res.json({ success: true, data: sanitizeConfig(config) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/config/metadata-url', verifyToken, requireOrganization, tenantScope, requireAdmin, requireFeature('sso'), async (req, res) => {
  const org = await Organization.findById(req.user.organizationId).select('slug');
  if (!org) return res.status(404).json({ success: false, message: 'Organization not found' });
  res.json({
    success: true,
    metadataUrl: `${BACKEND_URL}/sso/${org.slug}/metadata`,
    loginUrl: `${BACKEND_URL}/sso/${org.slug}/login`,
    oidcLoginUrl: `${BACKEND_URL}/sso/${org.slug}/oidc/authorize`,
    oidcCallbackUrl: oidcCallbackUrl(org.slug),
    acsUrl: spCallbackUrl(org.slug),
    entityId: spIssuer(org.slug)
  });
});

router.put('/config', verifyToken, requireOrganization, tenantScope, requireAdmin, requireFeature('sso'), async (req, res) => {
  try {
    const {
      protocol, entryPoint, idpIssuer, idpCert, wantAssertionsSigned,
      attributeMap, defaultRole, jitProvisioning, enabled, oidc
    } = req.body;

    let config = await SSOConfig.findOne({ organizationId: req.user.organizationId });
    const isNew = !config;
    const selectedProtocol = protocol || config?.protocol || 'saml';

    if (!config) {
      config = new SSOConfig({ organizationId: req.user.organizationId, protocol: selectedProtocol });
    }

    if (protocol !== undefined) config.protocol = protocol;

    if (selectedProtocol === 'saml') {
      if (isNew && (!entryPoint || !idpCert)) {
        return res.status(400).json({ success: false, message: 'entryPoint and idpCert are required for SAML SSO' });
      }
      if (entryPoint !== undefined) config.entryPoint = entryPoint;
      if (idpIssuer !== undefined) config.idpIssuer = idpIssuer;
      if (idpCert !== undefined && idpCert) config.idpCert = idpCert;
      if (wantAssertionsSigned !== undefined) config.wantAssertionsSigned = !!wantAssertionsSigned;
    }

    if (selectedProtocol === 'oidc' && oidc) {
      config.oidc = config.oidc || {};
      if (oidc.clientId !== undefined) config.oidc.clientId = oidc.clientId;
      if (oidc.clientSecret) config.oidc.clientSecret = oidc.clientSecret;
      if (oidc.issuer !== undefined) config.oidc.issuer = oidc.issuer;
      if (oidc.authorizationURL !== undefined) config.oidc.authorizationURL = oidc.authorizationURL;
      if (oidc.tokenURL !== undefined) config.oidc.tokenURL = oidc.tokenURL;
      if (oidc.userInfoURL !== undefined) config.oidc.userInfoURL = oidc.userInfoURL;
      if (oidc.redirectUri !== undefined) config.oidc.redirectUri = oidc.redirectUri;
    }

    if (attributeMap !== undefined) config.attributeMap = { ...config.attributeMap, ...attributeMap };
    if (defaultRole !== undefined) config.defaultRole = defaultRole;
    if (jitProvisioning !== undefined) config.jitProvisioning = !!jitProvisioning;
    if (enabled !== undefined) config.enabled = !!enabled;
    config.configuredBy = config.configuredBy || req.user.id;

    await config.save();

    eventBus.emit(eventTypes.INTEGRATION_CONFIGURED, {
      organizationId: req.user.organizationId,
      userId: req.user.id,
      resourceType: 'SSOConfig',
      resourceId: config._id,
      action: isNew ? 'sso_created' : 'sso_updated'
    });

    res.status(isNew ? 201 : 200).json({ success: true, data: sanitizeConfig(config) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/scim-token', verifyToken, requireOrganization, tenantScope, requireAdmin, requireFeature('sso.scim'), async (req, res) => {
  try {
    const token = await issueScimToken(req.user.organizationId);
    res.json({
      success: true,
      data: {
        scimToken: token,
        scimBaseUrl: `${BACKEND_URL}/scim/v2`,
        issuedAt: new Date().toISOString()
      },
      message: 'Store this token securely — it will not be shown again.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// One-time code exchange (public — called by the frontend right after redirect)
// ─────────────────────────────────────────────────────────────────────────

router.post('/exchange', (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ success: false, message: 'code is required' });

  const payload = ssoExchangeStore.consumeCode(code);
  if (!payload) {
    return res.status(400).json({ success: false, message: 'This SSO login link has expired or already been used. Please sign in again.' });
  }
  res.json({ success: true, ...payload });
});

module.exports = router;

// ─────────────────────────────────────────────────────────────────────────
// Public SP endpoints — exported separately since they're mounted at `/sso`
// (no /api prefix, no auth) rather than `/api/sso` like the routes above.
// ─────────────────────────────────────────────────────────────────────────

const publicRouter = express.Router();

publicRouter.get('/:orgSlug/login', async (req, res) => {
  try {
    const org = await Organization.findOne({ slug: req.params.orgSlug }).select('slug plan');
    if (!org) return res.status(404).send('Organization not found');

    const { planHasFeature } = require('../config/planFeatures');
    if (!planHasFeature(org.plan, 'sso')) {
      return res.status(403).send('SSO is not available on this organization\'s current plan.');
    }

    const ssoConfig = await SSOConfig.findOne({ organizationId: org._id, enabled: true });
    if (!ssoConfig) return res.status(404).send('SSO is not configured for this organization.');

    if (ssoConfig.protocol === 'oidc') {
      return res.redirect(`${BACKEND_URL}/sso/${org.slug}/oidc/authorize`);
    }

    const saml = buildSaml(org, ssoConfig);
    const url = await saml.getAuthorizeUrlAsync('', req.hostname, {});
    res.redirect(url);
  } catch (error) {
    console.error('[SSO login] Error:', error.message);
    res.status(500).send(`SSO login failed: ${error.message}`);
  }
});

publicRouter.get('/:orgSlug/oidc/authorize', async (req, res) => {
  try {
    const org = await Organization.findOne({ slug: req.params.orgSlug }).select('slug plan');
    if (!org) return res.status(404).send('Organization not found');

    const { planHasFeature } = require('../config/planFeatures');
    if (!planHasFeature(org.plan, 'sso')) {
      return res.status(403).send('SSO is not available on this organization\'s current plan.');
    }

    const ssoConfig = await SSOConfig.findOne({ organizationId: org._id, enabled: true, protocol: 'oidc' });
    if (!ssoConfig?.oidc?.clientId || !ssoConfig.oidc.authorizationURL) {
      return res.status(404).send('OIDC SSO is not configured for this organization.');
    }

    const state = jwt.sign({ orgSlug: org.slug, nonce: crypto.randomBytes(16).toString('hex') }, JWT_SECRET, { expiresIn: '10m' });
    const redirectUri = ssoConfig.oidc.redirectUri || oidcCallbackUrl(org.slug);
    const params = new URLSearchParams({
      client_id: ssoConfig.oidc.clientId,
      response_type: 'code',
      scope: 'openid profile email',
      redirect_uri: redirectUri,
      state
    });

    res.redirect(`${ssoConfig.oidc.authorizationURL}?${params.toString()}`);
  } catch (error) {
    console.error('[OIDC authorize] Error:', error.message);
    res.status(500).send(`OIDC login failed: ${error.message}`);
  }
});

publicRouter.get('/:orgSlug/oidc/callback', async (req, res) => {
  try {
    const { code, state, error: oidcError } = req.query;
    if (oidcError) return res.status(401).send(`OIDC error: ${oidcError}`);

    let statePayload;
    try {
      statePayload = jwt.verify(state, JWT_SECRET);
    } catch (err) {
      return res.status(401).send('Invalid or expired OIDC state');
    }

    const org = await Organization.findOne({ slug: req.params.orgSlug });
    if (!org || statePayload.orgSlug !== org.slug) {
      return res.status(400).send('Organization mismatch');
    }

    const ssoConfig = await SSOConfig.findOne({ organizationId: org._id, enabled: true, protocol: 'oidc' });
    if (!ssoConfig) return res.status(404).send('OIDC SSO is not configured.');

    const redirectUri = ssoConfig.oidc.redirectUri || oidcCallbackUrl(org.slug);
    const tokenRes = await axios.post(
      ssoConfig.oidc.tokenURL,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: ssoConfig.oidc.clientId,
        client_secret: ssoConfig.getDecryptedClientSecret()
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const accessToken = tokenRes.data.access_token;
    const userInfoRes = await axios.get(ssoConfig.oidc.userInfoURL, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const profile = userInfoRes.data;
    const emailAttr = ssoConfig.attributeMap?.email || 'email';
    const nameAttr = ssoConfig.attributeMap?.name || 'name';
    const email = (profile[emailAttr] || profile.email || '').toLowerCase().trim();
    const name = profile[nameAttr] || profile.name || profile.preferred_username || email;

    if (!email) {
      return res.status(400).send('OIDC userinfo did not include an email. Check attribute mapping.');
    }

    let user = await User.findOne({ email, organizationId: org._id });
    if (!user) {
      if (!ssoConfig.jitProvisioning) {
        return res.status(403).send(`No account exists for ${email}, and JIT provisioning is disabled.`);
      }
      user = new User({
        email,
        name,
        organizationId: org._id,
        role: ssoConfig.defaultRole,
        password: crypto.randomBytes(32).toString('hex'),
        isEmailVerified: true,
        onboardingCompleted: true
      });
      await user.save();
      eventBus.emit(eventTypes.USER_JOINED, { organizationId: org._id, userId: user._id, resourceType: 'User', resourceId: user._id, via: 'oidc_jit' });
    } else if (!user.isActive) {
      return res.status(403).send('This account has been deactivated.');
    }

    await completeSsoLogin(user, org, req, res);
  } catch (error) {
    console.error('[OIDC callback] Error:', error.response?.data || error.message);
    res.status(401).send(`OIDC login failed: ${error.message}`);
  }
});

publicRouter.post('/:orgSlug/acs', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const org = await Organization.findOne({ slug: req.params.orgSlug });
    if (!org) return res.status(404).send('Organization not found');

    const ssoConfig = await SSOConfig.findOne({ organizationId: org._id, enabled: true });
    if (!ssoConfig) return res.status(404).send('SSO is not configured for this organization.');

    const saml = buildSaml(org, ssoConfig);
    const { profile } = await saml.validatePostResponseAsync({ SAMLResponse: req.body.SAMLResponse });
    if (!profile) return res.status(401).send('Invalid SAML response — no profile returned.');

    const emailAttr = ssoConfig.attributeMap?.email || 'email';
    const nameAttr = ssoConfig.attributeMap?.name || 'name';
    const email = (profile[emailAttr] || profile.email || profile.nameID || '').toLowerCase().trim();
    const name = profile[nameAttr] || profile.displayName || email;

    if (!email) {
      return res.status(400).send('SAML assertion did not include an email attribute. Check the attribute mapping in SSO settings.');
    }

    let user = await User.findOne({ email, organizationId: org._id });
    if (!user) {
      if (!ssoConfig.jitProvisioning) {
        return res.status(403).send(`No account exists for ${email} in this organization, and just-in-time provisioning is disabled.`);
      }
      user = new User({
        email,
        name,
        organizationId: org._id,
        role: ssoConfig.defaultRole,
        password: require('crypto').randomBytes(32).toString('hex'), // unusable random password — SSO users never use password login
        isEmailVerified: true,
        onboardingCompleted: true
      });
      await user.save();
      eventBus.emit(eventTypes.USER_JOINED, { organizationId: org._id, userId: user._id, resourceType: 'User', resourceId: user._id, via: 'sso_jit' });
    } else if (!user.isActive) {
      return res.status(403).send('This account has been deactivated.');
    }

    user.lastLoginAt = new Date();
    await user.save();

    await completeSsoLogin(user, org, req, res);
  } catch (error) {
    console.error('[SSO ACS] Error:', error.message);
    res.status(401).send(`SSO login failed: ${error.message}`);
  }
});

publicRouter.get('/:orgSlug/metadata', async (req, res) => {
  try {
    const org = await Organization.findOne({ slug: req.params.orgSlug });
    if (!org) return res.status(404).send('Organization not found');
    const ssoConfig = await SSOConfig.findOne({ organizationId: org._id });
    if (!ssoConfig) return res.status(404).send('SSO is not configured for this organization.');

    const saml = buildSaml(org, ssoConfig);
    const metadata = await saml.generateServiceProviderMetadata(null, null);
    res.type('application/xml').send(metadata);
  } catch (error) {
    res.status(500).send(`Failed to generate metadata: ${error.message}`);
  }
});

module.exports.publicRouter = publicRouter;
