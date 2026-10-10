const logger = require('../utils/logger');
/**
 * Feature Entitlement Middleware
 *
 * Gates a route by the organization's *plan*, independent of the user's role.
 * Must be used AFTER verifyToken (needs req.user.organizationId).
 *
 * Shape deliberately mirrors rbacMiddleware.requireRole so the two axes
 * (role vs. plan) compose the same way on a route:
 *
 *   router.get('/advanced', requireRecruiterOrAbove, requireFeature('analytics.advanced'), handler);
 */

const mongoose = require('mongoose');
const { planHasFeature, isInternalPreviewFeature, canUseFeature } = require('../config/planFeatures');
const { hasInternalPreviewAccess } = require('../utils/vendorDomains');
const entitlements = require('../services/entitlementService');

/**
 * Returns middleware that checks the org's plan includes `featureKey`.
 * Returns 403 with code UPGRADE_REQUIRED if not entitled.
 * @param {string} featureKey
 */
const requireFeature = (featureKey) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.organizationId) {
        return res.status(401).json({ success: false, message: 'Organization context required' });
      }

      // Freelancer private desk: Excel bulk import is included without company plan upgrade.
      // Records stay scoped to createdBy / freelancer isolation in candidate controllers.
      if (
        featureKey === 'jobs.bulkImport'
        && String(req.user.role || '').toLowerCase() === 'freelancer'
      ) {
        return next();
      }

      // Freelancers inherit push when the hosting company has it.
      // Announcements stay on the company plan — same Professional gate as everyone else.
      if (
        featureKey === 'push.notifications'
        && String(req.user.role || '').toLowerCase() === 'freelancer'
      ) {
        return next();
      }

      const Organization = mongoose.model('Organization');
      const org = await Organization.findById(req.user.organizationId)
        .select('plan planExpiresAt billingStatus domain allowedDomains isDemo atsSettings.internalPreview atsSettings.previewModules');

      if (!org) {
        return res.status(404).json({ success: false, message: 'Organization not found' });
      }

      await entitlements.persistExpiredIfNeeded(org);
      const plan = entitlements.effectivePlan(org);

      if (!planHasFeature(plan, featureKey)) {
        return res.status(403).json({
          success: false,
          code: entitlements.isUnpaid(org) ? 'PLAN_INACTIVE' : 'UPGRADE_REQUIRED',
          message: entitlements.isUnpaid(org)
            ? 'This workspace’s trial or subscription is no longer active. Open Billing to continue.'
            : `This feature (${featureKey}) is not included in your current plan. Please upgrade to continue.`,
          feature: featureKey,
          currentPlan: org.plan
        });
      }

      if (isInternalPreviewFeature(featureKey)) {
        const allowed = canUseFeature(plan, featureKey, {
          isDemo: Boolean(org.isDemo || req.user.isDemo),
          internalPreviewAccess: hasInternalPreviewAccess(req.user, org),
          previewModules: org.atsSettings?.previewModules,
        });
        if (!allowed) {
          return res.status(403).json({
            success: false,
            code: 'FEATURE_UNAVAILABLE',
            message: 'This feature is not available.',
            feature: featureKey,
          });
        }
      }

      next();
    } catch (error) {
      logger.error('Feature entitlement check error:', error);
      res.status(500).json({ success: false, message: 'Server error checking feature entitlement' });
    }
  };
};

module.exports = { requireFeature };
