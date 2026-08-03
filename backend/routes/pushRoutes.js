const express = require('express');
const router = express.Router();
const PushSubscription = require('../models/PushSubscription');
const { requireFeature } = require('../middleware/featureMiddleware');

router.use(requireFeature('push.notifications'));

router.get('/vapid-public', (req, res) => {
  res.json({
    success: true,
    data: {
      publicKey: process.env.VAPID_PUBLIC_KEY || '',
      configured: !!process.env.VAPID_PUBLIC_KEY
    }
  });
});

router.post('/subscribe', async (req, res) => {
  try {
    const { endpoint, keys = {}, userAgent = '' } = req.body;
    if (!endpoint) return res.status(400).json({ success: false, message: 'endpoint required' });
    const row = await PushSubscription.findOneAndUpdate(
      { userId: req.user.id || req.user._id, endpoint },
      {
        $set: {
          organizationId: req.user.organizationId,
          keys: { p256dh: keys.p256dh || '', auth: keys.auth || '' },
          userAgent
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, data: { id: row._id } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/subscribe', async (req, res) => {
  try {
    await PushSubscription.deleteMany({
      userId: req.user.id || req.user._id,
      ...(req.body.endpoint ? { endpoint: req.body.endpoint } : {})
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
