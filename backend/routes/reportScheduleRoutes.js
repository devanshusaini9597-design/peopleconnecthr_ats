/**
 * Scheduled/custom reports — Enterprise, gated by 'reports.custom'.
 * Runner lives in services/reportScheduler.js.
 */
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const { verifyToken } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/rbacMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');
const { requireOrganization, tenantScope } = require('../middleware/tenantMiddleware');
const ScheduledReport = require('../models/ScheduledReport');
const { REPORTS_DIR } = require('../services/reportScheduler');

// ── Public-ish download by token (no session auth — this IS the auth: the
// token is a 48-char random secret emailed only to the schedule's
// recipients, matching the existing pattern of shareable-link routes like
// SSO's ssoExchangeStore). Mounted separately below, before the
// verifyToken block, on purpose.
router.get('/download/:token', (req, res) => {
  try {
    const token = req.params.token;
    if (!/^[a-f0-9]{48}$/.test(token)) return res.status(400).send('Invalid download link');

    const files = fs.readdirSync(REPORTS_DIR).filter((f) => f.startsWith(`${token}__`));
    if (files.length === 0) return res.status(404).send('This download link has expired or does not exist.');

    const filePath = path.join(REPORTS_DIR, files[0]);
    const originalName = files[0].split('__').slice(1).join('__');
    res.download(filePath, originalName);
  } catch (error) {
    res.status(500).send('Failed to download report');
  }
});

router.use(verifyToken, requireOrganization, tenantScope, requireAdmin, requireFeature('reports.custom'));

router.get('/', async (req, res) => {
  try {
    const schedules = await ScheduledReport.find({ organizationId: req.user.organizationId }).sort({ createdAt: -1 });
    res.json({ success: true, data: schedules });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, reportType, format, dateRange, frequency, recipients } = req.body;
    if (!name || !reportType || !frequency) {
      return res.status(400).json({ success: false, message: 'name, reportType, and frequency are required' });
    }
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one recipient email is required' });
    }

    const schedule = await ScheduledReport.create({
      organizationId: req.user.organizationId,
      name: name.trim(),
      reportType,
      format: format === 'pdf' ? 'pdf' : 'xlsx',
      dateRange: dateRange || 'month',
      frequency,
      recipients,
      nextRunAt: new Date(), // runs on the next scheduler tick, then settles into its cadence
      createdBy: req.user.id
    });

    res.status(201).json({ success: true, data: schedule });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const schedule = await ScheduledReport.findOne({ _id: req.params.id, organizationId: req.user.organizationId });
    if (!schedule) return res.status(404).json({ success: false, message: 'Schedule not found' });

    const { name, dateRange, frequency, recipients, isActive } = req.body;
    if (name !== undefined) schedule.name = name.trim();
    if (dateRange !== undefined) schedule.dateRange = dateRange;
    if (frequency !== undefined) { schedule.frequency = frequency; schedule.nextRunAt = schedule.computeNextRun(schedule.lastRunAt || new Date()); }
    if (recipients !== undefined) schedule.recipients = recipients;
    if (isActive !== undefined) schedule.isActive = !!isActive;

    await schedule.save();
    res.json({ success: true, data: schedule });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await ScheduledReport.deleteOne({ _id: req.params.id, organizationId: req.user.organizationId });
    if (result.deletedCount === 0) return res.status(404).json({ success: false, message: 'Schedule not found' });
    res.json({ success: true, message: 'Schedule deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
