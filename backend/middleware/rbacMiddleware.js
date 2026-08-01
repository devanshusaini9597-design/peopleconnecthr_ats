/**
 * RBAC Middleware for SkillNix SaaS
 * 
 * Checks user role from req.user (set by verifyToken) against allowed roles.
 * Must be used AFTER verifyToken middleware.
 */

const mongoose = require('mongoose');

/**
 * Returns middleware that checks req.user.role against allowedRoles.
 * Returns 403 if not allowed.
 * @param  {...string} allowedRoles Roles that are permitted
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ success: false, message: 'Authentication required or missing role' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: `Access denied. Required one of: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
};

const requireOwner = requireRole('owner');
const requireAdmin = requireRole('owner', 'admin');
const requireRecruiterOrAbove = requireRole('owner', 'admin', 'recruiter');
const requireInterviewerOrAbove = requireRole('owner', 'admin', 'recruiter', 'interviewer');

/**
 * Maps a logical resource name (used throughout routes/checkPlanLimit calls)
 * to the actual field names on Organization.usageLimits / Organization.usageCurrent.
 * These do NOT match 1:1 (e.g. usageLimits.maxUsers vs usageCurrent.users,
 * and usageCurrent.emailsSent instead of "emails") — this mapping is the
 * single source of truth so the two schemas never drift out of sync again.
 */
const RESOURCE_FIELD_MAP = {
  users: { limitField: 'maxUsers', currentField: 'users' },
  jobs: { limitField: 'maxJobs', currentField: 'jobs' },
  candidates: { limitField: 'maxCandidates', currentField: 'candidates' },
  emails: { limitField: 'maxEmailsPerMonth', currentField: 'emailsSent' }
};

/**
 * Middleware that checks if the organization is within plan limits for the given resource.
 * @param {string} resource One of: 'users', 'jobs', 'candidates', 'emails'
 */
const checkPlanLimit = (resource) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.organizationId) {
        return res.status(401).json({ success: false, message: 'Organization context required' });
      }

      const fields = RESOURCE_FIELD_MAP[resource];
      if (!fields) {
        return res.status(500).json({ success: false, message: `Invalid resource check: ${resource}` });
      }

      const Organization = mongoose.model('Organization');
      const org = await Organization.findById(req.user.organizationId);

      if (!org) {
        return res.status(404).json({ success: false, message: 'Organization not found' });
      }

      const limit = org.usageLimits && org.usageLimits[fields.limitField];
      const current = (org.usageCurrent && org.usageCurrent[fields.currentField]) || 0;

      // If limit is 0 or undefined, we assume unlimited, or depending on business logic. 
      // Typically -1 means unlimited, or missing limit means unlimited. Let's assume undefined = unlimited, 0 = no access.
      if (typeof limit === 'number' && limit !== -1 && current >= limit) {
        return res.status(403).json({
          success: false,
          code: 'PLAN_LIMIT_EXCEEDED',
          message: `You have reached your plan limit for ${resource} (${current}/${limit}). Please upgrade your plan to continue.`,
          upgradeRequired: true,
          resource
        });
      }

      next();
    } catch (error) {
      console.error('Plan limit check error:', error);
      res.status(500).json({ success: false, message: 'Server error checking plan limits' });
    }
  };
};

module.exports = {
  requireRole,
  requireOwner,
  requireAdmin,
  requireRecruiterOrAbove,
  requireInterviewerOrAbove,
  checkPlanLimit
};
