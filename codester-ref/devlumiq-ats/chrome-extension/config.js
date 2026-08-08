// Configuration and constants for the Chrome Extension

export const CONFIG = {
  // API Endpoints
  API_VERSION: 'v1',
  
  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  
  // Rate limiting
  RATE_LIMIT_WINDOW: 60000, // 1 minute
  MAX_REQUESTS_PER_WINDOW: 10,
  
  // UI configuration
  BUTTON_SELECTOR: '.pv-top-card-v2-ctas',
  BUTTON_TEXT: {
    default: 'Import to ATS',
    importing: 'Importing...',
    success: 'Imported!',
    error: 'Failed',
    checking: 'Checking...'
  },
  
  // LinkedIn selectors (for profile extraction)
  SELECTORS: {
    name: 'h1',
    headline: '[data-generated-suggestion-target]',
    location: '.pv-top-card__list-bullet',
    experience: '#experience',
    skills: '#skills',
    about: '#about'
  },
  
  // Status colors for notifications
  COLORS: {
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6'
  }
};

export const MESSAGE_TYPES = {
  IMPORT_CANDIDATE: 'IMPORT_CANDIDATE',
  GET_SETTINGS: 'GET_SETTINGS',
  SAVE_SETTINGS: 'SAVE_SETTINGS',
  VALIDATE_SETTINGS: 'VALIDATE_SETTINGS',
  GET_CANDIDATE_STATUS: 'GET_CANDIDATE_STATUS',
  TRIGGER_IMPORT: 'TRIGGER_IMPORT',
  SHOW_NOTIFICATION: 'SHOW_NOTIFICATION'
};

export const EVENTS = {
  CANDIDATE_IMPORTED: 'CANDIDATE_IMPORTED',
  IMPORT_FAILED: 'IMPORT_FAILED',
  SETTINGS_CHANGED: 'SETTINGS_CHANGED',
  EXTENSION_ACTIVATED: 'EXTENSION_ACTIVATED'
};

// Error messages
export const ERRORS = {
  NO_SETTINGS: 'Please configure your ATS settings first',
  INVALID_URL: 'Please navigate to a LinkedIn profile page',
  NETWORK_ERROR: 'Network error. Please check your connection',
  API_ERROR: 'Failed to communicate with ATS',
  PARSE_ERROR: 'Could not extract profile data'
};
