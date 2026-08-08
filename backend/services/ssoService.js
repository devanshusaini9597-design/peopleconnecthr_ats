/**
 * SSO (SAML / OIDC) domain helpers + public SP flow.
 */
const jwt = require('jsonwebtoken');
const axios = require('axios');
const crypto = require('crypto');
const { JWT_SECRET } = require('../middleware/authMiddleware');
const { getEntitlements, planHasFeature } = require('../config/planFeatures');
const SSOConfig = require('../models/SSOConfig');
const Organization = require('../models/Organization');
const User = require('../models/User');
const ssoExchangeStore = require('./ssoExchangeStore');
const { issueAuthToken } = require('./sessionService');
const eventBus = require('../events/eventBus');
const eventTypes = require('../events/eventTypes');

const BACKEND_URL = (process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, '');
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

const spIssuer = (orgSlug) => `${BACKEND_URL}/sso/${orgSlug}`;
const spCallbackUrl = (orgSlug) => `${BACKEND_URL}/sso/${orgSlug}/acs`;
const oidcCallbackUrl = (orgSlug) => `${BACKEND_URL}/sso/${orgSlug}/oidc/callback`;

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

const sanitizeConfig = (config) => {
  const obj = config.toObject();
  const { idpCert, oidc, ...safe } = obj;
  return {
    ...safe,
    hasCert: !!idpCert,
    hasOidcSecret: !!oidc?.clientSecret,
    oidc: oidc ? { ...oidc, clientSecret: undefined } : undefined,
  };
};

const buildSaml = (org, ssoConfig) => {
  let SAML;
  try {
    ({ SAML } = require('@node-saml/node-saml'));
  } catch {
    throw new Error(
      '@node-saml/node-saml is not installed. Run `npm install` in backend/ to enable SSO.'
    );
  }

  return new SAML({
    entryPoint: ssoConfig.entryPoint,
    issuer: spIssuer(org.slug),
    callbackUrl: spCallbackUrl(org.slug),
    idpCert: ssoConfig.getDecryptedCert(),
    idpIssuer: ssoConfig.idpIssuer || undefined,
    wantAssertionsSigned: ssoConfig.wantAssertionsSigned,
    wantAuthnResponseSigned: false,
    disableRequestedAuthnContext: true,
  });
};

async function completeSsoLogin(user, org, req, res) {
  user.lastLoginAt = new Date();
  await user.save();

  const token = await issueAuthToken(user, req);
  const entitlements = getEntitlements(org.plan);
  const code = ssoExchangeStore.createCode({
    token,
    user: {
      name: user.name || '',
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      organizationId: user.organizationId,
      isEmailVerified: user.isEmailVerified,
      onboardingCompleted: user.onboardingCompleted,
      profilePicture: user.profilePicture || '',
    },
    organization: {
      name: org.name,
      slug: org.slug,
      logo: org.logo,
      plan: org.plan,
      planExpiresAt: org.planExpiresAt,
    },
    entitlements,
  });

  res.redirect(`${FRONTEND_URL}/sso/callback?code=${code}`);
}

async function getConfig(organizationId) {
  const config = await SSOConfig.findOne({ organizationId });
  if (!config) return null;
  return sanitizeConfig(config);
}

async function getMetadataUrls(organizationId) {
  const org = await Organization.findById(organizationId).select('slug');
  if (!org) throw httpError('Organization not found', 404);
  return {
    metadataUrl: `${BACKEND_URL}/sso/${org.slug}/metadata`,
    loginUrl: `${BACKEND_URL}/sso/${org.slug}/login`,
    oidcLoginUrl: `${BACKEND_URL}/sso/${org.slug}/oidc/authorize`,
    oidcCallbackUrl: oidcCallbackUrl(org.slug),
    acsUrl: spCallbackUrl(org.slug),
    entityId: spIssuer(org.slug),
  };
}

