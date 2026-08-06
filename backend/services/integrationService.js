/**
 * Integration (BYOK) config domain — CRUD + connection test.
 */
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

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

// Strips credentials from API responses — never echo secrets back, even masked.
function toSafeJson(doc) {
  const obj = doc.toObject ? doc.toObject() : doc;
  const { credentials, ...safe } = obj;
  return { ...safe, hasCredentials: !!credentials };
}

async function assertCategoryEntitlement(organizationId, category) {
  const requiredFeature = CATEGORY_FEATURE[category];
  if (!requiredFeature) return;

  const Organization = require('mongoose').model('Organization');
  const org = await Organization.findById(organizationId).select('plan');
  if (!org || !planHasFeature(org.plan, requiredFeature)) {
    throw httpError(
      `Your plan does not include the '${category}' integration category. Please upgrade to continue.`,
      403,
      { code: 'UPGRADE_REQUIRED', feature: requiredFeature }
    );
  }
}

async function listIntegrations(organizationId) {
  const configs = await IntegrationConfig.find({ organizationId }).sort({ category: 1, provider: 1 });
  return configs.map(toSafeJson);
}

async function upsertIntegration(organizationId, userId, body) {
  const { category, provider, displayName, credentials } = body;

  if (!category || !VALID_CATEGORIES.includes(category)) {
    throw httpError(`category must be one of: ${VALID_CATEGORIES.join(', ')}`, 400);
  }
  if (!provider) {
    throw httpError('provider is required', 400);
  }

  let config = await IntegrationConfig.findOne({ organizationId, provider });
  const isNew = !config;

  if (!config) {
    config = new IntegrationConfig({ organizationId, provider, category });
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
  config.configuredBy = config.configuredBy || userId;
  config.lastModifiedBy = userId;
  config.auditLog.push({
    action: isNew ? 'created' : 'updated',
    performedBy: userId,
    details: isNew ? 'Integration created' : 'Integration credentials/settings updated'
  });

  try {
    await config.save();
  } catch (error) {
    if (error.code === 11000) {
      throw httpError('An integration for this provider already exists for your organization', 400);
    }
    throw error;
  }

  eventBus.emit(isNew ? eventTypes.INTEGRATION_CONFIGURED : eventTypes.INTEGRATION_KEY_CHANGED, {
    organizationId,
    userId,
    resourceType: 'IntegrationConfig',
    resourceId: config._id,
    category,
    provider
  });

  return { isNew, data: toSafeJson(config) };
}

const TESTABLE_CATEGORIES = new Set([
  'email', 'sms', 'calendar', 'ai', 'job_board', 'background_check', 'esign',
  'whatsapp', 'video', 'storage', 'encryption', 'crm', 'hris', 'siem', 'data_warehouse'
]);

function createAdapterForConfig(config, credentials) {
  const resolvedConfig = { provider: config.provider, credentials };
  switch (config.category) {
    case 'email':
      return require('../adapters/emailAdapter').createEmailAdapter(resolvedConfig);
    case 'sms':
      return require('../adapters/smsAdapter').createSmsAdapter(resolvedConfig);
    case 'calendar':
      return require('../adapters/calendarAdapter').createCalendarAdapter(resolvedConfig);
    case 'ai':
      return require('../adapters/aiAdapter').createAiAdapter(resolvedConfig);
    case 'job_board':
      return require('../adapters/jobBoardAdapter').createJobBoardAdapter(resolvedConfig);
    case 'background_check':
      return require('../adapters/backgroundCheckAdapter').createBackgroundCheckAdapter(resolvedConfig);
    case 'esign':
      return require('../adapters/esignAdapter').createEsignAdapter(resolvedConfig);
    case 'whatsapp':
      return require('../adapters/smsAdapter').createSmsAdapter(resolvedConfig);
    case 'video':
      return require('../adapters/videoAdapter').createVideoAdapter(resolvedConfig);
    case 'storage':
      return require('../adapters/storageAdapter').createStorageAdapter(resolvedConfig);
    case 'encryption':
      return require('../adapters/encryptionAdapter').createEncryptionAdapter(resolvedConfig);
    case 'crm':
      return require('../adapters/crmAdapter').createCrmAdapter(resolvedConfig);
    case 'hris':
      return require('../adapters/hrisAdapter').createHrisAdapter(resolvedConfig);
    case 'siem':
      return require('../adapters/siemAdapter').createSiemAdapter(resolvedConfig);
    case 'data_warehouse':
      return require('../adapters/dataWarehouseAdapter').createDataWarehouseAdapter(resolvedConfig);
    default:
      return null;
  }
}

async function testIntegration(organizationId, id, userId) {
  try {
    const config = await IntegrationConfig.findOne({ _id: id, organizationId });
    if (!config) throw httpError('Integration not found', 404);

    if (!TESTABLE_CATEGORIES.has(config.category)) {
      throw httpError(`Test connection not yet implemented for category '${config.category}'`, 400);
    }

    const credentials = config.getDecryptedCredentials();
    const adapter = createAdapterForConfig(config, credentials);
    await adapter.testConnection();

    config.isValidated = true;
    config.lastValidatedAt = new Date();
    config.validationError = '';
    config.auditLog.push({ action: 'validated', performedBy: userId, details: 'Connection test succeeded' });
    await config.save();

    return { message: 'Connection test succeeded' };
  } catch (error) {
    // Preserve early-return shapes (404 / not-implemented) from the former route handler.
    if (error.statusCode) throw error;
    try {
      await IntegrationConfig.updateOne(
        { _id: id, organizationId },
        { $set: { isValidated: false, validationError: error.message } }
      );
    } catch (_) { /* best-effort */ }
    throw httpError(`Connection test failed: ${error.message}`, 400);
  }
}

async function setIntegrationActive(organizationId, id, userId, isActive) {
  const config = await IntegrationConfig.findOne({ _id: id, organizationId });
  if (!config) throw httpError('Integration not found', 404);

  config.isActive = !!isActive;
  config.auditLog.push({
    action: config.isActive ? 'activated' : 'deactivated',
    performedBy: userId
  });
  await config.save();
  return toSafeJson(config);
}

async function deleteIntegration(organizationId, id) {
  const result = await IntegrationConfig.findOneAndDelete({ _id: id, organizationId });
  if (!result) throw httpError('Integration not found', 404);
  return { message: 'Integration removed' };
}

module.exports = {
  VALID_CATEGORIES,
  CATEGORY_FEATURE,
  toSafeJson,
  assertCategoryEntitlement,
  listIntegrations,
  upsertIntegration,
  testIntegration,
  setIntegrationActive,
  deleteIntegration,
};
