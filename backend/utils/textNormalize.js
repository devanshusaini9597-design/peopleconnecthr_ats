/**
 * Normalize text: BLOCK LETTERS (ALL CAPS) + collapse spaces + trim
 * Use for all text fields EXCEPT email addresses
 */
const normalizeText = (str) => {
  if (!str || typeof str !== 'string') return str || '';
  return str.trim().replace(/\s+/g, ' ').toUpperCase();
};

/**
 * Escape special regex characters in a string for use in RegExp
 * Prevents "Server error" when name contains . [ ] ( ) etc.
 */
const escapeRegex = (str) => {
  if (str == null || typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

module.exports = { normalizeText, escapeRegex };
