/**
 * Dedicated reports studio — analytics.advanced / reports.custom
 */

const express = require('express');
const router = express.Router();
const Application = require('../models/Application');
const Candidate = require('../models/Candidate');
const Job = require('../models/Job');
const { requireFeature } = require('../middleware/featureMiddleware');

router.get('/pipeline', requireFeature('analytics.advanced'), async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const rows = await Application.aggregate([
      { $match: { organizationId: orgId, isRejected: { $ne: true } } },
      { $group: { _id: '$stage', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    res.json({ success: true, data: rows.map((r) => ({ stage: r._id || 'Unknown', count: r.count })) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/sources', requireFeature('analytics.advanced'), async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const rows = await Candidate.aggregate([
      { $match: { organizationId: orgId } },
      { $group: { _id: { $ifNull: ['$source', 'Unknown'] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);
    res.json({ success: true, data: rows.map((r) => ({ source: r._id, count: r.count })) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/time-to-hire', requireFeature('analytics.advanced'), async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const hired = await Application.find({
      organizationId: orgId,
      stage: { $in: ['Hired', 'Joined'] }
    }).select('createdAt updatedAt stageHistory jobId').populate('jobId', 'title').lean();

    const data = hired.map((a) => {
      const start = a.createdAt ? new Date(a.createdAt).getTime() : null;
      const end = a.updatedAt ? new Date(a.updatedAt).getTime() : null;
      const days = start && end ? Math.max(0, Math.round((end - start) / 86400000)) : null;
      return {
        jobTitle: a.jobId?.title || 'Job',
        days,
        applicationId: a._id
      };
    }).filter((d) => d.days != null);

    const avg = data.length
      ? Math.round(data.reduce((s, d) => s + d.days, 0) / data.length)
      : 0;

    res.json({ success: true, data: { averageDays: avg, samples: data.slice(0, 50) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/jobs-performance', requireFeature('reports.custom'), async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const jobs = await Job.find({ organizationId: orgId }).select('title status').lean();
    const counts = await Application.aggregate([
      { $match: { organizationId: orgId } },
      { $group: { _id: '$jobId', total: { $sum: 1 }, hired: { $sum: { $cond: [{ $in: ['$stage', ['Hired', 'Joined']] }, 1, 0] } } } }
    ]);
    const map = new Map(counts.map((c) => [String(c._id), c]));
    const data = jobs.map((j) => {
      const c = map.get(String(j._id)) || { total: 0, hired: 0 };
      return {
        jobId: j._id,
        title: j.title,
        status: j.status,
        applications: c.total,
        hired: c.hired,
        hireRate: c.total ? Math.round((c.hired / c.total) * 100) : 0
      };
    });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
