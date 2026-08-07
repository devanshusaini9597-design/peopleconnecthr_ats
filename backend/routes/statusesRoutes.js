const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const Organization = require('../models/Organization');

const DEFAULT_STATUSES = [
  'Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Joined', 'Rejected', 'Dropped',
];

/** Pipeline status labels for candidate forms (array of strings). */
router.get('/', verifyToken, async (req, res) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.json(DEFAULT_STATUSES);
    const org = await Organization.findById(orgId).select('atsSettings.pipelineStages').lean();
    const stages = org?.atsSettings?.pipelineStages;
    res.json(Array.isArray(stages) && stages.length ? stages : DEFAULT_STATUSES);
  } catch (err) {
    console.error('statuses error:', err);
    res.status(500).json({ message: 'Failed to load statuses' });
  }
});

module.exports = router;
