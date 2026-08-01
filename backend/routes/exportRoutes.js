// backend/routes/exportRoutes.js
const express = require('express');
const router = express.Router();
const { exportReport, previewReport, shareReport } = require('../controller/exportController');
const { requireFeature } = require('../middleware/featureMiddleware');

router.post('/report', requireFeature('export.data'), exportReport);
router.post('/preview', requireFeature('export.data'), previewReport);
router.post('/share-report', requireFeature('export.data'), shareReport);

module.exports = router;
