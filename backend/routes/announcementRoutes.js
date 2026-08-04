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
      audience: { $in: audienceFilter }, // never includes 'public' (careers site only)
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
    const allowedAudience = ['all', 'admins', 'recruiters', 'public'];
    const safeAudience = allowedAudience.includes(audience) ? audience : 'all';
    const row = await Announcement.create({
      organizationId: req.user.organizationId,
      title: title.trim(),
      body: body.trim(),
      severity,
      audience: safeAudience,
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

router.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const { title, body, severity, audience, endsAt, isActive } = req.body;
    const update = {};
    if (typeof title === 'string' && title.trim()) update.title = title.trim();
    if (typeof body === 'string' && body.trim()) update.body = body.trim();
    if (severity && ['info', 'success', 'warning', 'critical'].includes(severity)) {
      update.severity = severity;
    }
    if (audience && ['all', 'admins', 'recruiters', 'public'].includes(audience)) {
      update.audience = audience;
    }
    if (endsAt !== undefined) update.endsAt = endsAt ? new Date(endsAt) : null;
    if (typeof isActive === 'boolean') update.isActive = isActive;

    if (!Object.keys(update).length) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    const row = await Announcement.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.user.organizationId },
      { $set: update },
      { new: true }
    );
    if (!row) return res.status(404).json({ success: false, message: 'Announcement not found' });
    res.json({ success: true, data: row });
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
