/**
 * API Key authentication for the public REST API — separate from the
 * user-session JWT (authMiddleware.js). Used by /api/v1/public/* only.
 *
 * Expects header: `Authorization: Bearer sk_live_...`
 */
const ApiKey = require('../models/ApiKey');
const Organization = require('../models/Organization');
const { planHasFeature } = require('../config/planFeatures');

const verifyApiKey = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const plaintext = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    if (!plaintext || !plaintext.startsWith('sk_live_')) {
      return res.status(401).json({ success: false, message: 'Missing or invalid API key. Use "Authorization: Bearer sk_live_..."' });
    }

    const keyHash = ApiKey.hashKey(plaintext);
    const apiKey = await ApiKey.findOne({ keyHash, isActive: true });
    if (!apiKey) {
      return res.status(401).json({ success: false, message: 'Invalid or revoked API key' });
    }

    const org = await Organization.findById(apiKey.organizationId).select('plan isActive');
    if (!org || !org.isActive) {
      return res.status(403).json({ success: false, message: 'Organization is not active' });
    }
    if (!planHasFeature(org.plan, 'integrations.webhooksReadOnly')) {
      return res.status(403).json({ success: false, code: 'UPGRADE_REQUIRED', message: 'The public API is not available on this organization\'s current plan.' });
    }

    apiKey.lastUsedAt = new Date();
    apiKey.save().catch(() => {}); // best-effort, don't block the request on this write

    req.apiKey = apiKey;
    req.organizationId = apiKey.organizationId;
    req.orgPlan = org.plan;
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: 'API key verification failed' });
  }
};

/** Requires the key to have the 'write' scope AND the org's plan to include full read/write access. */
const requireWriteScope = (req, res, next) => {
  if (!req.apiKey.scopes.includes('write')) {
    return res.status(403).json({ success: false, message: 'This API key is read-only. Issue a key with the "write" scope to use this endpoint.' });
  }
  if (!planHasFeature(req.orgPlan, 'integrations.webhooksFull')) {
    return res.status(403).json({ success: false, code: 'UPGRADE_REQUIRED', message: 'Write access to the public API requires the Enterprise plan.' });
  }
  next();
};

module.exports = { verifyApiKey, requireWriteScope };
