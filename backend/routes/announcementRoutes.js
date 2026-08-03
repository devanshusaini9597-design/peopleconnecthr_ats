const express = require('express');
const router = express.Router();
const Announcement = require('../models/Announcement');
const { requireFeature } = require('../middleware/featureMiddleware');
const { requireAdmin, requireRecruiterOrAbove } = require('../middleware/rbacMiddleware');

router.use(requireFeature('announcements'));

router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const role = req.user.role;
    const audienceFilter = ['all'];
    if (['owner', 'admin'].includes(role)) audienceFilter.push('admins');
    if (['owner', 'admin', 'recruiter'].includes(role)) audienceFilter.push('recruiters');

    const rows = await Announcement.find({
      organizationId: req.user.organizationId,
      isActive: true,
      audience: { $in: audienceFilter },
      startsAt: { $lte: now },
      $or: [{ endsAt: null }, { endsAt: { $gt: now } }],
      dismissedBy: { $ne: req.user.id || req.user._id }
    }).sort({ createdAt: -1 }).limit(20).lean();

    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/all', requireAdmin, async (req, res) => {
  try {
    const rows = await Announcement.find({ organizationId: req.user.organizationId })
      .sort({ createdAt: -1 }).limit(100).lean();
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { title, body, severity = 'info', audience = 'all', endsAt } = req.body;
    if (!title?.trim() || !body?.trim()) {
      return res.status(400).json({ success: false, message: 'Title and body required' });
    }
    const row = await Announcement.create({
      organizationId: req.user.organizationId,
      title: title.trim(),
      body: body.trim(),
      severity,
      audience,
      endsAt: endsAt ? new Date(endsAt) : undefined,
      createdBy: req.user.id || req.user._id
    });
    res.status(201).json({ success: true, data: row });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/dismiss', requireRecruiterOrAbove, async (req, res) => {
  try {
    await Announcement.updateOne(
      { _id: req.params.id, organizationId: req.user.organizationId },
      { $addToSet: { dismissedBy: req.user.id || req.user._id } }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await Announcement.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.user.organizationId },
      { $set: { isActive: false } }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
