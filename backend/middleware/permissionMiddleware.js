const logger = require('../utils/logger');
/**
 * Fine-grained permission middleware (Enterprise custom roles + org role overrides).
 *
 * Resolution order for a user:
 * 1. Custom role pack (customRoleId) if assigned
 * 2. Organization rolePermissionOverrides for their system role
 * 3. DEFAULT_ROLE_PERMISSIONS for their system role
 */
const mongoose = require('mongoose');
const { DEFAULT_ROLE_PERMISSIONS } = require('../config/permissions');

/**
 * Resolves the effective permission list for a user.
 */
const getEffectivePermissions = async (user) => {
  if (!user) return [];

  // Owner is always fully privileged at the application layer
  if (user.role === 'owner') {
    return DEFAULT_ROLE_PERMISSIONS.owner || [];
  }

  if (user.customRoleId) {
    try {
      const CustomRole = mongoose.model('CustomRole');
      const role = await CustomRole.findOne({
        _id: user.customRoleId,
        organizationId: user.organizationId,
      }).lean();
      if (role) return role.permissions || [];
    } catch (err) {
      logger.warn(
        '[permissionMiddleware] Failed to resolve CustomRole, falling back to org/default role permissions:',
        err.message
      );
    }
  }

  if (user.organizationId && user.role) {
    try {
      const Organization = mongoose.model('Organization');
      const org = await Organization.findById(user.organizationId)
        .select('rolePermissionOverrides')
        .lean();
      const override = org?.rolePermissionOverrides?.[user.role];
      if (Array.isArray(override) && override.length > 0) {
        return override;
      }
    } catch (err) {
      logger.warn(
        '[permissionMiddleware] Failed to resolve org role overrides:',
        err.message
      );
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
        return res.status(403).json({
          success: false,
          message: `You don't have the '${permission}' permission.`,
        });
      }
      next();
    } catch (error) {
      res.status(500).json({ success: false, message: 'Permission check failed' });
    }
  };
};

module.exports = { requirePermission, hasPermission, getEffectivePermissions };
