/**
 * Tenant Isolation Middleware
 * 
 * Automatically scopes all database queries to the current user's organization.
 * Must be used AFTER verifyToken middleware.
 */

/**
 * Middleware that sets req.tenantFilter. 
 * If user has no organizationId (mid-onboarding), skip gracefully.
 */
const tenantScope = (req, res, next) => {
  req.tenantFilter = {};
  
  if (req.user && req.user.organizationId) {
    req.tenantFilter = { organizationId: req.user.organizationId };
  }

  next();
};

/**
 * Middleware that returns 403 if user has no organizationId (for routes that require an org context)
 */
const requireOrganization = (req, res, next) => {
  if (!req.user || !req.user.organizationId) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: User is not associated with an organization'
    });
  }
  next();
};

module.exports = {
  tenantScope,
  requireOrganization
};
