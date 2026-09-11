// backend/routes/analyticsRoutes.js
const express = require('express');
const router = express.Router();
const { getAnalytics, getDashboardStats, getDEIAnalytics, listAnalyticsEmployees } = require('../controller/analyticsController');
const { requireFeature } = require('../middleware/featureMiddleware');

router.get('/employees', requireFeature('analytics.basic'), listAnalyticsEmployees);

// Basic counts/funnel — included on every plan (Starter+)
router.get('/dashboard-stats', requireFeature('analytics.basic'), getDashboardStats);

// Source performance, time-to-hire, offer/joining ratios — Professional+ only
router.get('/charts', requireFeature('analytics.advanced'), getAnalytics);

// Diversity & Inclusion funnel breakdown — Add-on, Enterprise only
router.get('/dei', requireFeature('analytics.dei'), getDEIAnalytics);

module.exports = router;