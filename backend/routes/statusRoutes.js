/**
 * Public status page + admin incident management.
 * NOT plan-gated — available to everyone.
 */
const express = require('express');
const router = express.Router();
const StatusIncident = require('../models/StatusIncident');
const { verifyToken } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/rbacMiddleware');

const computeOverallStatus = (incidents) => {
  const active = incidents.filter((i) => i.status !== 'resolved');
  if (!active.length) return { status: 'operational', label: 'All systems operational' };
  const critical = active.some((i) => i.impact === 'critical' || i.impact === 'major');
  if (critical) return { status: 'major_outage', label: 'Major outage' };
  return { status: 'degraded', label: 'Degraded performance' };
};

/** GET / — current status + active incidents */
router.get('/', async (req, res) => {
  try {
    const active = await StatusIncident.find({ status: { $ne: 'resolved' } })
      .sort({ startedAt: -1 })
      .select('-createdBy')
      .lean();
    const overall = computeOverallStatus(active);
    res.json({ success: true, data: { overall, activeIncidents: active } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** GET /history — resolved incidents (last 90 days) */
router.get('/history', async (req, res) => {
  try {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const history = await StatusIncident.find({
      status: 'resolved',
      resolvedAt: { $gte: since }
    })
      .sort({ resolvedAt: -1 })
      .limit(50)
      .select('-createdBy')
      .lean();
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** POST /incidents — admin create incident (platform ops) */
router.post('/incidents', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { title, description, status, impact, affectedComponents } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'title is required' });

    const incident = new StatusIncident({
      title,
      description: description || '',
      status: status || 'investigating',
      impact: impact || 'minor',
      affectedComponents: affectedComponents || [],
      createdBy: req.user.id,
      updates: [{ message: description || 'Incident opened', status: status || 'investigating' }]
    });
    await incident.save();
    res.status(201).json({ success: true, data: incident });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** PATCH /incidents/:id — admin update incident */
router.patch('/incidents/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const incident = await StatusIncident.findById(req.params.id);
    if (!incident) return res.status(404).json({ success: false, message: 'Incident not found' });

    const { title, description, status, impact, updateMessage } = req.body;
    if (title) incident.title = title;
    if (description !== undefined) incident.description = description;
    if (impact) incident.impact = impact;
    if (status) {
      incident.status = status;
      if (status === 'resolved' && !incident.resolvedAt) incident.resolvedAt = new Date();
    }
    if (updateMessage) {
      incident.updates.push({ message: updateMessage, status: status || incident.status });
    }
    await incident.save();
    res.json({ success: true, data: incident });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
