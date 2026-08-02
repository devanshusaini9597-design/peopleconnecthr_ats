/**
 * Adapter Registry and Factory
 *
 * Factory function to get adapters based on organization integration configs.
 */
const mongoose = require('mongoose');
const { planHasFeature } = require('../config/planFeatures');

const emailAdapters = require('./emailAdapter');
const smsAdapter = require('./smsAdapter');
const calendarAdapter = require('./calendarAdapter');
const aiAdapter = require('./aiAdapter');
const jobBoardAdapter = require('./jobBoardAdapter');
const backgroundCheckAdapter = require('./backgroundCheckAdapter');
const esignAdapter = require('./esignAdapter');
const videoAdapter = require('./videoAdapter');
const storageAdapter = require('./storageAdapter');
const encryptionAdapter = require('./encryptionAdapter');
const crmAdapter = require('./crmAdapter');
const hrisAdapter = require('./hrisAdapter');
const siemAdapter = require('./siemAdapter');
const dataWarehouseAdapter = require('./dataWarehouseAdapter');

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

/**
 * Loads IntegrationConfig for the org+category, returns the appropriate adapter instance.
 */
const getAdapter = async (organizationId, category) => {
  try {
    const Organization = mongoose.model('Organization');
    const IntegrationConfig = mongoose.model('IntegrationConfig');

    const requiredFeature = CATEGORY_FEATURE[category];
    if (requiredFeature) {
      const org = await Organization.findById(organizationId).select('plan');
      if (!org || !planHasFeature(org.plan, requiredFeature)) {
        console.warn(`[adapters] Org ${organizationId} plan does not include '${requiredFeature}' — refusing to load '${category}' BYOK adapter.`);
        return null;
      }
    }

    const config = await IntegrationConfig.findOne({
      organizationId,
      category,
      isActive: true
    });

    if (!config) {
      return null;
    }

    const credentials = config.getDecryptedCredentials();
    const resolvedConfig = { provider: config.provider, credentials };

    switch (category) {
      case 'email':
        return emailAdapters.createEmailAdapter(resolvedConfig);
      case 'sms':
        return smsAdapter.createSmsAdapter(resolvedConfig);
      case 'calendar':
        return calendarAdapter.createCalendarAdapter(resolvedConfig);
      case 'ai':
        return aiAdapter.createAiAdapter(resolvedConfig);
      case 'job_board':
        return jobBoardAdapter.createJobBoardAdapter(resolvedConfig);
      case 'background_check':
        return backgroundCheckAdapter.createBackgroundCheckAdapter(resolvedConfig);
      case 'esign':
        return esignAdapter.createEsignAdapter(resolvedConfig);
      case 'whatsapp':
        return smsAdapter.createSmsAdapter(resolvedConfig);
      case 'video':
        return videoAdapter.createVideoAdapter(resolvedConfig);
      case 'storage':
        return storageAdapter.createStorageAdapter(resolvedConfig);
      case 'encryption':
        return encryptionAdapter.createEncryptionAdapter(resolvedConfig);
      case 'crm':
        return crmAdapter.createCrmAdapter(resolvedConfig);
      case 'hris':
        return hrisAdapter.createHrisAdapter(resolvedConfig);
      case 'siem':
        return siemAdapter.createSiemAdapter(resolvedConfig);
      case 'data_warehouse':
        return dataWarehouseAdapter.createDataWarehouseAdapter(resolvedConfig);
      default:
        console.warn(`Unknown adapter category requested: ${category}`);
        return null;
    }
  } catch (error) {
    console.error(`Error loading adapter for ${category}:`, error);
    return null;
  }
};

module.exports = {
  getAdapter
};
