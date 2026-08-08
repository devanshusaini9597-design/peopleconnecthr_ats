/**
 * API Key management (org admin side) — issuing/revoking keys for the
 * public REST API at /api/v1/public/*. See apiKeyMiddleware.js for how
 * these keys are verified, and publicApiRoutes.js for what they unlock.
 */
const express = require('express');
const router = express.Router();

const { verifyToken } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/rbacMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');
const { requireOrganization, tenantScope } = require('../middleware/tenantMiddleware');
const { planHasFeature } = require('../config/planFeatures');
const ApiKey = require('../models/ApiKey');
const Organization = require('../models/Organization');

router.use(verifyToken, requireOrganization, tenantScope, requireAdmin, requireFeature('integrations.webhooksReadOnly'));

router.get('/', async (req, res) => {
  try {
    const keys = await ApiKey.find({ organizationId: req.user.organizationId }).sort({ createdAt: -1 }).select('-keyHash');
    res.json({ success: true, data: keys });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, scopes = ['read'] } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Key name is required' });

    const org = await Organization.findById(req.user.organizationId).select('plan');
    const wantsWrite = scopes.includes('write');
    if (wantsWrite && !planHasFeature(org?.plan, 'integrations.webhooksFull')) {
      return res.status(403).json({ success: false, code: 'UPGRADE_REQUIRED', message: 'Write-scoped API keys require the Enterprise plan.' });
    }

    const { plaintext, keyHash, keyPrefix } = ApiKey.generate();
    const apiKey = await ApiKey.create({
      organizationId: req.user.organizationId,
      name: name.trim(),
      keyHash,
      keyPrefix,
      scopes: wantsWrite ? ['read', 'write'] : ['read'],
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      data: { ...apiKey.toObject(), keyHash: undefined },
      plaintextKey: plaintext // shown exactly once — the frontend must warn the user to copy it now
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { isActive } = req.body;
    const apiKey = await ApiKey.findOne({ _id: req.params.id, organizationId: req.user.organizationId });
    if (!apiKey) return res.status(404).json({ success: false, message: 'API key not found' });

    if (isActive !== undefined) apiKey.isActive = !!isActive;
    await apiKey.save();
    res.json({ success: true, data: { ...apiKey.toObject(), keyHash: undefined } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await ApiKey.deleteOne({ _id: req.params.id, organizationId: req.user.organizationId });
    if (result.deletedCount === 0) return res.status(404).json({ success: false, message: 'API key not found' });
    res.json({ success: true, message: 'API key revoked' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
