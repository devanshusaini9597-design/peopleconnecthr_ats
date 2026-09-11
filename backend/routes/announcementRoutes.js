const express = require('express');
const router = express.Router();
const Announcement = require('../models/Announcement');
const { requireFeature } = require('../middleware/featureMiddleware');
const { requireAdmin, requireRecruiterOrAbove, requireFreelancerOrRecruiter } = require('../middleware/rbacMiddleware');

router.use(requireFeature('announcements'));

function audienceFilterForRole(role) {
  // Freelancers only see notices explicitly targeted at freelancers (never "all" / company).
  if (role === 'freelancer') return ['freelancers'];
  const audienceFilter = ['all'];
  if (['owner', 'admin', 'hr_manager'].includes(role)) audienceFilter.push('admins');
  if (['owner', 'admin', 'hr_manager', 'hr_recruiter', 'recruiter', 'sales'].includes(role)) {
    audienceFilter.push('recruiters');
  }
  // Company admins also see freelancer-targeted notices in the manage feed via /all;
  // in-app banner for staff never includes freelancers-only.
  return audienceFilter;
}

function userIdOf(req) {
  return req.user.id || req.user._id;
}

/** Active + in audience + schedule window (endsAt optional — null means until deactivated) */
function activeAudienceFilter(req) {
  const now = new Date();
  return {
    organizationId: req.user.organizationId,
    isActive: true,
    audience: { $in: audienceFilterForRole(req.user.role) },
    startsAt: { $lte: now },
    $or: [{ endsAt: null }, { endsAt: { $exists: false } }, { endsAt: { $gt: now } }],
  };
}

/** In-app banner: hide only after user dismisses that banner */
function activeBannerFilter(req) {
  return {
    ...activeAudienceFilter(req),
    dismissedBy: { $ne: userIdOf(req) },
  };
}

/** Sidebar / dashboard badge: until user opens Announcements (seen) */
function activeUnreadFilter(req) {
  return {
    ...activeAudienceFilter(req),
    seenBy: { $ne: userIdOf(req) },
  };
}

/**
 * One-time soft migrate: older creates used a 24h endsAt default, so yesterday's
 * still-active notices vanished. Clear premature expiry so they stay until deactivated.
 */
let prematureExpiryMigrated = false;
async function clearPrematureExpiryOnce() {
  if (prematureExpiryMigrated) return;
  prematureExpiryMigrated = true;
  try {
    const now = new Date();
    const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    await Announcement.updateMany(
      {
        isActive: true,
        endsAt: { $ne: null, $lte: now },
        createdAt: { $gte: since },
      },
      { $set: { endsAt: null } }
    );
  } catch {
    prematureExpiryMigrated = false;
  }
}

router.use(async (_req, _res, next) => {
  clearPrematureExpiryOnce().finally(() => next());
});

