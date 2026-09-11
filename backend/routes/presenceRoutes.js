const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const svc = require('../services/presenceService');

router.use(verifyToken);

router.post('/heartbeat', async (req, res) => {
  try {
    const data = await svc.heartbeat(req.user);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Heartbeat failed' });
  }
});

router.get('/', async (req, res) => {
  try {
    const data = await svc.listOrgPresence(req.user);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Presence failed' });
  }
});

module.exports = router;
