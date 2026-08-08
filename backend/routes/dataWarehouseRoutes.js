/**
 * Data warehouse sync — push candidate/application rows to Snowflake/BigQuery/Redshift.
 * Enterprise: integrations.dataWarehouse
 */
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/rbacMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');
const { getAdapter } = require('../adapters');
const Candidate = require('../models/Candidate');
const Application = require('../models/Application');

router.post(
  '/sync',
  verifyToken,
  requireAdmin,
  requireFeature('integrations.dataWarehouse'),
  async (req, res) => {
    try {
      const adapter = await getAdapter(req.user.organizationId, 'data_warehouse');
      if (!adapter || typeof adapter.upsertRows !== 'function') {
        return res.status(503).json({
          success: false,
          message: 'Data warehouse integration is not configured.'
        });
      }

      const dataset = req.body.dataset || 'candidates';
      let rows = [];
      if (dataset === 'applications') {
        const apps = await Application.find({ organizationId: req.user.organizationId })
          .sort({ updatedAt: -1 })
          .limit(1000)
          .lean();
        rows = apps.map((a) => ({
          id: String(a._id),
          candidateId: String(a.candidateId),
          jobId: String(a.jobId),
          stage: a.stage,
          isHired: !!a.isHired,
          hiredAt: a.hiredAt,
          updatedAt: a.updatedAt
        }));
      } else {
        const candidates = await Candidate.find({ organizationId: req.user.organizationId })
          .sort({ updatedAt: -1 })
          .limit(1000)
          .lean();
        rows = candidates.map((c) => ({
          id: String(c._id),
          name: c.name,
          email: c.email,
          position: c.position,
          source: c.source,
          status: c.status,
          updatedAt: c.updatedAt
        }));
      }

      const result = await adapter.upsertRows({ table: req.body.table || dataset, rows });
      res.json({ success: true, count: rows.length, result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

module.exports = router;
