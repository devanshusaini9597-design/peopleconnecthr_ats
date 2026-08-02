/**
 * Integration (BYOK) Config Routes
 *
 * CRUD + test-connection for per-org third-party integrations (email, SMS,
 * calendar, AI, job board, background check). Two independent gates apply:
 *  - RBAC: only owner/admin may view or change integration config.
 *  - Entitlement: the org's plan must include the requested category
 *    (mirrors the check in adapters/index.js so a Starter org can't
 *    self-configure a BYOK integration via direct API calls even if the
 *    frontend never shows the option).
 */

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/rbacMiddleware');
const { requireOrganization, tenantScope } = require('../middleware/tenantMiddleware');
const { planHasFeature } = require('../config/planFeatures');
const IntegrationConfig = require('../models/IntegrationConfig');
const eventBus = require('../events/eventBus');
const eventTypes = require('../events/eventTypes');

const VALID_CATEGORIES = [
  'email', 'calendar', 'sms', 'ai', 'job_board', 'background_check', 'esign', 'whatsapp',
  'video', 'storage', 'encryption', 'crm', 'hris', 'siem', 'data_warehouse', 'slack_app'
];

const CATEGORY_FEATURE = {
  email: 'integrations.byoEmail',
  calendar: 'integrations.calendar',
  sms: 'integrations.sms',
  job_board: 'integrations.jobBoard',
  background_check: 'integrations.backgroundCheck',
  ai: 'integrations.aiScoring',
  esign: 'integrations.esign',
  whatsapp: 'integrations.whatsapp',
  video: 'integrations.video',
  storage: 'integrations.storage',
  encryption: 'security.byokEncryption',
  crm: 'integrations.crm',
  hris: 'integrations.hris',
  siem: 'integrations.siem',
  data_warehouse: 'integrations.dataWarehouse',
  slack_app: 'integrations.slackApp'
};

const requireCategoryEntitlement = async (req, res, next) => {
  const category = req.body.category || req.params.category;
  const requiredFeature = CATEGORY_FEATURE[category];
  if (!requiredFeature) return next();

  const Organization = require('mongoose').model('Organization');
  const org = await Organization.findById(req.user.organizationId).select('plan');
  if (!org || !planHasFeature(org.plan, requiredFeature)) {
    return res.status(403).json({
      success: false,
      code: 'UPGRADE_REQUIRED',
      message: `Your plan does not include the '${category}' integration category. Please upgrade to continue.`,
      feature: requiredFeature
    });
  }
  next();
};

// Strips credentials from API responses — never echo secrets back, even masked.
const toSafeJson = (doc) => {
  const obj = doc.toObject ? doc.toObject() : doc;
  const { credentials, ...safe } = obj;
  return { ...safe, hasCredentials: !!credentials };
};

router.use(verifyToken, requireOrganization, tenantScope, requireAdmin);

/**
 * GET / — list all integration configs for this org (credentials never returned)
 */
