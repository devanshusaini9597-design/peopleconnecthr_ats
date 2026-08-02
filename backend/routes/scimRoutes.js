/**
 * SCIM 2.0 User provisioning — Enterprise (sso.scim).
 * Mounted at /scim/v2 — bearer token auth (not session JWT).
 */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const SSOConfig = require('../models/SSOConfig');
const User = require('../models/User');
const Organization = require('../models/Organization');
const { planHasFeature } = require('../config/planFeatures');

const scimUserResource = (user) => ({
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
});

const scimAuth = async (req, res, next) => {
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
};

router.use(scimAuth);

router.get('/Users', async (req, res) => {
  try {
    const filter = req.query.filter;
    let query = { organizationId: req.scimOrgId };

    if (filter) {
      const emailMatch = filter.match(/userName eq "([^"]+)"/i) || filter.match(/emails\.value eq "([^"]+)"/i);
      if (emailMatch) {
        query.email = emailMatch[1].toLowerCase();
      }
    }

    const users = await User.find(query);
    const resources = users.map(scimUserResource);

    res.json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: resources.length,
      startIndex: 1,
      itemsPerPage: resources.length,
      Resources: resources
    });
  } catch (error) {
    res.status(500).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: error.message,
      status: '500'
    });
  }
});

router.get('/Users/:id', async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, organizationId: req.scimOrgId });
    if (!user) {
      return res.status(404).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'User not found',
        status: '404'
      });
    }
    res.json(scimUserResource(user));
  } catch (error) {
    res.status(500).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: error.message,
      status: '500'
    });
  }
});

router.post('/Users', async (req, res) => {
  try {
    const email = (req.body.userName || req.body.emails?.[0]?.value || '').toLowerCase().trim();
    const name = req.body.name?.formatted || req.body.displayName || email;
    if (!email) {
      return res.status(400).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'userName or email required',
        status: '400'
      });
    }

    let user = await User.findOne({ email, organizationId: req.scimOrgId });
    if (user) {
      return res.status(409).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'User already exists',
        status: '409'
      });
    }

    user = new User({
      email,
      name,
      organizationId: req.scimOrgId,
      role: 'recruiter',
      password: crypto.randomBytes(32).toString('hex'),
      isEmailVerified: true,
      onboardingCompleted: true,
      isActive: req.body.active !== false
    });
    await user.save();

    res.status(201).json(scimUserResource(user));
  } catch (error) {
    res.status(500).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: error.message,
      status: '500'
    });
  }
});

router.patch('/Users/:id', async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, organizationId: req.scimOrgId });
    if (!user) {
      return res.status(404).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'User not found',
        status: '404'
      });
    }

    const ops = req.body.Operations || [];
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

    if (req.body.active === false) user.isActive = false;

    await user.save();
    res.json(scimUserResource(user));
  } catch (error) {
    res.status(500).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: error.message,
      status: '500'
    });
  }
});

/** Issue or rotate SCIM bearer token (mounted on /api/sso/scim-token) */
const issueScimToken = async (organizationId) => {
  const plain = `scim_${crypto.randomBytes(32).toString('hex')}`;
  const hash = await bcrypt.hash(plain, 10);
  await SSOConfig.findOneAndUpdate(
    { organizationId },
    { $set: { scimTokenHash: hash, scimTokenIssuedAt: new Date() } },
    { upsert: true, setDefaultsOnInsert: true }
  );
  return plain;
};

module.exports = router;
module.exports.issueScimToken = issueScimToken;
