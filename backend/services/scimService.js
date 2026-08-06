/**
 * SCIM 2.0 User provisioning — Enterprise (sso.scim).
 */
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const SSOConfig = require('../models/SSOConfig');
const User = require('../models/User');
const Organization = require('../models/Organization');
const { planHasFeature } = require('../config/planFeatures');

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

function scimUserResource(user) {
  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    id: user._id.toString(),
    userName: user.email,
    name: { formatted: user.name || user.email },
    emails: [{ value: user.email, primary: true }],
    active: user.isActive !== false,
    meta: {
      resourceType: 'User',
      created: user.createdAt,
      lastModified: user.updatedAt
    }
  };
}

/** Bearer token auth middleware for /scim/v2 */
async function scimAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'Bearer token required',
      status: '401'
    });
  }

  const token = auth.slice(7);
  const configs = await SSOConfig.find({ scimTokenHash: { $ne: null } }).select('scimTokenHash organizationId');

  let matched = null;
  for (const config of configs) {
    if (await bcrypt.compare(token, config.scimTokenHash)) {
      matched = config;
      break;
    }
  }

  if (!matched) {
    return res.status(401).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'Invalid SCIM token',
      status: '401'
    });
  }

  const org = await Organization.findById(matched.organizationId).select('plan isActive');
  if (!org || org.isActive === false) {
    return res.status(403).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'Organization inactive',
      status: '403'
    });
  }

  if (!planHasFeature(org.plan, 'sso.scim')) {
    return res.status(403).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'SCIM not entitled on current plan',
      status: '403'
    });
  }

  req.scimOrgId = matched.organizationId;
  next();
}

async function listUsers(organizationId, filter) {
  let query = { organizationId };

  if (filter) {
    const emailMatch = filter.match(/userName eq "([^"]+)"/i) || filter.match(/emails\.value eq "([^"]+)"/i);
    if (emailMatch) {
      query.email = emailMatch[1].toLowerCase();
    }
  }

  const users = await User.find(query);
  const resources = users.map(scimUserResource);

  return {
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults: resources.length,
    startIndex: 1,
    itemsPerPage: resources.length,
    Resources: resources
  };
}

async function getUser(organizationId, id) {
  const user = await User.findOne({ _id: id, organizationId });
  if (!user) throw httpError('User not found', 404);
  return scimUserResource(user);
}

async function createUser(organizationId, body) {
  const email = (body.userName || body.emails?.[0]?.value || '').toLowerCase().trim();
  const name = body.name?.formatted || body.displayName || email;
  if (!email) throw httpError('userName or email required', 400);

  let user = await User.findOne({ email, organizationId });
  if (user) throw httpError('User already exists', 409);

  user = new User({
    email,
    name,
    organizationId,
    role: 'recruiter',
    password: crypto.randomBytes(32).toString('hex'),
    isEmailVerified: true,
    onboardingCompleted: true,
    isActive: body.active !== false
  });
  await user.save();

  return scimUserResource(user);
}

async function patchUser(organizationId, id, body) {
  const user = await User.findOne({ _id: id, organizationId });
  if (!user) throw httpError('User not found', 404);

  const ops = body.Operations || [];
  for (const op of ops) {
    if (op.op === 'replace' || op.path === 'active') {
      const active = op.value?.active ?? op.value;
      if (active === false || active === 'false') {
        user.isActive = false;
      } else if (active === true || active === 'true') {
        user.isActive = true;
      }
    }
    if (op.path === 'name.formatted' && op.value) {
      user.name = op.value;
    }
  }

  if (body.active === false) user.isActive = false;

  await user.save();
  return scimUserResource(user);
}

/** Issue or rotate SCIM bearer token (used by /api/sso/scim-token) */
async function issueScimToken(organizationId) {
  const plain = `scim_${crypto.randomBytes(32).toString('hex')}`;
  const hash = await bcrypt.hash(plain, 10);
  await SSOConfig.findOneAndUpdate(
    { organizationId },
    { $set: { scimTokenHash: hash, scimTokenIssuedAt: new Date() } },
    { upsert: true, setDefaultsOnInsert: true }
  );
  return plain;
}

module.exports = {
  scimUserResource,
  scimAuth,
  listUsers,
  getUser,
  createUser,
  patchUser,
  issueScimToken,
};
