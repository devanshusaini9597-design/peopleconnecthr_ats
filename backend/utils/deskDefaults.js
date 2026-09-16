/**
 * Per-user ATS desk defaults (enterprise: admin + employee + role defaults).
 * Locked fields can only be changed by owner/admin/hr_manager.
 *
 * Prefill order (empty fields only on the form/create):
 *   1) User deskDefaults (saved)
 *   2) Org roleDeskDefaults for the user's role
 */

const { normalizeText } = require('./textNormalize');

const DESK_FIELDS = ['fls', 'client', 'source', 'product', 'location'];
const FLS_VALUES = new Set(['FLS', 'NON-FLS']);
const ADMIN_ROLES = new Set(['owner', 'admin', 'hr_manager']);
const ROLE_DEFAULT_KEYS = [
  'owner', 'admin', 'hr_manager', 'hr_recruiter', 'sales', 'other', 'recruiter', 'interviewer', 'readonly',
];

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
    return key === 'NONFLS' || key === 'NON-FLS' ? 'NON-FLS' : 'FLS';
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

function emptyLocks() {
  return { fls: false, client: false, source: false, product: false, location: false };
}

function emptyDeskDefaults() {
  return {
    fls: '',
    client: '',
    source: '',
    product: '',
    location: '',
    locked: emptyLocks(),
    setupCompletedAt: null,
  };
}

function emptyLastUsed() {
  return {
    fls: '',
    client: '',
    source: '',
    product: '',
    location: '',
    updatedAt: null,
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

function serializeLastUsed(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = emptyLastUsed();
  for (const key of DESK_FIELDS) {
    out[key] = normalizeDeskField(key, src[key]);
  }
  out.updatedAt = src.updatedAt ? new Date(src.updatedAt) : null;
  return out;
}

/** Sanitize org.atsSettings.roleDeskDefaults map. */
function sanitizeRoleDeskDefaultsMap(input = {}) {
  const out = {};
  const src = input && typeof input === 'object' ? input : {};
  for (const role of ROLE_DEFAULT_KEYS) {
    if (!src[role] || typeof src[role] !== 'object') continue;
    const cleaned = sanitizeDeskDefaults(src[role], { asAdmin: true });
    const hasAny = DESK_FIELDS.some((k) => cleaned[k]) || DESK_FIELDS.some((k) => cleaned.locked[k]);
    if (hasAny) out[role] = serializeDeskDefaults(cleaned);
  }
  return out;
}

/**
 * Merge user + role into one effective desk profile for Add Candidate.
 * Value priority: user saved → role default.
 * Lock: user lock OR role lock.
 */
function mergeEffectiveDeskDefaults({ userDefaults, roleDefaults } = {}) {
  const userD = serializeDeskDefaults(userDefaults || {});
  const roleD = serializeDeskDefaults(roleDefaults || {});
  const locked = emptyLocks();
  const out = emptyDeskDefaults();

  for (const key of DESK_FIELDS) {
    locked[key] = Boolean(userD.locked[key] || roleD.locked[key]);
    out.locked[key] = locked[key];

    if (userD[key]) {
      out[key] = userD[key];
    } else if (roleD[key]) {
      out[key] = roleD[key];
    } else {
      out[key] = '';
    }
  }

  out.setupCompletedAt = userD.setupCompletedAt || roleD.setupCompletedAt || null;
  return serializeDeskDefaults(out);
}

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

/** @deprecated Sticky last-used removed — kept for API compatibility. */
function buildLastUsedFromCandidate(candidate = {}, previousLastUsed = null) {
  const prev = serializeLastUsed(previousLastUsed || {});
  const next = { ...prev, updatedAt: new Date() };
  for (const key of DESK_FIELDS) {
    const val = normalizeDeskField(key, candidate[key]);
    if (val) next[key] = val;
  }
  return next;
}

/**
 * Resolve effective defaults for a user document + optional org lean doc.
 */
function resolveEffectiveForUser(user, org) {
  const role = String(user?.role || '');
  const roleMap = org?.atsSettings?.roleDeskDefaults || {};
  const roleDefaults = role && roleMap[role] ? roleMap[role] : {};
  return mergeEffectiveDeskDefaults({
    userDefaults: user?.deskDefaults,
    roleDefaults,
  });
}

module.exports = {
  DESK_FIELDS,
  ROLE_DEFAULT_KEYS,
  canAdminSetDeskDefaults,
  normalizeFls,
  emptyDeskDefaults,
  emptyLastUsed,
  sanitizeDeskDefaults,
  serializeDeskDefaults,
  serializeLastUsed,
  sanitizeRoleDeskDefaultsMap,
  mergeEffectiveDeskDefaults,
  applyDeskDefaultsToCandidate,
  buildLastUsedFromCandidate,
  resolveEffectiveForUser,
};
