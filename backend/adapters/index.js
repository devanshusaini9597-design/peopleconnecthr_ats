/**
 * Adapter Registry and Factory
 * 
 * Factory function to get adapters based on organization integration configs.
 */
const mongoose = require('mongoose');
const { planHasFeature } = require('../config/planFeatures');

// Import Adapters (lazy loaded or stubs)
const emailAdapters = require('./emailAdapter');
const smsAdapter = require('./smsAdapter');
const calendarAdapter = require('./calendarAdapter');
const aiAdapter = require('./aiAdapter');
const jobBoardAdapter = require('./jobBoardAdapter');
const backgroundCheckAdapter = require('./backgroundCheckAdapter');
const esignAdapter = require('./esignAdapter');

// Which plan-entitlement gates a BYOK category. If an org's plan doesn't
// include the feature, getAdapter() returns null even if an IntegrationConfig
// document exists — this closes the gap where a Starter org that finds the
// IntegrationConfig endpoint directly could self-configure and use an
// integration they were never sold. UI hiding alone is not enough.
const CATEGORY_FEATURE = {
  email: 'integrations.byoEmail',
  calendar: 'integrations.calendar',
  sms: 'integrations.sms',
  job_board: 'integrations.jobBoard',
  background_check: 'integrations.backgroundCheck',
  ai: 'integrations.aiScoring',
  esign: 'integrations.esign'
};

/**
 * Loads IntegrationConfig for the org+category, returns the appropriate adapter instance.
 * Enforces plan entitlement: a non-default (BYOK) adapter is only returned if
 * the org's current plan includes that integration category.
 * @param {string} organizationId The organization ID
 * @param {string} category The category of integration (e.g., 'email', 'sms', 'calendar', 'ai')
 * @returns {Object|null} The adapter instance or null if not configured / not entitled
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

    // Find active integration config for the given org and category
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
