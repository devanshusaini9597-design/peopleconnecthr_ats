// backend/routes/exportRoutes.js
const express = require('express');
const router = express.Router();
const { exportReport, previewReport, shareReport } = require('../controller/exportController');

router.post('/report', exportReport);
router.post('/preview', previewReport);
router.post('/share-report', shareReport);

module.exports = router;
