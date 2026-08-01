// NOTE: not currently mounted in server.js — the legacy inline /jobs routes
// in server.js are what's actually live. Kept here, properly authenticated
// and tenant-scoped, in case this router is wired up in the future.
const express = require('express');
const router = express.Router();
const jobController = require('../controller/jobController');
const { verifyToken } = require('../middleware/authMiddleware');
const { requireRecruiterOrAbove } = require('../middleware/rbacMiddleware');

router.use(verifyToken);

router.post('/', requireRecruiterOrAbove, jobController.createJob);
router.get('/', jobController.getJobs);
router.delete('/:id', requireRecruiterOrAbove, jobController.deleteJob);

module.exports = router;