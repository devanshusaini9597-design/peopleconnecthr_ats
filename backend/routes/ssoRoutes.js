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
const eventBus = require('../events/eventBus');
const eventTypes = require('../events/eventTypes');

const BACKEND_URL = (process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, '');
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

const spIssuer = (orgSlug) => `${BACKEND_URL}/sso/${orgSlug}`;
const spCallbackUrl = (orgSlug) => `${BACKEND_URL}/sso/${orgSlug}/acs`;

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
    const { idpCert, ...safe } = config.toObject();
    res.json({ success: true, data: { ...safe, hasCert: !!idpCert } });
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
    acsUrl: spCallbackUrl(org.slug),
    entityId: spIssuer(org.slug)
  });
});

router.put('/config', verifyToken, requireOrganization, tenantScope, requireAdmin, requireFeature('sso'), async (req, res) => {
  try {
    const { entryPoint, idpIssuer, idpCert, wantAssertionsSigned, attributeMap, defaultRole, jitProvisioning, enabled } = req.body;

    let config = await SSOConfig.findOne({ organizationId: req.user.organizationId });
    const isNew = !config;
    if (!config) {
      if (!entryPoint || !idpCert) {
        return res.status(400).json({ success: false, message: 'entryPoint and idpCert are required to create SSO config' });
      }
      config = new SSOConfig({ organizationId: req.user.organizationId, entryPoint, idpCert });
    }

    if (entryPoint !== undefined) config.entryPoint = entryPoint;
    if (idpIssuer !== undefined) config.idpIssuer = idpIssuer;
    if (idpCert !== undefined && idpCert) config.idpCert = idpCert; // only overwrite if a new cert is actually provided
    if (wantAssertionsSigned !== undefined) config.wantAssertionsSigned = !!wantAssertionsSigned;
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

    const { idpCert: _omit, ...safe } = config.toObject();
    res.status(isNew ? 201 : 200).json({ success: true, data: { ...safe, hasCert: true } });
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

    const saml = buildSaml(org, ssoConfig);
    const url = await saml.getAuthorizeUrlAsync('', req.hostname, {});
    res.redirect(url);
  } catch (error) {
    console.error('[SSO login] Error:', error.message);
    res.status(500).send(`SSO login failed: ${error.message}`);
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

    const token = jwt.sign(
      { id: user._id, organizationId: user.organizationId, role: user.role, email: user.email, name: user.name || '' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

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