router.get('/', async (req, res) => {
  try {
    const configs = await IntegrationConfig.find({ organizationId: req.user.organizationId }).sort({ category: 1, provider: 1 });
    res.json({ success: true, data: configs.map(toSafeJson) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST / — create or update an integration config (upsert by org+provider)
 * Body: { category, provider, displayName, credentials: {...} }
 */
router.post('/', requireCategoryEntitlement, async (req, res) => {
  try {
    const { category, provider, displayName, credentials } = req.body;

    if (!category || !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, message: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });
    }
    if (!provider) {
      return res.status(400).json({ success: false, message: 'provider is required' });
    }

    let config = await IntegrationConfig.findOne({ organizationId: req.user.organizationId, provider });
    const isNew = !config;

    if (!config) {
      config = new IntegrationConfig({ organizationId: req.user.organizationId, provider, category });
    }

    config.category = category;
    if (displayName !== undefined) config.displayName = displayName;
    if (credentials !== undefined) {
      config.credentials = credentials; // encrypted automatically by pre-save hook
      config.isValidated = false; // must re-test after credentials change
      if (category === 'slack_app' && credentials.teamId) {
        config.metadata = { ...(config.metadata || {}), teamId: credentials.teamId };
      }
    }
    config.configuredBy = config.configuredBy || req.user.id;
    config.lastModifiedBy = req.user.id;
    config.auditLog.push({
      action: isNew ? 'created' : 'updated',
      performedBy: req.user.id,
      details: isNew ? 'Integration created' : 'Integration credentials/settings updated'
    });

    await config.save();

    eventBus.emit(isNew ? eventTypes.INTEGRATION_CONFIGURED : eventTypes.INTEGRATION_KEY_CHANGED, {
      organizationId: req.user.organizationId,
      userId: req.user.id,
      resourceType: 'IntegrationConfig',
      resourceId: config._id,
      category,
      provider
    });

    res.status(isNew ? 201 : 200).json({ success: true, data: toSafeJson(config) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'An integration for this provider already exists for your organization' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /:id/test — validate stored credentials by calling the provider
 */
router.post('/:id/test', async (req, res) => {
  try {
    const config = await IntegrationConfig.findOne({ _id: req.params.id, organizationId: req.user.organizationId });
    if (!config) return res.status(404).json({ success: false, message: 'Integration not found' });

    const credentials = config.getDecryptedCredentials();
    const resolvedConfig = { provider: config.provider, credentials };
    let adapter;
    switch (config.category) {
      case 'email':
        adapter = require('../adapters/emailAdapter').createEmailAdapter(resolvedConfig);
        break;
      case 'sms':
        adapter = require('../adapters/smsAdapter').createSmsAdapter(resolvedConfig);
        break;
      case 'calendar':
        adapter = require('../adapters/calendarAdapter').createCalendarAdapter(resolvedConfig);
        break;
      case 'ai':
        adapter = require('../adapters/aiAdapter').createAiAdapter(resolvedConfig);
        break;
      case 'job_board':
        adapter = require('../adapters/jobBoardAdapter').createJobBoardAdapter(resolvedConfig);
        break;
      case 'background_check':
        adapter = require('../adapters/backgroundCheckAdapter').createBackgroundCheckAdapter(resolvedConfig);
        break;
      case 'esign':
        adapter = require('../adapters/esignAdapter').createEsignAdapter(resolvedConfig);
        break;
      case 'whatsapp':
        adapter = require('../adapters/smsAdapter').createSmsAdapter(resolvedConfig);
        break;
      case 'video':
        adapter = require('../adapters/videoAdapter').createVideoAdapter(resolvedConfig);
        break;
      case 'storage':
        adapter = require('../adapters/storageAdapter').createStorageAdapter(resolvedConfig);
        break;
      case 'encryption':
        adapter = require('../adapters/encryptionAdapter').createEncryptionAdapter(resolvedConfig);
        break;
      case 'crm':
        adapter = require('../adapters/crmAdapter').createCrmAdapter(resolvedConfig);
        break;
      case 'hris':
        adapter = require('../adapters/hrisAdapter').createHrisAdapter(resolvedConfig);
        break;
      case 'siem':
        adapter = require('../adapters/siemAdapter').createSiemAdapter(resolvedConfig);
        break;
      case 'data_warehouse':
        adapter = require('../adapters/dataWarehouseAdapter').createDataWarehouseAdapter(resolvedConfig);
        break;
      default:
        return res.status(400).json({ success: false, message: `Test connection not yet implemented for category '${config.category}'` });
    }

    await adapter.testConnection();

    config.isValidated = true;
    config.lastValidatedAt = new Date();
    config.validationError = '';
    config.auditLog.push({ action: 'validated', performedBy: req.user.id, details: 'Connection test succeeded' });
    await config.save();

    res.json({ success: true, message: 'Connection test succeeded' });
  } catch (error) {
    try {
      await IntegrationConfig.updateOne(
        { _id: req.params.id, organizationId: req.user.organizationId },
        { $set: { isValidated: false, validationError: error.message } }
      );
    } catch (_) { /* best-effort */ }
    res.status(400).json({ success: false, message: `Connection test failed: ${error.message}` });
  }
});

/**
 * PUT /:id/activate — set isActive true/false
 */
router.put('/:id/activate', async (req, res) => {
  try {
    const { isActive } = req.body;
    const config = await IntegrationConfig.findOne({ _id: req.params.id, organizationId: req.user.organizationId });
    if (!config) return res.status(404).json({ success: false, message: 'Integration not found' });

    config.isActive = !!isActive;
    config.auditLog.push({
      action: config.isActive ? 'activated' : 'deactivated',
      performedBy: req.user.id
    });
    await config.save();
    res.json({ success: true, data: toSafeJson(config) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * DELETE /:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const result = await IntegrationConfig.findOneAndDelete({ _id: req.params.id, organizationId: req.user.organizationId });
    if (!result) return res.status(404).json({ success: false, message: 'Integration not found' });
    res.json({ success: true, message: 'Integration removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
