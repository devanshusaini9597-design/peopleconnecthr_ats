/**
 * Organization security settings — session policy, MFA enforcement, IP allowlist.
 */
const express = require('express');
const router = express.Router();

const { verifyToken } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/rbacMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');
const { requireOrganization, tenantScope } = require('../middleware/tenantMiddleware');
const { planHasFeature } = require('../config/planFeatures');
const Organization = require('../models/Organization');

router.use(verifyToken, requireOrganization, tenantScope, requireAdmin);

router.get('/settings', async (req, res) => {
  try {
    const org = await Organization.findById(req.user.organizationId)
      .select('securitySettings deploymentTier plan');
    if (!org) return res.status(404).json({ success: false, message: 'Organization not found' });

    res.json({
      success: true,
      data: {
        securitySettings: org.securitySettings,
        deploymentTier: org.deploymentTier,
        plan: org.plan,
        entitlements: {
          mfaEnforcement: planHasFeature(org.plan, 'security.mfaEnforcement'),
          sessionPolicy: planHasFeature(org.plan, 'security.sessionPolicy'),
          ipAllowlist: planHasFeature(org.plan, 'security.ipAllowlist'),
          dedicated: planHasFeature(org.plan, 'deployment.dedicated')
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/settings', async (req, res) => {
  try {
    const org = await Organization.findById(req.user.organizationId).select('plan securitySettings deploymentTier');
    if (!org) return res.status(404).json({ success: false, message: 'Organization not found' });

    const { mfaEnforced, sessionIdleMinutes, maxConcurrentSessions, ipAllowlist } = req.body;
    const updates = { ...org.securitySettings?.toObject?.() || org.securitySettings || {} };

    if (mfaEnforced !== undefined) {
      if (!planHasFeature(org.plan, 'security.mfaEnforcement')) {
        return res.status(403).json({
          success: false,
          code: 'UPGRADE_REQUIRED',
          feature: 'security.mfaEnforcement',
          message: 'MFA enforcement requires the Professional plan or higher.'
        });
      }
      updates.mfaEnforced = !!mfaEnforced;
    }

    if (sessionIdleMinutes !== undefined || maxConcurrentSessions !== undefined) {
      if (!planHasFeature(org.plan, 'security.sessionPolicy')) {
        return res.status(403).json({
          success: false,
          code: 'UPGRADE_REQUIRED',
          feature: 'security.sessionPolicy',
          message: 'Session policy requires the Professional plan or higher.'
        });
      }
      if (sessionIdleMinutes !== undefined) {
        const mins = parseInt(sessionIdleMinutes, 10);
        if (Number.isNaN(mins) || mins < 5 || mins > 10080) {
          return res.status(400).json({ success: false, message: 'sessionIdleMinutes must be between 5 and 10080' });
        }
        updates.sessionIdleMinutes = mins;
      }
      if (maxConcurrentSessions !== undefined) {
        const max = parseInt(maxConcurrentSessions, 10);
        if (Number.isNaN(max) || max < 1 || max > 50) {
          return res.status(400).json({ success: false, message: 'maxConcurrentSessions must be between 1 and 50' });
        }
        updates.maxConcurrentSessions = max;
      }
    }

    if (ipAllowlist !== undefined) {
      if (!planHasFeature(org.plan, 'security.ipAllowlist')) {
        return res.status(403).json({
          success: false,
          code: 'UPGRADE_REQUIRED',
          feature: 'security.ipAllowlist',
          message: 'IP allowlist requires the Enterprise plan.'
        });
      }
      if (!Array.isArray(ipAllowlist)) {
        return res.status(400).json({ success: false, message: 'ipAllowlist must be an array of IP addresses or CIDR ranges' });
      }
      updates.ipAllowlist = ipAllowlist.map((ip) => String(ip).trim()).filter(Boolean);
    }

    org.securitySettings = updates;
    await org.save();

    res.json({
      success: true,
      data: {
        securitySettings: org.securitySettings,
        deploymentTier: org.deploymentTier
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
