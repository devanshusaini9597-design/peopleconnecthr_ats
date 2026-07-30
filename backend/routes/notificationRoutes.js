const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { scanAndNotify } = require('../services/notificationService');

/**
 * GET /api/notifications
 * Fetch user's notifications (unread + recent read)
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, limit = 50, page = 1 } = req.query;
    
    const filter = { userId, isDismissed: false, type: { $ne: 'system' } };
    
    if (status === 'unread') filter.isRead = false;
    else if (status === 'read') filter.isRead = true;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [notifications, totalCount, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ priority: 1, createdAt: -1 }) // urgent first, then newest
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ userId, isRead: false, isDismissed: false, type: { $ne: 'system' } })
    ]);
    
    // Custom sort: urgent > high > medium > low, then by createdAt desc
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    notifications.sort((a, b) => {
      const pDiff = (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3);
      if (pDiff !== 0) return pDiff;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    
    res.json({
      success: true,
      notifications,
      unreadCount,
      totalCount,
      page: parseInt(page),
      totalPages: Math.ceil(totalCount / parseInt(limit))
    });
  } catch (error) {
    console.error('Fetch notifications error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
});

/**
 * GET /api/notifications/count
 * Quick unread count for badge
 */
router.get('/count', async (req, res) => {
  try {
    const unreadCount = await Notification.countDocuments({
      userId: req.user.id,
      isRead: false,
      isDismissed: false,
      type: { $ne: 'system' }
    });
    
    // Count by priority
    const urgentCount = await Notification.countDocuments({
      userId: req.user.id,
      isRead: false,
      isDismissed: false,
      type: { $ne: 'system' },
      priority: { $in: ['urgent', 'high'] }
    });
    
    res.json({ success: true, unreadCount, urgentCount });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get count' });
  }
});

/**
 * GET /api/notifications/upcoming-callbacks
 * Get upcoming callbacks for dashboard widget
 */
router.get('/upcoming-callbacks', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get distinct candidates with upcoming callbacks from notifications
    const notifications = await Notification.find({
      userId,
      isDismissed: false,
      type: { $in: ['callback_reminder', 'callback_today', 'callback_overdue'] }
    })
      .sort({ daysRemaining: 1 })
      .lean();
    
    // Deduplicate by candidateId, keep the most urgent one
    const seen = new Map();
    for (const n of notifications) {
      const cid = n.candidateId?.toString();
      if (!cid) continue;
      if (!seen.has(cid) || (n.priority === 'urgent' && seen.get(cid).priority !== 'urgent')) {
        seen.set(cid, n);
      }
    }
    
    const callbacks = Array.from(seen.values())
      .sort((a, b) => (a.daysRemaining || 0) - (b.daysRemaining || 0))
      .slice(0, 10);
    
    res.json({ success: true, callbacks, total: seen.size });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch callbacks' });
  }
});

/**
 * PUT /api/notifications/:id/read
 * Mark a notification as read
 */
router.put('/:id/read', async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { isRead: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, notification });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update' });
  }
});

/**
 * PUT /api/notifications/read-all
 * Mark all as read
 */
router.put('/read-all', async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user.id, isRead: false },
      { isRead: true }
    );
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update' });
  }
});

/**
 * PUT /api/notifications/:id/dismiss
 * Dismiss a notification
 */
router.put('/:id/dismiss', async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { isDismissed: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to dismiss' });
  }
});

/**
 * DELETE /api/notifications/clear-all
 * Clear all read notifications
 */
router.delete('/clear-all', async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user.id, isRead: true },
      { isDismissed: true }
    );
    res.json({ success: true, message: 'Cleared all read notifications' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to clear' });
  }
});

/**
 * POST /api/notifications/trigger-scan
 * Manually trigger a scan (admin/debug use)
 */
router.post('/trigger-scan', async (req, res) => {
  try {
    await scanAndNotify();
    res.json({ success: true, message: 'Scan triggered successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Scan failed' });
  }
});

module.exports = router;
