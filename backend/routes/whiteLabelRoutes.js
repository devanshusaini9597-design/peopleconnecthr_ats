/**
 * White-Label Kit — Add-on (feature key: whiteLabel, Enterprise)
 *
 * Brand color + logo stay free for every plan (see Organization.atsSettings
 * .brandColor / Organization.logo, set via the generic /api/organization
 * endpoint). This route only covers the gated "kit extras": hiding
 * "Powered by SkillNix" on candidate-facing surfaces and a custom
 * transactional-email sender display name.
 */

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/rbacMiddleware');
const { requireOrganization, tenantScope } = require('../middleware/tenantMiddleware');
const { planHasFeature } = require('../config/planFeatures');
const Organization = require('../models/Organization');

router.use(verifyToken, requireOrganization, tenantScope, requireAdmin);

/** GET / — current white-label settings + whether this org is entitled to change them */
router.get('/', async (req, res) => {
  try {
    const org = await Organization.findById(req.user.organizationId).select('plan atsSettings.whiteLabel atsSettings.brandColor');
    if (!org) return res.status(404).json({ success: false, message: 'Organization not found' });

    res.json({
      success: true,
      data: {
        entitled: planHasFeature(org.plan, 'whiteLabel'),
        brandColor: org.atsSettings?.brandColor || '#4F46E5',
        whiteLabel: org.atsSettings?.whiteLabel || { enabled: false, hidePoweredBy: false, emailFromName: '' }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT / — update white-label settings.
 * `brandColor` alone is always free (matches the logo customization that's
 * already unrestricted); only turning the `enabled` toggle on (or changing
 * hidePoweredBy/emailFromName while it's on) requires the Enterprise
 * entitlement, checked manually below instead of a blanket requireFeature
 * so brand-color-only edits never get blocked by plan.
 */
router.put('/', async (req, res) => {
  try {
    const { enabled, hidePoweredBy, emailFromName, brandColor } = req.body;

    const changingGatedFields = enabled !== undefined || hidePoweredBy !== undefined || emailFromName !== undefined;
    if (changingGatedFields && enabled !== false) {
      const org = await Organization.findById(req.user.organizationId).select('plan atsSettings.whiteLabel.enabled');
      const willBeEnabled = enabled !== undefined ? enabled : org?.atsSettings?.whiteLabel?.enabled;
      if (willBeEnabled && !planHasFeature(org?.plan, 'whiteLabel')) {
        return res.status(403).json({
          success: false,
          code: 'UPGRADE_REQUIRED',
          message: 'The White-Label Kit requires the Enterprise plan.',
          feature: 'whiteLabel'
        });
      }
    }

    const update = {};
    if (enabled !== undefined) update['atsSettings.whiteLabel.enabled'] = !!enabled;
    if (hidePoweredBy !== undefined) update['atsSettings.whiteLabel.hidePoweredBy'] = !!hidePoweredBy;
    if (emailFromName !== undefined) update['atsSettings.whiteLabel.emailFromName'] = String(emailFromName).trim();
    if (brandColor !== undefined) update['atsSettings.brandColor'] = String(brandColor).trim();

    const org = await Organization.findByIdAndUpdate(
      req.user.organizationId,
      { $set: update },
      { new: true }
    ).select('atsSettings.whiteLabel atsSettings.brandColor');

    res.json({ success: true, data: { brandColor: org.atsSettings.brandColor, whiteLabel: org.atsSettings.whiteLabel } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
