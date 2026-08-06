/**
 * Custom Role (Enterprise) CRUD + assignment.
 */
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/rbacMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');
const { tenantScope, requireOrganization } = require('../middleware/tenantMiddleware');
const { PERMISSIONS, PERMISSION_CATALOG } = require('../config/permissions');
const CustomRole = require('../models/CustomRole');
const User = require('../models/User');
const eventBus = require('../events/eventBus');
const eventTypes = require('../events/eventTypes');

router.use(verifyToken, requireOrganization, tenantScope, requireAdmin, requireFeature('team.customRoles'));

/**
 * GET /permissions — flat keys + grouped catalog for the Custom Roles UI.
 */
router.get('/permissions', (req, res) => {
  res.json({ success: true, data: PERMISSIONS, catalog: PERMISSION_CATALOG });
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
