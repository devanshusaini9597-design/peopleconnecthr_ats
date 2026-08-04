/**
 * Public careers-site announcements (no auth).
 * Only returns active notices with audience=public for an org slug.
 */
const express = require('express');
const router = express.Router();
const Announcement = require('../models/Announcement');
const Organization = require('../models/Organization');
const { planHasFeature } = require('../config/planFeatures');

router.get('/:orgSlug', async (req, res) => {
  try {
    const slug = String(req.params.orgSlug || '').trim().toLowerCase();
    if (!slug) {
      return res.status(400).json({ success: false, message: 'Organization slug required' });
    }

    const org = await Organization.findOne({ slug }).select('_id plan').lean();
    if (!org) {
      return res.status(404).json({ success: false, message: 'Organization not found' });
    }
    if (!planHasFeature(org.plan, 'announcements')) {
      return res.json({ success: true, data: [] });
    }

    const now = new Date();
    const rows = await Announcement.find({
      organizationId: org._id,
      isActive: true,
      audience: 'public',
      startsAt: { $lte: now },
      $or: [{ endsAt: null }, { endsAt: { $gt: now } }]
    })
      .select('title body severity createdAt')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
