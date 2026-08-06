/**
 * Tenant Isolation Middleware
 *
 * Sets req.tenantFilter and req.tenantId after verifyToken.
 * Prefer Model.find(...).setOptions({ _tenantId: req.tenantId }) when the
 * model uses tenantPlugin — otherwise spread req.tenantFilter into queries.
 */
const tenantScope = (req, res, next) => {
  req.tenantFilter = {};
  req.tenantId = null;

  if (req.user && req.user.organizationId) {
    req.tenantId = req.user.organizationId;
    req.tenantFilter = { organizationId: req.user.organizationId };
  }

  next();
};

/**
 * Apply tenant scoping option to a Mongoose query (for tenantPlugin models).
 */
const withTenant = (query, req) => {
  if (req?.tenantId) {
    return query.setOptions({ _tenantId: req.tenantId });
  }
  return query;
};

const requireOrganization = (req, res, next) => {
  if (!req.user || !req.user.organizationId) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: User is not associated with an organization',
    });
  }
  next();
};

module.exports = {
  tenantScope,
  requireOrganization,
  withTenant,
};
