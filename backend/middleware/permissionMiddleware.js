const logger = require('../utils/logger');
/**
 * Fine-grained permission middleware (Enterprise custom roles).
 *
 * Layered ON TOP of the existing fixed-role RBAC (requireRole/requireAdmin/
 * etc.) — it does not replace it. Use requirePermission() on routes where
 * Enterprise orgs need finer control than the 5 fixed roles allow; every
 * other route keeps working exactly as before via requireRole().
 */
const mongoose = require('mongoose');
const { DEFAULT_ROLE_PERMISSIONS } = require('../config/permissions');

/**
 * Resolves the effective permission list for a user: their org's CustomRole
 * permissions if assigned, otherwise the fixed role's default permissions.
 */
const getEffectivePermissions = async (user) => {
  if (user.customRoleId) {
    try {
      const CustomRole = mongoose.model('CustomRole');
      const role = await CustomRole.findOne({ _id: user.customRoleId, organizationId: user.organizationId }).lean();
      if (role) return role.permissions || [];
    } catch (err) {
      logger.warn('[permissionMiddleware] Failed to resolve CustomRole, falling back to default role permissions:', err.message);
    }
  }
  return DEFAULT_ROLE_PERMISSIONS[user.role] || [];
};

const hasPermission = async (user, permission) => {
  const permissions = await getEffectivePermissions(user);
  return permissions.includes(permission);
};

/**
 * Returns middleware requiring the authenticated user to hold `permission`.
 * Owners always pass (owners are always fully privileged, custom roles or not).
 */
const requirePermission = (permission) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    if (req.user.role === 'owner') return next();

    try {
      const allowed = await hasPermission(req.user, permission);
      if (!allowed) {
        return res.status(403).json({ success: false, message: `You don't have the '${permission}' permission.` });
      }
      next();
    } catch (error) {
      res.status(500).json({ success: false, message: 'Permission check failed' });
    }
  };
};

module.exports = { requirePermission, hasPermission, getEffectivePermissions };
