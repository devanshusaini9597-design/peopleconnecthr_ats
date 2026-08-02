const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const { planHasFeature } = require('../config/planFeatures');
const { ipMatchesAllowlist } = require('../utils/ipMatch');
const { getClientIp } = require('../utils/clientIp');

/**
 * Reject requests from IPs not on the org allowlist when the feature is entitled
 * and the list is non-empty. Mount after verifyToken on protected API routes.
 */
const ipAllowlistMiddleware = async (req, res, next) => {
  try {
    if (!req.user?.organizationId) return next();

    const org = await Organization.findById(req.user.organizationId)
      .select('plan securitySettings');

    if (!org) return next();

    if (!planHasFeature(org.plan, 'security.ipAllowlist')) return next();

    const allowlist = org.securitySettings?.ipAllowlist || [];
    if (!allowlist.length) return next();

    const clientIp = getClientIp(req);
    if (!ipMatchesAllowlist(clientIp, allowlist)) {
      return res.status(403).json({
        success: false,
        code: 'IP_NOT_ALLOWED',
        message: 'Access from your IP address is not permitted by your organization security policy.'
      });
    }

    next();
  } catch (error) {
    console.error('[ipAllowlistMiddleware]', error.message);
    res.status(500).json({ success: false, message: 'Server error checking IP allowlist' });
  }
};

module.exports = { ipAllowlistMiddleware };
