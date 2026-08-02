/**
 * Career page builder — save/get pageBlocks JSON.
 * Basic blocks: careers.pageBuilder; enterprise extras: careers.whiteLabelBuilder.
 */
const express = require('express');
const router = express.Router();
const Organization = require('../models/Organization');
const { verifyToken } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/rbacMiddleware');
const { requireOrganization, tenantScope } = require('../middleware/tenantMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');
const { planHasFeature } = require('../config/planFeatures');

const ENTERPRISE_BLOCK_TYPES = ['custom_css', 'custom_html', 'video_hero', 'testimonials'];

/** GET /:orgSlug/blocks — public */
router.get('/:orgSlug/blocks', async (req, res) => {
  try {
    const org = await Organization.findOne({ slug: req.params.orgSlug })
      .select('name plan atsSettings.pageBlocks atsSettings.brandColor');
    if (!org) return res.status(404).json({ success: false, message: 'Organization not found' });

    let blocks = org.atsSettings?.pageBlocks || [];
    if (!planHasFeature(org.plan, 'careers.pageBuilder')) {
      blocks = [];
    } else if (!planHasFeature(org.plan, 'careers.whiteLabelBuilder')) {
      blocks = blocks.filter((b) => !ENTERPRISE_BLOCK_TYPES.includes(b.type));
    }

    res.json({
      success: true,
      data: {
        blocks,
        brandColor: org.atsSettings?.brandColor || '#4F46E5',
        pageBuilderEnabled: planHasFeature(org.plan, 'careers.pageBuilder')
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.use(verifyToken, requireOrganization, tenantScope, requireAdmin, requireFeature('careers.pageBuilder'));

/** GET /config — admin get full blocks */
router.get('/config', async (req, res) => {
  try {
    const org = await Organization.findById(req.user.organizationId)
      .select('atsSettings.pageBlocks plan atsSettings.brandColor');
    res.json({
      success: true,
      data: {
        blocks: org.atsSettings?.pageBlocks || [],
        brandColor: org.atsSettings?.brandColor || '#4F46E5',
        whiteLabelBuilder: planHasFeature(org.plan, 'careers.whiteLabelBuilder'),
        enterpriseBlockTypes: ENTERPRISE_BLOCK_TYPES
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** PUT /config — save blocks */
router.put('/config', async (req, res) => {
  try {
    const org = await Organization.findById(req.user.organizationId);
    if (!org) return res.status(404).json({ success: false, message: 'Organization not found' });

    let { blocks, brandColor } = req.body;
    if (!Array.isArray(blocks)) {
      return res.status(400).json({ success: false, message: 'blocks must be an array' });
    }

    if (!planHasFeature(org.plan, 'careers.whiteLabelBuilder')) {
      const hasEnterprise = blocks.some((b) => ENTERPRISE_BLOCK_TYPES.includes(b.type));
      if (hasEnterprise) {
        return res.status(403).json({
          success: false,
          code: 'UPGRADE_REQUIRED',
          message: 'Custom CSS/HTML and video hero blocks require the Enterprise plan (careers.whiteLabelBuilder).'
        });
      }
    }

    if (!org.atsSettings) org.atsSettings = {};
    org.atsSettings.pageBlocks = blocks;
    if (brandColor) org.atsSettings.brandColor = brandColor;
    org.markModified('atsSettings');
    await org.save();

    res.json({ success: true, data: { blocks: org.atsSettings.pageBlocks, brandColor: org.atsSettings.brandColor } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