router.get('/', async (req, res) => {
  try {
    const rows = await Announcement.find(activeBannerFilter(req))
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** Lightweight unread count for sidebar / dashboard badges */
router.get('/unread-count', async (req, res) => {
  try {
    const count = await Announcement.countDocuments(activeUnreadFilter(req));
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Team noticeboard inbox — all active notices for this role (including already-read).
 * Used by recruiters/sales so the page is a real board, not only undismissed banners.
 */
router.get('/inbox', async (req, res) => {
  try {
    const userId = String(userIdOf(req));
    const rows = await Announcement.find(activeAudienceFilter(req))
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const data = rows.map((row) => {
      const dismissed = (row.dismissedBy || []).some((id) => String(id) === userId);
      const seen = (row.seenBy || []).some((id) => String(id) === userId);
      return {
        ...row,
        dismissedBy: undefined,
        seenBy: undefined,
        isRead: seen,
        isDismissed: dismissed,
      };
    });

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Mark notices as seen (clears sidebar badge). Called when user opens Announcements.
 * Does not dismiss banners — banner X is separate.
 */
router.post('/mark-seen', requireFreelancerOrRecruiter, async (req, res) => {
  try {
    const userId = userIdOf(req);
    const result = await Announcement.updateMany(
      activeUnreadFilter(req),
      { $addToSet: { seenBy: userId } }
    );
    res.json({ success: true, modified: result.modifiedCount || 0 });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** Mark every active notice as read + hide banners for current user */
router.post('/dismiss-all', requireFreelancerOrRecruiter, async (req, res) => {
  try {
    const userId = userIdOf(req);
    const result = await Announcement.updateMany(
      activeAudienceFilter(req),
      { $addToSet: { dismissedBy: userId, seenBy: userId } }
    );
    res.json({ success: true, modified: result.modifiedCount || 0 });
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
    const { title, body, severity = 'info', audience = 'all', endsAt, notifyEmail = true } = req.body;
    if (!title?.trim() || !body?.trim()) {
      return res.status(400).json({ success: false, message: 'Title and body required' });
    }
    const allowedAudience = ['all', 'admins', 'recruiters', 'freelancers', 'public'];
    const safeAudience = allowedAudience.includes(audience) ? audience : 'all';
    const actorId = userIdOf(req);
    const row = await Announcement.create({
      organizationId: req.user.organizationId,
      title: title.trim(),
      body: body.trim(),
      severity,
      audience: safeAudience,
      endsAt: endsAt ? new Date(endsAt) : null,
      createdBy: actorId,
      seenBy: [actorId],
    });
    if (safeAudience !== 'public') {
      try {
        const { listAudienceUserIds, notifyMany } = require('../utils/reportingScope');
        const ids = await listAudienceUserIds(req.user.organizationId, safeAudience);
        await notifyMany(ids, {
          type: 'announcement',
          title: title.trim(),
          message: body.trim(),
          senderId: actorId,
          senderName: req.user.name || 'Company',
          priority: severity === 'critical' ? 'urgent' : severity === 'warning' ? 'high' : 'medium',
        }, { skipId: actorId });
      } catch { /* announcement still created */ }

      // Email is company-staff only. Freelancer-targeted notices are in-app only.
      if (notifyEmail !== false && safeAudience !== 'freelancers') {
        try {
          const { emailAnnouncementToAudience } = require('../services/announcementEmailService');
          emailAnnouncementToAudience({
            organizationId: req.user.organizationId,
            announcement: row,
            actorId,
            actorName: req.user.name || req.user.email || 'Leadership',
          }).catch(() => {});
        } catch { /* email optional */ }
      }
    }
    res.status(201).json({ success: true, data: row });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** Hide banner only — sidebar badge stays until Announcements is opened */
router.post('/:id/dismiss', requireFreelancerOrRecruiter, async (req, res) => {
  try {
    await Announcement.updateOne(
      { _id: req.params.id, organizationId: req.user.organizationId },
      { $addToSet: { dismissedBy: userIdOf(req) } }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** Mark a single notice as read (badge) */
router.post('/:id/seen', requireFreelancerOrRecruiter, async (req, res) => {
  try {
    await Announcement.updateOne(
      { _id: req.params.id, organizationId: req.user.organizationId },
      { $addToSet: { seenBy: userIdOf(req), dismissedBy: userIdOf(req) } }
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
    if (audience && ['all', 'admins', 'recruiters', 'freelancers', 'public'].includes(audience)) {
      update.audience = audience;
    }
    if (endsAt !== undefined) update.endsAt = endsAt ? new Date(endsAt) : null;
    if (typeof isActive === 'boolean') {
      update.isActive = isActive;
      if (isActive === true) update.endsAt = null;
    }

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
    const hard = String(req.query.hard || '') === '1';
    if (hard) {
      const result = await Announcement.deleteOne({
        _id: req.params.id,
        organizationId: req.user.organizationId,
      });
      if (!result.deletedCount) {
        return res.status(404).json({ success: false, message: 'Announcement not found' });
      }
      return res.json({ success: true, deleted: true });
    }

    const row = await Announcement.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.user.organizationId },
      { $set: { isActive: false } },
      { new: true }
    );
    if (!row) return res.status(404).json({ success: false, message: 'Announcement not found' });
    res.json({ success: true, deactivated: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
