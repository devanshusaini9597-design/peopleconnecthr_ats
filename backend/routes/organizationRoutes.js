const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requireRole, requireOwner, requireAdmin, requireRecruiterOrAbove, checkPlanLimit } = require('../middleware/rbacMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');
const { tenantScope, requireOrganization } = require('../middleware/tenantMiddleware');
const { getEntitlements } = require('../config/planFeatures');
const Organization = require('../models/Organization');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

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
    const { name, logo, domain, settings, atsSettings } = req.body;

    // Guard: atsSettings is a free-form blob accepted wholesale above, so a
    // plan-gated sub-field (careersCustomDomain) could otherwise be set by
    // any admin regardless of plan — a hidden-paywall bypass of exactly the
    // kind this app's plan-gating middleware exists to prevent everywhere
    // else. Strip it back out here unless the org's plan actually includes it.
    if (atsSettings && Object.prototype.hasOwnProperty.call(atsSettings, 'careersCustomDomain') && atsSettings.careersCustomDomain) {
      const { planHasFeature } = require('../config/planFeatures');
      const currentOrg = await Organization.findById(req.user.organizationId).select('plan');
      if (!currentOrg || !planHasFeature(currentOrg.plan, 'careers.customDomain')) {
        return res.status(403).json({
          success: false,
          code: 'UPGRADE_REQUIRED',
          message: 'Custom domain careers pages require the Enterprise plan.',
          feature: 'careers.customDomain'
        });
      }
    }

    // Same bypass guard for the White-Label Kit add-on — see routes/whiteLabelRoutes.js
    // for the dedicated CRUD, this only stops this wholesale endpoint from
    // being used to flip it on for an unentitled plan.
    if (atsSettings?.whiteLabel?.enabled) {
      const { planHasFeature } = require('../config/planFeatures');
      const currentOrg = await Organization.findById(req.user.organizationId).select('plan');
      if (!currentOrg || !planHasFeature(currentOrg.plan, 'whiteLabel')) {
        return res.status(403).json({
          success: false,
          code: 'UPGRADE_REQUIRED',
          message: 'The White-Label Kit requires the Enterprise plan.',
          feature: 'whiteLabel'
        });
      }
    }

    // Guard portal localization — requires portal.localization feature
    if (atsSettings?.portalLocalization?.enabled) {
      const { planHasFeature } = require('../config/planFeatures');
      const currentOrg = await Organization.findById(req.user.organizationId).select('plan');
      if (!currentOrg || !planHasFeature(currentOrg.plan, 'portal.localization')) {
        return res.status(403).json({
          success: false,
          code: 'UPGRADE_REQUIRED',
          message: 'Multi-locale candidate portal requires a plan that includes portal.localization.',
          feature: 'portal.localization'
        });
      }
    }

    const update = {};
    if (name !== undefined) update.name = name;
    if (logo !== undefined) update.logo = logo;
    if (domain !== undefined) update.domain = String(domain).trim().toLowerCase();
    if (settings !== undefined) update.settings = settings;
    if (atsSettings !== undefined) update.atsSettings = atsSettings;

    const org = await Organization.findByIdAndUpdate(
      req.user.organizationId,
      { $set: update },
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
 * GET /entitlements
 * Feature flags this org's current plan is entitled to (source of truth
 * for the frontend's <FeatureGate> and Sidebar plan filtering).
 */
router.get('/entitlements', async (req, res) => {
  try {
    const org = await Organization.findById(req.user.organizationId).select('plan');
    if (!org) return res.status(404).json({ success: false, message: 'Organization not found' });
    res.json({ success: true, plan: org.plan, entitlements: getEntitlements(org.plan) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Builds a Mongo filter for AuditLog queries from common query-string params.
 * Shared by the paginated list endpoint and the CSV export endpoint so they
 * stay in sync.
 */
const buildAuditLogFilter = (req) => {
  const filter = { organizationId: req.user.organizationId };
  if (req.query.action) filter.action = req.query.action;
  if (req.query.resource) filter.resource = req.query.resource;
  if (req.query.userId) filter.userId = req.query.userId;
  if (req.query.startDate || req.query.endDate) {
    filter.timestamp = {};
    if (req.query.startDate) filter.timestamp.$gte = new Date(req.query.startDate);
    if (req.query.endDate) filter.timestamp.$lte = new Date(req.query.endDate);
  }
  return filter;
};

/**
 * GET /audit-log
 * Paginated, filterable audit trail for this organization.
 * Query: page, limit (max 200), action, resource, userId, startDate, endDate
 */
router.get('/audit-log', requireAdmin, requireFeature('audit.log'), async (req, res) => {
  try {
    const filter = buildAuditLogFilter(req);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));

    const [entries, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('userId', 'name email')
        .lean(),
      AuditLog.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: entries,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /audit-log/distinct
 * Lightweight lists to populate the frontend's action/resource filter dropdowns.
 */
router.get('/audit-log/distinct', requireAdmin, requireFeature('audit.log'), async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const [actions, resources] = await Promise.all([
      AuditLog.distinct('action', { organizationId }),
      AuditLog.distinct('resource', { organizationId })
    ]);
    res.json({ success: true, actions: actions.sort(), resources: resources.sort() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /audit-log/export
 * CSV export of the (filtered) audit trail — Enterprise-only, per the blueprint.
 * Capped at 10,000 rows per export to keep this endpoint from hanging.
 */
router.get('/audit-log/export', requireAdmin, requireFeature('audit.export'), async (req, res) => {
  try {
    const filter = buildAuditLogFilter(req);
    const entries = await AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .limit(10000)
      .populate('userId', 'name email')
      .lean();

    const escapeCsv = (value) => {
      if (value === null || value === undefined) return '';
      const str = typeof value === 'string' ? value : JSON.stringify(value);
      return `"${str.replace(/"/g, '""')}"`;
    };

    const header = ['Timestamp', 'Action', 'Resource', 'Resource ID', 'User', 'Email', 'IP Address', 'Details'];
    const rows = entries.map((e) => [
      e.timestamp?.toISOString?.() || '',
      e.action,
      e.resource,
      e.resourceId || '',
      e.userId?.name || '',
      e.userId?.email || '',
      e.ipAddress || '',
      e.details
    ].map(escapeCsv).join(','));

    const csv = [header.map(escapeCsv).join(','), ...rows].join('\n');

    // Enterprise SIEM BYOK — also ship the export batch to Splunk/Datadog when configured.
    try {
      const { getAdapter } = require('../adapters');
      const siem = await getAdapter(req.user.organizationId, 'siem');
      if (siem && typeof siem.shipEvents === 'function') {
        await siem.shipEvents(entries.slice(0, 500).map((e) => ({
          timestamp: e.timestamp?.toISOString?.() || new Date().toISOString(),
          action: e.action,
          resource: e.resource,
          resourceId: e.resourceId,
          user: e.userId?.email || e.userId?.name,
          ipAddress: e.ipAddress
        })));
      }
    } catch (siemErr) {
      console.warn('[audit-export] SIEM ship failed:', siemErr.message);
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
