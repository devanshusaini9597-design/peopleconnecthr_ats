/**
 * Custom Role (Enterprise) CRUD + assignment.
 */
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/rbacMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');
const { tenantScope, requireOrganization } = require('../middleware/tenantMiddleware');
const {
  PERMISSIONS,
  PERMISSION_CATALOG,
  DEFAULT_ROLE_PERMISSIONS,
} = require('../config/permissions');
const CustomRole = require('../models/CustomRole');
const User = require('../models/User');
const Organization = require('../models/Organization');
const eventBus = require('../events/eventBus');
const eventTypes = require('../events/eventTypes');

/** System roles that can be customized per org (Owner is never editable). */
const EDITABLE_SYSTEM_ROLES = [
  { key: 'admin', label: 'Admin', description: 'Full org access except billing' },
  { key: 'hr_manager', label: 'HR Manager', description: 'Team leadership & hiring ops' },
  { key: 'hr_recruiter', label: 'HR Recruiter', description: 'Day-to-day hiring workflows' },
  { key: 'sales', label: 'Sales', description: 'Candidates & pipeline focus' },
  { key: 'freelancer', label: 'Freelance Recruiter', description: 'Own desk, open mandates, submit to SPOC' },
  { key: 'other', label: 'Other', description: 'Limited view access' },
];

/**
 * Who may edit which system role template:
 * - Owner → all listed roles
 * - Admin → all listed roles including Freelance Recruiter (never Owner; Owner is not listed)
 * - HR Manager → Recruiter / Sales / Freelance Recruiter / Other (cannot edit Admin or HR Manager)
 */
function canEditSystemRole(actorRole, targetRoleKey) {
  if (!actorRole || !targetRoleKey) return false;
  if (targetRoleKey === 'owner') return false;
  if (!EDITABLE_SYSTEM_ROLES.some((r) => r.key === targetRoleKey)) return false;
  if (actorRole === 'owner') return true;
  if (actorRole === 'admin') return true;
  if (actorRole === 'hr_manager') {
    return ['hr_recruiter', 'sales', 'freelancer', 'other'].includes(targetRoleKey);
  }
  return false;
}

router.use(verifyToken, requireOrganization, tenantScope, requireAdmin, requireFeature('team.customRoles'));

/**
 * GET /permissions — flat keys + grouped catalog for the Custom Roles UI.
 */
router.get('/permissions', (req, res) => {
  res.json({ success: true, data: PERMISSIONS, catalog: PERMISSION_CATALOG });
});

/**
 * GET /system-roles — org system role packs (defaults + overrides).
 * Each row includes canEdit based on the caller's role hierarchy.
 */
