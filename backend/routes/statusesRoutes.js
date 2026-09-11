const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const Organization = require('../models/Organization');
const { isFreelancer } = require('../utils/dataScope');

const DEFAULT_STATUSES = [
  'APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'JOINED', 'REJECTED', 'DROPPED',
];

const toBlock = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').toUpperCase();

/** Pipeline status labels for candidate forms / freelancer view-only boards. */
router.get('/', verifyToken, async (req, res) => {
  try {
    const orgId = req.user?.organizationId;
    // Freelancers may read org stages for display (status is still company-locked).
    if (!orgId) return res.json(DEFAULT_STATUSES);
    const org = await Organization.findById(orgId).select('atsSettings.pipelineStages').lean();
    const stages = org?.atsSettings?.pipelineStages;
    const list = Array.isArray(stages) && stages.length ? stages : DEFAULT_STATUSES;
    // Forms store block letters; freelancers get title-case display labels for boards.
    if (isFreelancer(req.user)) {
      const { titleCaseStatus, canonCandidateStatus } = require('../utils/statusCanon');
      const out = list.map((s) => canonCandidateStatus(s) || titleCaseStatus(s)).filter(Boolean);
      const ensure = ['Rejected', 'Dropped'];
      for (const e of ensure) {
        if (!out.some((x) => String(x).toLowerCase() === e.toLowerCase())) out.push(e);
      }
      return res.json(out);
    }
    res.json(list.map(toBlock));
  } catch (err) {
    console.error('statuses error:', err);
    res.status(500).json({ message: 'Failed to load statuses' });
  }
});

module.exports = router;
