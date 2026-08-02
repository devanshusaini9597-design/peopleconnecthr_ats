/**
 * Compliance routes — retention policy, legal hold, bulk erase, purge.
 */
const express = require('express');
const router = express.Router();

const { verifyToken } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/rbacMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');
const { requireOrganization, tenantScope } = require('../middleware/tenantMiddleware');
const Organization = require('../models/Organization');
const Candidate = require('../models/Candidate');
const Application = require('../models/Application');
const { purgeExpiredCandidates, purgeAllOrganizations } = require('../services/complianceService');

router.use(verifyToken, requireOrganization, tenantScope, requireAdmin);

router.get('/retention', requireFeature('compliance.retentionPolicy'), async (req, res) => {
  try {
    const org = await Organization.findById(req.user.organizationId).select('complianceSettings');
    if (!org) return res.status(404).json({ success: false, message: 'Organization not found' });

    const settings = org.complianceSettings || {};
    const retentionDaysByRegion = settings.retentionDaysByRegion
      ? Object.fromEntries(settings.retentionDaysByRegion)
      : {};

    res.json({
      success: true,
      data: {
        defaultRetentionDays: settings.defaultRetentionDays ?? 730,
        retentionDaysByRegion,
        legalHoldEnabled: settings.legalHoldEnabled ?? false
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/retention', requireFeature('compliance.retentionPolicy'), async (req, res) => {
  try {
    const { defaultRetentionDays, retentionDaysByRegion } = req.body;
    const org = await Organization.findById(req.user.organizationId);
    if (!org) return res.status(404).json({ success: false, message: 'Organization not found' });

    if (defaultRetentionDays !== undefined) {
      const days = parseInt(defaultRetentionDays, 10);
      if (Number.isNaN(days) || days < 30 || days > 3650) {
        return res.status(400).json({ success: false, message: 'defaultRetentionDays must be between 30 and 3650' });
      }
      org.complianceSettings.defaultRetentionDays = days;
    }

    if (retentionDaysByRegion !== undefined) {
      if (typeof retentionDaysByRegion !== 'object' || Array.isArray(retentionDaysByRegion)) {
        return res.status(400).json({ success: false, message: 'retentionDaysByRegion must be an object' });
      }
      org.complianceSettings.retentionDaysByRegion = new Map(
        Object.entries(retentionDaysByRegion).map(([k, v]) => [k, parseInt(v, 10)])
      );
    }

    await org.save();
    res.json({ success: true, data: org.complianceSettings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/legal-hold', requireFeature('compliance.legalHold'), async (req, res) => {
  try {
    const { enabled, candidateIds } = req.body;
    const org = await Organization.findById(req.user.organizationId);
    if (!org) return res.status(404).json({ success: false, message: 'Organization not found' });

    if (enabled !== undefined) {
      org.complianceSettings.legalHoldEnabled = !!enabled;
      await org.save();
    }

    if (Array.isArray(candidateIds) && candidateIds.length) {
      await Candidate.updateMany(
        { _id: { $in: candidateIds }, organizationId: req.user.organizationId },
        { $set: { legalHold: true } }
      );
    }

    res.json({
      success: true,
      data: {
        legalHoldEnabled: org.complianceSettings.legalHoldEnabled
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/bulk-erase', requireFeature('compliance.retentionPolicy'), async (req, res) => {
  try {
    const { candidateIds } = req.body;
    if (!Array.isArray(candidateIds) || !candidateIds.length) {
      return res.status(400).json({ success: false, message: 'candidateIds array is required' });
    }

    const org = await Organization.findById(req.user.organizationId).select('complianceSettings');
    if (org?.complianceSettings?.legalHoldEnabled) {
      return res.status(403).json({
        success: false,
        code: 'LEGAL_HOLD',
        message: 'Organization-wide legal hold is active. Bulk erase is blocked.'
      });
    }

    const candidates = await Candidate.find({
      _id: { $in: candidateIds },
      organizationId: req.user.organizationId,
      legalHold: { $ne: true }
    }).select('_id');

    const ids = candidates.map((c) => c._id);
    const skipped = candidateIds.length - ids.length;

    if (ids.length) {
      await Application.deleteMany({ candidateId: { $in: ids } });
      await Candidate.updateMany(
        { _id: { $in: ids } },
        { $set: { gdprErasedAt: new Date(), name: '[Erased]', email: `erased-${Date.now()}@removed.local`, resume: '', resumeText: '' } }
      );
    }

    res.json({
      success: true,
      data: { erased: ids.length, skippedLegalHold: skipped }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/purge', requireFeature('compliance.retentionPolicy'), async (req, res) => {
  try {
    const { allOrganizations } = req.body;
    if (allOrganizations && req.user.role !== 'owner') {
      return res.status(403).json({ success: false, message: 'Only owners can purge all organizations' });
    }

    if (allOrganizations) {
      const summary = await purgeAllOrganizations();
      return res.json({ success: true, data: { summary } });
    }

    const result = await purgeExpiredCandidates(req.user.organizationId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
