/**
 * Per-user ATS desk defaults (enterprise: admin + employee).
 * Locked fields can only be changed by owner/admin/hr_manager.
 */

const { normalizeText } = require('./textNormalize');

const DESK_FIELDS = ['fls', 'client', 'source', 'product', 'location'];
const FLS_VALUES = new Set(['FLS', 'NON-FLS']);
const ADMIN_ROLES = new Set(['owner', 'admin', 'hr_manager']);

function canAdminSetDeskDefaults(user) {
  return Boolean(user && ADMIN_ROLES.has(user.role));
}

function normalizeFls(value) {
  const key = String(value || '')
    .trim()
    .replace(/[_]+/g, '-')
    .replace(/\s+/g, '-')
    .toUpperCase();
  if (!key) return '';
  if (key === 'FLS' || key === 'NON-FLS' || key === 'NONFLS') {
    return key === 'NONFLS' ? 'NON-FLS' : key === 'NON-FLS' ? 'NON-FLS' : 'FLS';
  }
  if (FLS_VALUES.has(key)) return key;
  return '';
}

function normalizeDeskField(key, value) {
  if (key === 'fls') return normalizeFls(value);
  const raw = String(value || '').trim();
  if (!raw) return '';
  return normalizeText(raw);
}

function emptyDeskDefaults() {
  return {
    fls: '',
    client: '',
    source: '',
    product: '',
    location: '',
    locked: { fls: false, client: false, source: false, product: false, location: false },
    setupCompletedAt: null,
  };
}

function sanitizeDeskDefaults(input = {}, { asAdmin = false, previous = null } = {}) {
  const prev = previous && typeof previous === 'object' ? previous : emptyDeskDefaults();
  const prevLocked = prev.locked && typeof prev.locked === 'object' ? prev.locked : {};
  const next = emptyDeskDefaults();
  next.setupCompletedAt = prev.setupCompletedAt || null;

  const incomingLocked = input.locked && typeof input.locked === 'object' ? input.locked : {};

  for (const key of DESK_FIELDS) {
    const locked = asAdmin
      ? Boolean(incomingLocked[key] ?? prevLocked[key])
      : Boolean(prevLocked[key]);

    next.locked[key] = locked;

    if (Object.prototype.hasOwnProperty.call(input, key)) {
      if (!asAdmin && locked) {
        next[key] = normalizeDeskField(key, prev[key]);
      } else {
        next[key] = normalizeDeskField(key, input[key]);
      }
    } else {
      next[key] = normalizeDeskField(key, prev[key]);
    }
  }

  const hasAny = DESK_FIELDS.some((k) => next[k]);
  if (hasAny && !next.setupCompletedAt) {
    next.setupCompletedAt = new Date();
  }
  if (input.setupCompletedAt) {
    next.setupCompletedAt = new Date(input.setupCompletedAt);
  }

  return next;
}

/** Public shape for API / auth user. */
function serializeDeskDefaults(raw) {
  const d = sanitizeDeskDefaults(raw || {}, { asAdmin: true });
  return {
    fls: d.fls,
    client: d.client,
    source: d.source,
    product: d.product,
    location: d.location,
    locked: { ...d.locked },
    setupCompletedAt: d.setupCompletedAt || null,
  };
}

/**
 * Fill empty candidate fields from desk defaults (create stamp / form prefills).
 * Never overwrites a non-empty body field.
 */
function applyDeskDefaultsToCandidate(body = {}, deskDefaults) {
  const d = serializeDeskDefaults(deskDefaults || {});
  const out = { ...body };
  for (const key of DESK_FIELDS) {
    const current = out[key];
    const empty = current == null || String(current).trim() === '';
    if (empty && d[key]) out[key] = d[key];
  }
  return out;
}

module.exports = {
  DESK_FIELDS,
  canAdminSetDeskDefaults,
  normalizeFls,
  emptyDeskDefaults,
  sanitizeDeskDefaults,
  serializeDeskDefaults,
  applyDeskDefaultsToCandidate,
};
