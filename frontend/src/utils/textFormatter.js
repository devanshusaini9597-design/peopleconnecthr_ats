/**
 * Text formatting utilities for consistent data entry across the application
 * Handles trimming, capitalization, whitespace normalization, etc.
 */

/**
 * Capitalize first letter of each word (Title Case)
 * @param {string} text - Input text
 * @returns {string} - Formatted text
 */
export const capitalizeWords = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text
    .trim()
    .replace(/\s{2,}/g, ' ') // Replace multiple spaces with single space
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Trim and normalize whitespace (single space only)
 * @param {string} text - Input text
 * @returns {string} - Normalized text
 */
export const normalizeWhitespace = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text.trim().replace(/\s{2,}/g, ' ');
};

/**
 * Format name/title fields for live input (onChange) without trimming.
 * Allows spaces so user can type "Head Of India". Applies: single space only, first letter of each word capitalized.
 * Use this for name inputs in Manage Positions, Manage Clients, Manage Sources (add/edit).
 */
export const formatNameForInput = (value) => {
  if (value == null || typeof value !== 'string') return '';
  const singleSpace = value.replace(/\s{2,}/g, ' ');
  return singleSpace
    .split(' ')
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : ''))
    .join(' ');
};

/**
 * Format text field (trim + single spaces, optionally capitalize)
 * @param {string} text - Input text
 * @param {boolean} capitalize - Whether to capitalize first letter of each word
 * @returns {string} - Formatted text
 */
export const formatTextField = (text, capitalize = false) => {
  const normalized = normalizeWhitespace(text);
  return capitalize ? capitalizeWords(normalized) : normalized;
};

/**
 * Custom formatter that handles various field types
 * @param {string} fieldName - Name of the field being formatted
 * @param {string} value - Value to format
 * @returns {string} - Formatted value
 */
export const formatByFieldName = (fieldName, value) => {
  if (!value || typeof value !== 'string') return '';

  const normalized = normalizeWhitespace(value);

  // Fields that should be title-cased (capitalize first letter of each word, single space)
  const titleCaseFields = [
    'name',
    'location',
    'companyName',
    'company',
    'spoc',
    'client',
    'position',
    'venue',
    'city',
    'state',
    'country',
    'templateName',
    'description',
    'remark',
    'skills'
  ];

  // Fields that are email or should remain lowercase
  const noFormatFields = ['email', 'body', 'subject', 'note'];

  if (noFormatFields.includes(fieldName)) {
    return normalized.toLowerCase();
  }

  if (titleCaseFields.includes(fieldName)) {
    return capitalizeWords(normalized);
  }

  return normalized;
};

/**
 * Validate and format email address
 * @param {string} email - Email to validate and format
 * @returns {object} - { isValid: boolean, value: string, error?: string }
 */
export const formatEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return { isValid: false, value: '', error: 'Email is required' };
  }

  const normalized = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(normalized)) {
    return { isValid: false, value: normalized, error: 'Invalid email format' };
  }

  return { isValid: true, value: normalized };
};

/**
 * Validate and format phone number
 * @param {string} phone - Phone to validate and format
 * @param {string} countryCode - Country code like '+91', '+1'
 * @returns {object} - { isValid: boolean, value: string, error?: string }
 */
export const formatPhoneNumber = (phone, countryCode = '+91') => {
  if (!phone) {
    return { isValid: false, value: '', error: 'Phone is required' };
  }

  const digitsOnly = String(phone).replace(/\D/g, '');

  // Remove country code if accidentally typed in the contact field
  let cleanDigits = digitsOnly;
  if (countryCode === '+91' && digitsOnly.startsWith('91') && digitsOnly.length > 10) {
    cleanDigits = digitsOnly.slice(-10);
  } else if (countryCode === '+1' && digitsOnly.startsWith('1') && digitsOnly.length > 10) {
    cleanDigits = digitsOnly.slice(-10);
  } else if (digitsOnly.length > 11) {
    cleanDigits = digitsOnly.slice(-10);
  }

  let isValid = false;
  if (countryCode === '+91') {
    isValid = cleanDigits.length === 10;
  } else if (countryCode === '+1') {
    isValid = cleanDigits.length === 10;
  } else {
    isValid = cleanDigits.length >= 7 && cleanDigits.length <= 15;
  }

  return {
    isValid,
    value: cleanDigits,
    error: isValid ? undefined : 'Invalid phone number'
  };
};

/**
 * Format password - only basic trimming, no character changes
 * @param {string} password - Password
 * @returns {string} - Trimmed password
 */
export const formatPassword = (password) => {
  return password ? String(password).trim() : '';
};

/**
 * Format all form data at once
 * @param {object} formData - Form data object
 * @param {array} titleCaseFields - Fields to title case
 * @returns {object} - Formatted form data
 */
export const formatFormData = (formData, titleCaseFields = []) => {
  const formatted = {};

  Object.entries(formData).forEach(([key, value]) => {
    if (typeof value === 'string') {
      formatted[key] = formatByFieldName(key, value);
    } else {
      formatted[key] = value;
    }
  });

  return formatted;
};

export default {
  capitalizeWords,
  normalizeWhitespace,
  formatTextField,
  formatByFieldName,
  formatNameForInput,
  formatEmail,
  formatPhoneNumber,
  formatPassword,
  formatFormData
};