async function upsertConfig(organizationId, userId, body) {
  const {
    protocol,
    entryPoint,
    idpIssuer,
    idpCert,
    wantAssertionsSigned,
    attributeMap,
    defaultRole,
    jitProvisioning,
    enabled,
    oidc,
  } = body;

  let config = await SSOConfig.findOne({ organizationId });
  const isNew = !config;
  const selectedProtocol = protocol || config?.protocol || 'saml';

  if (!config) {
    config = new SSOConfig({ organizationId, protocol: selectedProtocol });
  }

  if (protocol !== undefined) config.protocol = protocol;

  if (selectedProtocol === 'saml') {
    if (isNew && (!entryPoint || !idpCert)) {
      throw httpError('entryPoint and idpCert are required for SAML SSO');
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
  config.configuredBy = config.configuredBy || userId;

  await config.save();

  eventBus.emit(eventTypes.INTEGRATION_CONFIGURED, {
    organizationId,
    userId,
    resourceType: 'SSOConfig',
    resourceId: config._id,
    action: isNew ? 'sso_created' : 'sso_updated',
  });

  return { isNew, data: sanitizeConfig(config) };
}

function exchangeCode(code) {
  if (!code) throw httpError('code is required');
  const payload = ssoExchangeStore.consumeCode(code);
  if (!payload) {
    throw httpError(
      'This SSO login link has expired or already been used. Please sign in again.'
    );
  }
  return payload;
}

async function startSamlLogin(orgSlug, req, res) {
  const org = await Organization.findOne({ slug: orgSlug }).select('slug plan');
  if (!org) return res.status(404).send('Organization not found');
  if (!planHasFeature(org.plan, 'sso')) {
    return res.status(403).send("SSO is not available on this organization's current plan.");
  }

  const ssoConfig = await SSOConfig.findOne({ organizationId: org._id, enabled: true });
  if (!ssoConfig) return res.status(404).send('SSO is not configured for this organization.');

  if (ssoConfig.protocol === 'oidc') {
    return res.redirect(`${BACKEND_URL}/sso/${org.slug}/oidc/authorize`);
  }

  const saml = buildSaml(org, ssoConfig);
  const url = await saml.getAuthorizeUrlAsync('', req.hostname, {});
  res.redirect(url);
}

async function startOidcAuthorize(orgSlug, res) {
  const org = await Organization.findOne({ slug: orgSlug }).select('slug plan');
  if (!org) return res.status(404).send('Organization not found');
  if (!planHasFeature(org.plan, 'sso')) {
    return res.status(403).send("SSO is not available on this organization's current plan.");
  }

  const ssoConfig = await SSOConfig.findOne({
    organizationId: org._id,
    enabled: true,
    protocol: 'oidc',
  });
  if (!ssoConfig?.oidc?.clientId || !ssoConfig.oidc.authorizationURL) {
    return res.status(404).send('OIDC SSO is not configured for this organization.');
  }

  const state = jwt.sign(
    { orgSlug: org.slug, nonce: crypto.randomBytes(16).toString('hex') },
    JWT_SECRET,
    { expiresIn: '10m' }
  );
  const redirectUri = ssoConfig.oidc.redirectUri || oidcCallbackUrl(org.slug);
  const params = new URLSearchParams({
    client_id: ssoConfig.oidc.clientId,
    response_type: 'code',
    scope: 'openid profile email',
    redirect_uri: redirectUri,
    state,
  });

  res.redirect(`${ssoConfig.oidc.authorizationURL}?${params.toString()}`);
}

async function handleOidcCallback(orgSlug, query, req, res) {
  const { code, state, error: oidcError } = query;
  if (oidcError) return res.status(401).send(`OIDC error: ${oidcError}`);

  let statePayload;
  try {
    statePayload = jwt.verify(state, JWT_SECRET);
  } catch {
    return res.status(401).send('Invalid or expired OIDC state');
  }

  const org = await Organization.findOne({ slug: orgSlug });
  if (!org || statePayload.orgSlug !== org.slug) {
    return res.status(400).send('Organization mismatch');
  }

  const ssoConfig = await SSOConfig.findOne({
    organizationId: org._id,
    enabled: true,
    protocol: 'oidc',
  });
  if (!ssoConfig) return res.status(404).send('OIDC SSO is not configured.');

  const redirectUri = ssoConfig.oidc.redirectUri || oidcCallbackUrl(org.slug);
  const tokenRes = await axios.post(
    ssoConfig.oidc.tokenURL,
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: ssoConfig.oidc.clientId,
      client_secret: ssoConfig.getDecryptedClientSecret(),
    }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  const accessToken = tokenRes.data.access_token;
  const userInfoRes = await axios.get(ssoConfig.oidc.userInfoURL, {
    headers: { Authorization: `Bearer ${accessToken}` },
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
      onboardingCompleted: true,
    });
    await user.save();
    eventBus.emit(eventTypes.USER_JOINED, {
      organizationId: org._id,
      userId: user._id,
      resourceType: 'User',
      resourceId: user._id,
      via: 'oidc_jit',
    });
  } else if (!user.isActive) {
    return res.status(403).send('This account has been deactivated.');
  }

  await completeSsoLogin(user, org, req, res);
}

async function handleSamlAcs(orgSlug, body, req, res) {
  const org = await Organization.findOne({ slug: orgSlug });
  if (!org) return res.status(404).send('Organization not found');

  const ssoConfig = await SSOConfig.findOne({ organizationId: org._id, enabled: true });
  if (!ssoConfig) return res.status(404).send('SSO is not configured for this organization.');

  const saml = buildSaml(org, ssoConfig);
  const { profile } = await saml.validatePostResponseAsync({ SAMLResponse: body.SAMLResponse });
  if (!profile) return res.status(401).send('Invalid SAML response — no profile returned.');

  const emailAttr = ssoConfig.attributeMap?.email || 'email';
  const nameAttr = ssoConfig.attributeMap?.name || 'name';
  const email = (profile[emailAttr] || profile.email || profile.nameID || '').toLowerCase().trim();
  const name = profile[nameAttr] || profile.displayName || email;

  if (!email) {
    return res
      .status(400)
      .send(
        'SAML assertion did not include an email attribute. Check the attribute mapping in SSO settings.'
      );
  }

  let user = await User.findOne({ email, organizationId: org._id });
  if (!user) {
    if (!ssoConfig.jitProvisioning) {
      return res
        .status(403)
        .send(
          `No account exists for ${email} in this organization, and just-in-time provisioning is disabled.`
        );
    }
    user = new User({
      email,
      name,
      organizationId: org._id,
      role: ssoConfig.defaultRole,
      password: crypto.randomBytes(32).toString('hex'),
      isEmailVerified: true,
      onboardingCompleted: true,
    });
    await user.save();
    eventBus.emit(eventTypes.USER_JOINED, {
      organizationId: org._id,
      userId: user._id,
      resourceType: 'User',
      resourceId: user._id,
      via: 'sso_jit',
    });
  } else if (!user.isActive) {
    return res.status(403).send('This account has been deactivated.');
  }

  user.lastLoginAt = new Date();
  await user.save();
  await completeSsoLogin(user, org, req, res);
}

async function getSpMetadata(orgSlug, res) {
  const org = await Organization.findOne({ slug: orgSlug });
  if (!org) return res.status(404).send('Organization not found');
  const ssoConfig = await SSOConfig.findOne({ organizationId: org._id });
  if (!ssoConfig) return res.status(404).send('SSO is not configured for this organization.');

  const saml = buildSaml(org, ssoConfig);
  const metadata = await saml.generateServiceProviderMetadata(null, null);
  res.type('application/xml').send(metadata);
}

module.exports = {
  BACKEND_URL,
  FRONTEND_URL,
  sanitizeConfig,
  getConfig,
  getMetadataUrls,
  upsertConfig,
  exchangeCode,
  startSamlLogin,
  startOidcAuthorize,
  handleOidcCallback,
  handleSamlAcs,
  getSpMetadata,
};
