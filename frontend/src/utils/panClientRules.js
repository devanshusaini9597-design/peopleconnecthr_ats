/** PAN helpers — required when the selected client has requiresPan enabled. */

export const PAN_INFO_TITLE = 'PAN number required';
export const PAN_INFO_MESSAGE =
  'PAN card is mandatory for this client. Only clients marked as “PAN required” in Manage Clients need a PAN number — please enter a valid PAN before saving.';

export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export function normalizePan(value) {
  return String(value || '').replace(/\s+/g, '').toUpperCase();
}

/** True when the selected client name matches a master client with requiresPan. */
export function clientRequiresPan(clientName, clients = []) {
  const n = String(clientName || '').trim().toUpperCase();
  if (!n) return false;
  const match = (clients || []).find(
    (c) => String(c?.name || '').trim().toUpperCase() === n
  );
  return !!(match && match.requiresPan);
}

/** @returns {string} error message or empty string when valid */
export function validatePan(value, { required = false } = {}) {
  const pan = normalizePan(value);
  if (!pan) return required ? 'PAN number is required for this client' : '';
  if (!PAN_REGEX.test(pan)) return 'Enter a valid PAN (e.g. ABCDE1234F)';
  return '';
}
