/**
 * Notification routes — thin wrappers; domain logic in notificationService.
 */
const express = require('express');
const router = express.Router();
const {
  listNotifications,
  getNotificationCounts,
  getUpcomingCallbacks,
  completeCallback,
  snoozeCallback,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
  clearReadNotifications,
  triggerNotificationScan,
  getReportShareUnreadCount,
  markReportSharesSeen,
} = require('../services/notificationService');
const prefsSvc = require('../services/notificationPreferencesService');

function handle(res, error) {
  const status = error.statusCode || 500;
  return res.status(status).json({ success: false, message: error.message });
}

router.get('/preferences', async (req, res) => {
  try {
    const data = await prefsSvc.getPreferences(req.user.id);
    res.json({ success: true, ...data });
  } catch (error) {
    handle(res, error);
  }
});

router.put('/preferences', async (req, res) => {
  try {
    const data = await prefsSvc.updatePreferences(req.user.id, req.body?.preferences || req.body);
    res.json({ success: true, message: 'Notification preferences saved', ...data });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/', async (req, res) => {
  try {
    const data = await listNotifications(req.user.id, req.query);
    res.json({ success: true, ...data });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/count', async (req, res) => {
  try {
    const data = await getNotificationCounts(req.user.id);
    res.json({ success: true, ...data });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/report-shares/unread-count', async (req, res) => {
  try {
    const data = await getReportShareUnreadCount(req.user.id);
    res.json({ success: true, ...data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/report-shares/mark-seen', async (req, res) => {
  try {
    const data = await markReportSharesSeen(req.user.id);
    res.json({ success: true, ...data });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/upcoming-callbacks', async (req, res) => {
  try {
    const data = await getUpcomingCallbacks(req.user);
    res.json({ success: true, ...data });
  } catch (error) {
    handle(res, error);
  }
});

router.put('/upcoming-callbacks/:candidateId/complete', async (req, res) => {
  try {
    const data = await completeCallback(req, req.params.candidateId);
    res.json({ success: true, message: 'Callback marked done', ...data });
  } catch (error) {
    handle(res, error);
  }
});

router.put('/upcoming-callbacks/:candidateId/snooze', async (req, res) => {
  try {
    const days = req.body?.days ?? req.query?.days;
    const data = await snoozeCallback(req, req.params.candidateId, days);
    res.json({ success: true, message: `Callback snoozed ${data.callBackDate}`, ...data });
  } catch (error) {
    handle(res, error);
  }
});

router.put('/:id/read', async (req, res) => {
  try {
    const notification = await markNotificationRead(req.user.id, req.params.id);
    res.json({ success: true, notification });
  } catch (error) {
    handle(res, error);
  }
});

router.put('/read-all', async (req, res) => {
  try {
    await markAllNotificationsRead(req.user.id);
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    handle(res, error);
  }
});

router.put('/:id/dismiss', async (req, res) => {
  try {
    await dismissNotification(req.user.id, req.params.id);
    res.json({ success: true });
  } catch (error) {
    handle(res, error);
  }
});

router.delete('/clear-all', async (req, res) => {
  try {
    await clearReadNotifications(req.user.id);
    res.json({ success: true, message: 'Cleared all read notifications' });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/trigger-scan', async (req, res) => {
  try {
    await triggerNotificationScan();
    res.json({ success: true, message: 'Scan triggered successfully' });
  } catch (error) {
    handle(res, error);
  }
});

module.exports = router;
