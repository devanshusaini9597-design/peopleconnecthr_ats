// backend/routes/analyticsRoutes.js
const express = require('express');
const router = express.Router();
const { getAnalytics, getDashboardStats } = require('../controller/analyticsController');
const { requireFeature } = require('../middleware/featureMiddleware');

// Basic counts/funnel — included on every plan (Starter+)
router.get('/dashboard-stats', requireFeature('analytics.basic'), getDashboardStats);

// Source performance, time-to-hire, offer/joining ratios — Professional+ only
router.get('/charts', requireFeature('analytics.advanced'), getAnalytics);

module.exports = router;