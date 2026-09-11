const logger = require('../utils/logger');
/**
 * RBAC Middleware for SkillNix SaaS
 * 
 * Checks user role from req.user (set by verifyToken) against allowed roles.
 * Must be used AFTER verifyToken middleware.
 */

const mongoose = require('mongoose');
const { getLimitsForPlan } = require('../config/planLimits');
const { isFreelancer } = require('../utils/dataScope');

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
/** Owner or Admin only — privileged org settings (system role templates, etc.). */
const requireOwnerOrAdmin = requireRole('owner', 'admin');
const requireAdmin = requireRole('owner', 'admin', 'hr_manager');
/** Candidate Excel export — owner, admin, and manager only. */
const CANDIDATE_EXPORT_ROLES = ['owner', 'admin', 'hr_manager'];
const requireCandidateExport = requireRole(...CANDIDATE_EXPORT_ROLES);
const requireRecruiterOrAbove = requireRole(
  'owner', 'admin', 'hr_manager', 'hr_recruiter', 'recruiter', 'sales'
);
const requireFreelancerOrRecruiter = requireRole(
  'owner', 'admin', 'hr_manager', 'hr_recruiter', 'recruiter', 'sales', 'freelancer'
);
const requireInterviewerOrAbove = requireRole(
  'owner', 'admin', 'hr_manager', 'hr_recruiter', 'recruiter', 'sales', 'interviewer'
);

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
        return res.status(403).json({
          success: false,
          code: 'ORG_REQUIRED',
          message: 'Organization context required to continue.',
        });
      }

      // Templates / drafts that are not real openings should not burn job quota.
      if (resource === 'jobs' && (req.body?.isTemplate === true || String(req.body?.status || '').toLowerCase() === 'draft')) {
        return next();
      }

      // Freelancers send via their own mail app (mailto), not ZeptoMail / Zoho
      // Campaigns. Email plan quota applies later when that access is enabled.
      if (resource === 'emails' && isFreelancer(req.user)) {
        return next();
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

      const planCeiling = getLimitsForPlan(org.plan || 'starter');
      const stored = org.usageLimits?.[fields.limitField];
      // Plan definition wins when unlimited (-1). Otherwise use stored org ceiling,
      // falling back to the plan table (avoids stale maxJobs:10 on enterprise orgs).
      const limit = planCeiling[fields.limitField] === -1
        ? -1
        : (typeof stored === 'number' ? stored : planCeiling[fields.limitField]);
      const current = (org.usageCurrent && org.usageCurrent[fields.currentField]) || 0;

      if (typeof limit === 'number' && limit !== -1 && current >= limit) {
        const label = resource === 'jobs'
          ? 'jobs'
          : resource === 'candidates'
            ? 'candidates'
            : resource === 'users'
              ? 'team seats'
              : resource === 'emails'
                ? 'emails this month'
                : resource;
        return res.status(403).json({
          success: false,
          code: 'PLAN_LIMIT_EXCEEDED',
          message: `Plan limit exceeded for ${label} (${current}/${limit}). Upgrade your plan in Billing to continue.`,
          upgradeRequired: true,
          resource,
          current,
          limit,
          plan: org.plan,
        });
      }

      next();
    } catch (error) {
      logger.error('Plan limit check error:', error);
      res.status(500).json({ success: false, message: 'Server error checking plan limits' });
    }
  };
};

module.exports = {
  requireRole,
  requireOwner,
  requireOwnerOrAdmin,
  requireAdmin,
  CANDIDATE_EXPORT_ROLES,
  requireCandidateExport,
  requireRecruiterOrAbove,
  requireFreelancerOrRecruiter,
  requireInterviewerOrAbove,
  checkPlanLimit
};
