/**
 * Normalize text: BLOCK LETTERS (ALL CAPS) + collapse spaces + trim
 * Use for all text fields EXCEPT email addresses
 */
const normalizeText = (str) => {
  if (str == null) return '';
  if (typeof str !== 'string') return String(str).trim().replace(/\s+/g, ' ').toUpperCase();
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

/** Candidate string fields stored in block letters (never email / resume URLs / resumeText). */
const BLOCK_LETTER_FIELDS = [
  'name',
  'position',
  'location',
  'state',
  'companyName',
  'experience',
  'ctc',
  'expectedCtc',
  'noticePeriod',
  'skills',
  'product',
  'client',
  'spoc',
  'source',
  'fls',
  'feedback',
  'remark',
  'status',
  'contact',
  'phone',
  'callBackDate',
  'date',
  'srNo',
];

function applyBlockLettersToObject(obj, { skipEmpty = true } = {}) {
  if (!obj || typeof obj !== 'object') return obj;
  for (const field of BLOCK_LETTER_FIELDS) {
    const val = obj[field];
    if (val == null) continue;
    if (typeof val !== 'string') continue;
    if (skipEmpty && !val.trim()) continue;
    obj[field] = normalizeText(val);
  }
  if (typeof obj.pan === 'string' && obj.pan.trim()) {
    obj.pan = obj.pan.replace(/\s+/g, '').toUpperCase();
  }
  if (typeof obj.email === 'string' && obj.email) {
    obj.email = obj.email.trim().toLowerCase();
  }
  if (Array.isArray(obj.tags)) {
    obj.tags = obj.tags.map((t) => (typeof t === 'string' ? normalizeText(t) : t));
  }
  return obj;
}

module.exports = {
  normalizeText,
  escapeRegex,
  BLOCK_LETTER_FIELDS,
  applyBlockLettersToObject,
};
