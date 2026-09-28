const express = require('express');
const router = express.Router();
const { requireFeature } = require('../middleware/featureMiddleware');
const { runGlobalSearch, collectSearchAudience } = require('../services/globalSearchService');

router.use(requireFeature('search.global'));

router.post('/audience', async (req, res) => {
  try {
    const data = await collectSearchAudience(req, req.body || {});
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const statsOnly = String(req.query.stats || '') === '1';
    const q = String(req.query.q || '').trim();
    const location = String(req.query.location || '').trim();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const data = await runGlobalSearch(req, { q, location, filters: req.query || {}, page, limit, statsOnly });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
