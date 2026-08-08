/**
 * Normalize text: Title Case + collapse multiple spaces into one + trim
 * Use for all text fields EXCEPT email addresses
 * Example: "  skillnix  technologies " → "Skillnix Technologies"
 */
const normalizeText = (str) => {
  if (!str || typeof str !== 'string') return str || '';
  return str.trim().replace(/\s+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
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
