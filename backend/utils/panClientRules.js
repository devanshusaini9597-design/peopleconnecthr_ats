/**
 * PAN rules for ATS candidates — required only when the selected Client
 * has requiresPan: true (set in Manage Clients).
 */
const Client = require('../models/Client');
const { escapeRegex } = require('./textNormalize');

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

function normalizePan(value) {
  return String(value || '').replace(/\s+/g, '').toUpperCase();
}

async function clientRequiresPan(clientName, scope = {}) {
  const n = String(clientName || '').trim();
  if (!n) return false;
  const filter = {
    ...scope,
    name: { $regex: new RegExp(`^${escapeRegex(n)}$`, 'i') },
    isActive: { $ne: false },
  };
  const client = await Client.findOne(filter).select('requiresPan').lean();
  return !!client?.requiresPan;
}

/**
 * @returns {Promise<string|null>} error message or null when valid
 */
async function validatePanForClient(pan, clientName, scope = {}) {
  const required = await clientRequiresPan(clientName, scope);
  const normalized = normalizePan(pan);
  if (!normalized) {
    return required ? 'PAN number is required for this client' : null;
  }
  if (!PAN_REGEX.test(normalized)) {
    return 'Enter a valid PAN (e.g. ABCDE1234F)';
  }
  return null;
}

module.exports = {
  normalizePan,
  clientRequiresPan,
  validatePanForClient,
};
