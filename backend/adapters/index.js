/**
 * Adapter Registry and Factory
 * 
 * Factory function to get adapters based on organization integration configs.
 */
const mongoose = require('mongoose');

// Import Adapters (lazy loaded or stubs)
const emailAdapters = require('./emailAdapter');
const smsAdapter = require('./smsAdapter');
const calendarAdapter = require('./calendarAdapter');
const aiAdapter = require('./aiAdapter');

/**
 * Loads IntegrationConfig for the org+category, returns the appropriate adapter instance.
 * @param {string} organizationId The organization ID
 * @param {string} category The category of integration (e.g., 'email', 'sms', 'calendar', 'ai')
 * @returns {Object|null} The adapter instance or null if not configured
 */
const getAdapter = async (organizationId, category) => {
  try {
    const IntegrationConfig = mongoose.model('IntegrationConfig');
    
    // Find active integration config for the given org and category
    const config = await IntegrationConfig.findOne({
      organizationId,
      category,
      isActive: true
    });

    if (!config) {
      return null;
    }

    switch (category) {
      case 'email':
        return emailAdapters.createEmailAdapter(config);
      case 'sms':
        return smsAdapter;
      case 'calendar':
        return calendarAdapter;
      case 'ai':
        return aiAdapter;
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
