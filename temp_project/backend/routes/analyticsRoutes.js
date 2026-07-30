// backend/routes/analyticsRoutes.js
const express = require('express');
const router = express.Router();
const { getAnalytics, getDashboardStats } = require('../controller/analyticsController');

router.get('/dashboard-stats', getDashboardStats);
router.get('/charts', getAnalytics);

module.exports = router;