router.get('/system-roles', async (req, res) => {
  try {
    const org = await Organization.findById(req.user.organizationId)
      .select('rolePermissionOverrides')
      .lean();
    const overrides = org?.rolePermissionOverrides || {};
    const actorRole = req.user.role;
    const data = EDITABLE_SYSTEM_ROLES.map((meta) => {
      const defaults = DEFAULT_ROLE_PERMISSIONS[meta.key] || [];
      const override = overrides[meta.key];
      const isCustomized = Array.isArray(override) && override.length > 0;
      return {
        ...meta,
        kind: 'system',
        isCustomized,
        canEdit: canEditSystemRole(actorRole, meta.key),
        permissions: isCustomized ? override : defaults,
        defaultPermissions: defaults,
      };
    });
    res.json({
      success: true,
      data,
      canEditSystemRoles: data.some((r) => r.canEdit),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /system-roles/:roleKey — save org override for a system role.
 * Body: { permissions: string[] }
 */
router.put('/system-roles/:roleKey', async (req, res) => {
  try {
    const roleKey = String(req.params.roleKey || '').trim();
    const meta = EDITABLE_SYSTEM_ROLES.find((r) => r.key === roleKey);
    if (!meta) {
      return res.status(400).json({ success: false, message: 'This system role cannot be edited' });
    }
    if (!canEditSystemRole(req.user.role, roleKey)) {
      return res.status(403).json({
        success: false,
        message: 'You cannot edit this system role. HR Managers can only edit Recruiter, Sales, Freelance Recruiter, and Other.',
      });
    }
    const { permissions = [] } = req.body;
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ success: false, message: 'permissions must be an array' });
    }
    const invalid = permissions.filter((p) => !PERMISSIONS.includes(p));
    if (invalid.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Unknown permissions: ${invalid.join(', ')}`,
      });
    }

    const org = await Organization.findById(req.user.organizationId);
    if (!org) return res.status(404).json({ success: false, message: 'Organization not found' });

    const next = { ...(org.rolePermissionOverrides || {}) };
    next[roleKey] = permissions;
    org.rolePermissionOverrides = next;
    org.markModified('rolePermissionOverrides');
    await org.save();

    res.json({
      success: true,
      data: {
        ...meta,
        kind: 'system',
        isCustomized: true,
        permissions,
        defaultPermissions: DEFAULT_ROLE_PERMISSIONS[roleKey] || [],
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * DELETE /system-roles/:roleKey — reset to product defaults.
 */
router.delete('/system-roles/:roleKey', async (req, res) => {
  try {
    const roleKey = String(req.params.roleKey || '').trim();
    const meta = EDITABLE_SYSTEM_ROLES.find((r) => r.key === roleKey);
    if (!meta) {
      return res.status(400).json({ success: false, message: 'This system role cannot be edited' });
    }
    if (!canEditSystemRole(req.user.role, roleKey)) {
      return res.status(403).json({
        success: false,
        message: 'You cannot reset this system role. HR Managers can only edit Recruiter, Sales, and Other.',
      });
    }

    const org = await Organization.findById(req.user.organizationId);
    if (!org) return res.status(404).json({ success: false, message: 'Organization not found' });

    const next = { ...(org.rolePermissionOverrides || {}) };
    delete next[roleKey];
    org.rolePermissionOverrides = next;
    org.markModified('rolePermissionOverrides');
    await org.save();

    const defaults = DEFAULT_ROLE_PERMISSIONS[roleKey] || [];
    res.json({
      success: true,
      data: {
        ...meta,
        kind: 'system',
        isCustomized: false,
        permissions: defaults,
        defaultPermissions: defaults,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET / — list custom roles for this org
 */
router.get('/', async (req, res) => {
  try {
    const roles = await CustomRole.find({ organizationId: req.user.organizationId }).sort({ name: 1 });
    res.json({ success: true, data: roles });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST / — create a custom role
 * Body: { name, description, permissions: [string] }
 */
router.post('/', async (req, res) => {
  try {
    const { name, description, permissions = [] } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'name is required' });
    }
    const invalid = permissions.filter((p) => !PERMISSIONS.includes(p));
    if (invalid.length > 0) {
      return res.status(400).json({ success: false, message: `Unknown permissions: ${invalid.join(', ')}` });
    }

    const role = await CustomRole.create({
      organizationId: req.user.organizationId,
      name: name.trim(),
      description: description || '',
      permissions,
      createdBy: req.user.id
    });

    res.status(201).json({ success: true, data: role });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'A role with this name already exists in your organization' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /:id — update a custom role
 */
router.put('/:id', async (req, res) => {
  try {
    const { name, description, permissions } = req.body;
    const role = await CustomRole.findOne({ _id: req.params.id, organizationId: req.user.organizationId });
    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });

    if (name !== undefined) role.name = name.trim();
    if (description !== undefined) role.description = description;
    if (permissions !== undefined) {
      const invalid = permissions.filter((p) => !PERMISSIONS.includes(p));
      if (invalid.length > 0) {
        return res.status(400).json({ success: false, message: `Unknown permissions: ${invalid.join(', ')}` });
      }
      role.permissions = permissions;
    }

    await role.save();
    res.json({ success: true, data: role });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * DELETE /:id — delete a custom role (unassigns it from any users first)
 */
router.delete('/:id', async (req, res) => {
  try {
    const role = await CustomRole.findOneAndDelete({ _id: req.params.id, organizationId: req.user.organizationId });
    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });

    await User.updateMany({ customRoleId: role._id }, { $set: { customRoleId: null } });

    res.json({ success: true, message: 'Role deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /assign/:userId — assign (or clear, with customRoleId: null) a custom role to a user
 */
router.put('/assign/:userId', async (req, res) => {
  try {
    const { customRoleId } = req.body;
    const user = await User.findOne({ _id: req.params.userId, organizationId: req.user.organizationId });
    if (!user) return res.status(404).json({ success: false, message: 'User not found in your organization' });

    if (customRoleId) {
      const role = await CustomRole.findOne({ _id: customRoleId, organizationId: req.user.organizationId });
      if (!role) return res.status(400).json({ success: false, message: 'Custom role not found' });
    }

    user.customRoleId = customRoleId || null;
    await user.save();

    eventBus.emit(eventTypes.USER_ROLE_CHANGED, {
      organizationId: req.user.organizationId,
      userId: req.user.id,
      resourceType: 'User',
      resourceId: user._id,
      newCustomRoleId: user.customRoleId
    });

    res.json({ success: true, message: 'Custom role assignment updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
