const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requireRole, requireOwner, requireAdmin, requireRecruiterOrAbove, checkPlanLimit } = require('../middleware/rbacMiddleware');
const { tenantScope, requireOrganization } = require('../middleware/tenantMiddleware');
const Organization = require('../models/Organization');
const User = require('../models/User');

// Apply middleware to all routes in this file
router.use(verifyToken, requireOrganization, tenantScope);

/**
 * GET /
 * Get current user's organization details
 */
router.get('/', async (req, res) => {
  try {
    const org = await Organization.findById(req.user.organizationId);
    if (!org) return res.status(404).json({ success: false, message: 'Organization not found' });
    res.json({ success: true, data: org });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /
 * Update organization (name, logo, settings, atsSettings)
 */
router.put('/', requireAdmin, async (req, res) => {
  try {
    const { name, logo, settings, atsSettings } = req.body;
    const org = await Organization.findByIdAndUpdate(
      req.user.organizationId,
      { $set: { name, logo, settings, atsSettings } },
      { new: true }
    );
    res.json({ success: true, data: org });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /members
 * List all org members with roles
 */
router.get('/members', async (req, res) => {
  try {
    const members = await User.find({ organizationId: req.user.organizationId }).select('-password');
    res.json({ success: true, data: members });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /members/:userId/role
 * Change a member's role (owner only)
 */
router.put('/members/:userId/role', requireOwner, async (req, res) => {
  try {
    const { role } = req.body;
    if (req.params.userId === req.user.id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot change your own role' });
    }
    const user = await User.findOneAndUpdate(
      { _id: req.params.userId, organizationId: req.user.organizationId },
      { $set: { role } },
      { new: true }
    ).select('-password');
    
    if (!user) return res.status(404).json({ success: false, message: 'User not found in organization' });
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * DELETE /members/:userId
 * Remove a member from org
 */
router.delete('/members/:userId', requireAdmin, async (req, res) => {
  try {
    if (req.params.userId === req.user.id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot remove yourself' });
    }
    const userToRemove = await User.findOne({ _id: req.params.userId, organizationId: req.user.organizationId });
    if (!userToRemove) return res.status(404).json({ success: false, message: 'User not found' });
    if (userToRemove.role === 'owner') return res.status(403).json({ success: false, message: 'Cannot remove owner' });

    await User.findByIdAndDelete(req.params.userId);
    res.json({ success: true, message: 'User removed from organization' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /usage
 * Get current plan usage stats
 */
router.get('/usage', async (req, res) => {
  try {
    const org = await Organization.findById(req.user.organizationId);
    res.json({ success: true, data: org.usageCurrent });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /audit-log
 * Get audit log entries
 */
router.get('/audit-log', requireAdmin, async (req, res) => {
  try {
    // STUB: Replace with actual AuditLog model query
    res.json({ success: true, data: [] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
